import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Guard: system already configured?
    const { data: existingOrg } = await admin
      .from("organization_settings")
      .select("id")
      .limit(1);

    if (existingOrg && existingOrg.length > 0) {
      return new Response(
        JSON.stringify({ error: "Система уже настроена. Используйте форму входа." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, org_name, currency, timezone, monthly_goal } = await req.json();

    if (!email || !password || !org_name) {
      return new Response(
        JSON.stringify({ error: "Заполните все обязательные поля: email, пароль, название организации." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create user via Admin API (auto-confirms email)
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Администратор" },
    });

    if (userError) {
      return new Response(
        JSON.stringify({ error: `Ошибка создания пользователя: ${userError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // 3. Create profile
    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      full_name: "Администратор",
    });
    if (profileError) {
      console.error("Profile insert error:", profileError);
    }

    // 4. Assign admin role
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });
    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    // 5. Create organization
    const { error: orgError } = await admin.from("organization_settings").insert({
      name: org_name,
      currency: currency || "₽",
      timezone: timezone || "Europe/Moscow",
      created_by: userId,
      is_setup_complete: true,
    });
    if (orgError) {
      // Rollback: delete user if org creation failed
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Ошибка создания организации: ${orgError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Create agent_settings with monthly goal
    await admin.from("agent_settings").insert({
      user_id: userId,
      monthly_goal: monthly_goal || 1000000,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
