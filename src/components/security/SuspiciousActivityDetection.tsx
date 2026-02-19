import { useEffect } from 'react';
import { logEventDirect } from '@/hooks/useEventLog';
import { supabase } from '@/integrations/supabase/client';

// Lightweight cache for role-based tab switch logging setting
let _tabLogCache: { enabled: boolean; ts: number } | null = null;
const TAB_CACHE_TTL = 1_000; // 1s — near-instant invalidation

async function isTabSwitchLoggingEnabled(): Promise<boolean> {
  if (_tabLogCache && Date.now() - _tabLogCache.ts < TAB_CACHE_TTL) {
    return _tabLogCache.enabled;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true;
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = roleData?.role || 'agent';

    const { data } = await supabase
      .from('audit_log_config')
      .select('is_enabled')
      .eq('rule_type', 'role_rule')
      .eq('action_type', 'tab_switch_logging')
      .eq('target_role', role)
      .maybeSingle();
    const enabled = data ? data.is_enabled : true;
    _tabLogCache = { enabled, ts: Date.now() };
    return enabled;
  } catch {
    return true;
  }
}

export function invalidateTabSwitchLogCache() {
  _tabLogCache = null;
}

/**
 * Detects Ctrl+C and tab switches while a phone number is revealed (👁️).
 */
function isPhoneRevealed(): boolean {
  const revealed = document.querySelectorAll('.text-primary.font-medium');
  return revealed.length > 0;
}

export function useSuspiciousActivityDetection() {
  useEffect(() => {
    // Ctrl+C detection (always logs if phone revealed — tied to tab_switch_logging toggle)
    const handleCopy = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С')) {
        if (isPhoneRevealed()) {
          const enabled = await isTabSwitchLoggingEnabled();
          if (!enabled) return;

          logEventDirect({
            action: 'suspicious_copy',
            category: 'access',
            entityType: 'screen',
            fieldAccessed: 'clipboard',
            newValue: '⚠️ Подозрительная активность — Копирование при открытом номере телефона',
            details: { trigger: 'ctrl+c', phone_revealed: true },
          });
        }
      }
    };

    // Tab/window switch detection
    const handleVisibilityChange = async () => {
      if (document.hidden && isPhoneRevealed()) {
        const enabled = await isTabSwitchLoggingEnabled();
        if (!enabled) return;

        logEventDirect({
          action: 'suspicious_tab_switch',
          category: 'access',
          entityType: 'screen',
          fieldAccessed: 'tab_switch',
          newValue: '⚠️ Подозрительная активность — Переключение вкладки при открытом номере телефона',
          details: { trigger: 'visibility_change', phone_revealed: true },
        });
      }
    };

    window.addEventListener('keydown', handleCopy, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleCopy, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
