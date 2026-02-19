import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller role using getClaims
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token)
    
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const callerId = claimsData.claims.sub

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .maybeSingle()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, fullName, role } = await req.json()
    if (!email || !password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Заполните email и пароль (мин. 6 символов)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create user with service role (auto-confirms, no rate limit)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (createError) {
      // Handle specific errors
      if (createError.message.includes('already been registered')) {
        return new Response(JSON.stringify({ error: 'Пользователь с таким email уже существует' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create profile with must_change_password and temp_password
    const { error: profileError } = await adminClient.from('profiles').upsert({
      user_id: newUser.user.id,
      full_name: fullName || null,
      must_change_password: true,
      temp_password: password, // Store for admin visibility
    }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
    }

    // Determine the base role for user_roles (admin or agent)
    const baseRole = role === 'admin' ? 'admin' : 'agent'

    // Assign base role in user_roles
    const { error: roleError } = await adminClient.from('user_roles').upsert({
      user_id: newUser.user.id,
      role: baseRole,
    }, { onConflict: 'user_id' })

    if (roleError) {
      console.error('Role upsert error:', roleError)
    }

    // Set custom_role_name on profile if a role is provided
    if (role) {
      // First ensure the role exists in user_roles_list
      await adminClient.from('user_roles_list').upsert({
        role_name: role,
      }, { onConflict: 'role_name' })

      await adminClient.from('profiles').update({
        custom_role_name: role,
      }).eq('user_id', newUser.user.id)
    }

    // Create invitation record for email tracking
    await adminClient.from('staff_invitations').upsert({
      email: email.toLowerCase().trim(),
      full_name: fullName || 'Сотрудник',
      role: role || 'agent',
      invited_by: callerId,
      claimed_at: new Date().toISOString(),
      claimed_by: newUser.user.id,
    }, { onConflict: 'email' })

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('admin-create-user error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
