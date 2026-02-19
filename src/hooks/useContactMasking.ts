import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `+${digits.slice(0, 1)}${digits.slice(1, 4)}***${digits.slice(-2)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const masked = local.length > 2 ? local.slice(0, 2) + '***' : '***';
  return `${masked}@${domain}`;
}

// Check if the 30-day prolongation rule is enabled globally
// Also checks restriction_bypass_until for temporary bypass
async function isProlongationRuleEnabled(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('audit_log_config')
      .select('is_enabled, restriction_bypass_until')
      .eq('rule_type', 'access_rule')
      .eq('action_type', 'prolongation_30d')
      .maybeSingle();
    if (!data) return true; // Default: enabled
    // Check if there's an active bypass
    if ((data as any).restriction_bypass_until) {
      const bypassUntil = new Date((data as any).restriction_bypass_until).getTime();
      if (bypassUntil > Date.now()) return false; // Bypass active — rule disabled
    }
    return data.is_enabled;
  } catch {
    return true;
  }
}

// Get rate limit config
async function getRateLimitConfig(): Promise<{ enabled: boolean; limit: number }> {
  try {
    const { data } = await supabase
      .from('audit_log_config')
      .select('is_enabled, config_value')
      .eq('rule_type', 'rate_limit')
      .eq('action_type', 'contact_view_limit')
      .maybeSingle();
    return {
      enabled: data ? data.is_enabled : true,
      limit: (data as any)?.config_value ?? 30,
    };
  } catch {
    return { enabled: true, limit: 30 };
  }
}

// Count recent views for rate limiting
async function countRecentViews(userId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('action', ['view_contact_phone', 'view_contact_email'])
    .gte('created_at', oneHourAgo);
  return count ?? 0;
}

export function useContactMasking() {
  const { userRole, user } = useAuth();
  const isAdmin = userRole === 'admin';

  const checkRateLimit = async (): Promise<{ allowed: boolean; current: number; limit: number; minutesLeft?: number }> => {
    // Admin bypasses rate limit
    if (isAdmin) return { allowed: true, current: 0, limit: 999 };

    const config = await getRateLimitConfig();
    if (!config.enabled) return { allowed: true, current: 0, limit: config.limit };

    const userId = user?.id;
    if (!userId) return { allowed: false, current: 0, limit: config.limit };

    const current = await countRecentViews(userId);
    if (current >= config.limit) {
      // Calculate minutes until oldest view expires
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: oldestView } = await supabase
        .from('access_logs')
        .select('created_at')
        .eq('user_id', userId)
        .in('action', ['view_contact_phone', 'view_contact_email'])
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let minutesLeft = 60;
      if (oldestView) {
        const expiresAt = new Date(oldestView.created_at).getTime() + 60 * 60 * 1000;
        minutesLeft = Math.max(1, Math.ceil((expiresAt - Date.now()) / 60000));
      }

      return { allowed: false, current, limit: config.limit, minutesLeft };
    }

    return { allowed: true, current, limit: config.limit };
  };

  const checkCanReveal = async (clientId: string): Promise<boolean> => {
    // Admin always bypasses prolongation rule
    if (isAdmin) return true;

    // Check if prolongation rule is enabled globally
    const ruleEnabled = await isProlongationRuleEnabled();
    if (!ruleEnabled) return true; // Rule disabled — everyone can reveal

    // Check if client has policy expiring within 30 days
    const { data: policies } = await supabase
      .from('policies')
      .select('end_date')
      .eq('client_id', clientId)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('end_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    return (policies?.length ?? 0) > 0;
  };

  return {
    isAdmin,
    shouldMask: true, // ALL roles see masked contacts
    maskPhone,
    maskEmail,
    checkCanReveal,
    checkRateLimit,
  };
}
