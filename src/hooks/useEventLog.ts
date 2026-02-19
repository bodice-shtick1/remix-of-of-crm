import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type EventCategory = 'sales' | 'clients' | 'finance' | 'service' | 'access' | 'auth';
export type EventAction = 'create' | 'update' | 'delete' | 'view' | 'print' | 'import' | 'cleanup' | 'settings_change' | 'login' | 'logout' | 'view_contact';

interface LogEventParams {
  action: string;
  category: EventCategory;
  entityType?: string;
  entityId?: string;
  clientId?: string;
  fieldAccessed?: string;
  oldValue?: string;
  newValue?: string;
  details?: Record<string, unknown>;
}

// Map action strings to audit config action_type keys
function normalizeActionForConfig(action: string): string {
  const a = action.toLowerCase();
  if (a === 'login' || a === 'login_failed' || a === 'logout') return 'login';
  if (a === 'create' || a === 'import') return 'create';
  if (a === 'update' || a === 'settings_change') return 'update';
  if (a === 'delete' || a === 'cleanup') return 'delete';
  if (a === 'view_contact' || a === 'view_contact_phone' || a === 'view_contact_email' || a === 'open_card') return 'view_contact';
  if (a === 'print') return 'print';
  if (a === 'screenshot_attempt' || a === 'context_menu_open') return 'screenshot_logging';
  if (a === 'suspicious_tab_switch' || a === 'suspicious_copy') return 'tab_switch_logging';
  if (a === 'access_denied') return 'view_contact'; // access denied follows view_contact rule
  return 'view_contact'; // fallback — don't block unknown actions by default
}

// Cache for audit config to avoid DB call on every log
let _auditConfigCache: { rules: any[]; blacklist: string[]; ts: number } | null = null;
const CACHE_TTL = 1_000; // 1s — near-instant invalidation

async function getAuditConfig() {
  if (_auditConfigCache && Date.now() - _auditConfigCache.ts < CACHE_TTL) {
    return _auditConfigCache;
  }
  try {
    const { data } = await supabase.from('audit_log_config').select('*');
    const rules = (data || []).filter((r: any) => r.rule_type === 'role_rule');
    const blacklist = (data || [])
      .filter((r: any) => r.rule_type === 'blacklist')
      .map((r: any) => r.target_user_id);
    _auditConfigCache = { rules, blacklist, ts: Date.now() };
    return _auditConfigCache;
  } catch {
    return { rules: [], blacklist: [], ts: Date.now() };
  }
}

async function getUserRole(userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.role || 'agent';
  } catch {
    return 'agent';
  }
}

async function shouldLog(userId: string, action: string): Promise<boolean> {
  const config = await getAuditConfig();
  // Check blacklist
  if (config.blacklist.includes(userId)) return false;
  // Check role rules
  const role = await getUserRole(userId);
  const actionKey = normalizeActionForConfig(action);
  const rule = config.rules.find((r: any) => r.target_role === role && r.action_type === actionKey);
  // If no rule found, default to enabled
  if (!rule) return true;
  return rule.is_enabled;
}

// Export cache invalidator for use from settings
export function invalidateAuditConfigCache() {
  _auditConfigCache = null;
}

export function useEventLog() {
  const logEvent = useCallback(async (params: LogEventParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allowed = await shouldLog(user.id, params.action);
      if (!allowed) return;

      await supabase.from('access_logs').insert([{
        user_id: user.id,
        client_id: params.clientId || null,
        action: params.action,
        category: params.category,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        field_accessed: params.fieldAccessed || null,
        old_value: params.oldValue || null,
        new_value: params.newValue || null,
        details: params.details || null,
      }] as any);
    } catch (e) {
      console.warn('[EventLog] Failed to log event:', e);
    }
  }, []);

  return { logEvent };
}

// Standalone function for use outside React components — respects audit matrix
export async function logEventDirect(params: LogEventParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const allowed = await shouldLog(user.id, params.action);
    if (!allowed) return;

    await supabase.from('access_logs').insert([{
      user_id: user.id,
      client_id: params.clientId || null,
      action: params.action,
      category: params.category,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      field_accessed: params.fieldAccessed || null,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
      details: params.details || null,
    }] as any);
  } catch (e) {
    console.warn('[EventLog] Failed to log event:', e);
  }
}

/**
 * Security-critical logging: attempts to log the event and returns success/failure.
 * If logging is disabled for this action (via audit config), returns true (action allowed, no log needed).
 * If logging is enabled but fails, returns false (action BLOCKED).
 */
export async function logEventStrictOrBlock(params: LogEventParams): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[EventLog] No user — blocking action');
      return false;
    }

    // Check if logging is enabled for this action+role
    const allowed = await shouldLog(user.id, params.action);
    if (!allowed) {
      // Logging disabled in matrix — allow action without writing log
      return true;
    }

    // Logging is enabled — must successfully write
    const { error } = await supabase.from('access_logs').insert([{
      user_id: user.id,
      client_id: params.clientId || null,
      action: params.action,
      category: params.category,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      field_accessed: params.fieldAccessed || null,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
      details: params.details || null,
    }] as any);

    if (error) {
      console.error('[EventLog] Strict log FAILED:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[EventLog] Strict log EXCEPTION:', e);
    return false;
  }
}
