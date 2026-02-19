import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authorization header to verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Не авторизован" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller's session and check admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Недействительный токен" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Доступ запрещён. Требуются права администратора." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { targetUserId, newPassword, targetEmail } = await req.json();

    if (!targetUserId || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Не указан пользователь или пароль" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "Пароль должен быть не менее 6 символов" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-password reset through this endpoint
    if (targetUserId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: "Используйте стандартную форму смены пароля для своего аккаунта" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AdminResetPassword] Admin ${callerUser.email} resetting password for user ${targetUserId}`);

    // Reset the user's password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("[AdminResetPassword] Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: `Ошибка сброса пароля: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set must_change_password flag AND store temp_password for admin visibility
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        must_change_password: true,
        temp_password: newPassword, // Store for admin to see
      })
      .eq("user_id", targetUserId);

    if (profileError) {
      console.warn("[AdminResetPassword] Error setting must_change_password flag:", profileError);
    }

    // Log to security_audit_logs
    const { error: auditError } = await supabaseAdmin
      .from("security_audit_logs")
      .insert({
        user_id: callerUser.id,
        action: "password_reset_by_admin",
        target_user_id: targetUserId,
        target_email: targetEmail || null,
        details: {
          admin_email: callerUser.email,
          reset_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.warn("[AdminResetPassword] Error logging to audit:", auditError);
    }

    console.log(`[AdminResetPassword] Password reset successful for user ${targetUserId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Пароль успешно сброшен" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AdminResetPassword] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Внутренняя ошибка сервера" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
