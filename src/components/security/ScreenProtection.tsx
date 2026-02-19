import { useEffect, useRef } from 'react';
import { logEventDirect } from '@/hooks/useEventLog';
import { supabase } from '@/integrations/supabase/client';

// Lightweight cache for role-based screenshot logging setting
let _screenshotCache: { enabled: boolean; ts: number } | null = null;
const CACHE_TTL = 1_000; // 1s — near-instant invalidation

async function isScreenshotLoggingEnabled(): Promise<boolean> {
  if (_screenshotCache && Date.now() - _screenshotCache.ts < CACHE_TTL) {
    return _screenshotCache.enabled;
  }
  try {
    // Get current user's role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true;
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = roleData?.role || 'agent';

    // Check role_rule for screenshot_logging
    const { data } = await supabase
      .from('audit_log_config')
      .select('is_enabled')
      .eq('rule_type', 'role_rule')
      .eq('action_type', 'screenshot_logging')
      .eq('target_role', role)
      .maybeSingle();
    const enabled = data ? data.is_enabled : true;
    _screenshotCache = { enabled, ts: Date.now() };
    return enabled;
  } catch {
    return true;
  }
}

// Allow external invalidation
export function invalidateScreenshotLogCache() {
  _screenshotCache = null;
}

/**
 * Aggressive screenshot attempt detection.
 * Silently logs all known screenshot key combos, context menu, and focus-loss after PrintScreen.
 * Respects the admin toggle in audit config.
 */
export function useScreenshotDetection() {
  const printScreenPressedRef = useRef(false);

  useEffect(() => {
    const keyHandler = async (e: KeyboardEvent) => {
      let isScreenshot = false;
      let method = '';

      // PrintScreen (alone, or with any modifier)
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        isScreenshot = true;
        if (e.altKey) method = 'Alt+PrintScreen';
        else if (e.ctrlKey) method = 'Ctrl+PrintScreen';
        else if (e.metaKey) method = 'Win+PrintScreen';
        else method = 'PrintScreen';
        printScreenPressedRef.current = true;
      }

      // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (e.metaKey && e.shiftKey) {
        if (e.key === '3' || e.code === 'Digit3') { isScreenshot = true; method = 'Cmd+Shift+3'; }
        if (e.key === '4' || e.code === 'Digit4') { isScreenshot = true; method = 'Cmd+Shift+4'; }
        if (e.key === '5' || e.code === 'Digit5') { isScreenshot = true; method = 'Cmd+Shift+5'; }
      }

      // Windows: Win+Shift+S (Snipping Tool)
      if (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        isScreenshot = true;
        method = 'Win+Shift+S';
      }

      if (isScreenshot) {
        try { e.preventDefault(); } catch {}
        try { e.stopPropagation(); } catch {}
        try { e.stopImmediatePropagation(); } catch {}

        const enabled = await isScreenshotLoggingEnabled();
        if (!enabled) return;

        logEventDirect({
          action: 'screenshot_attempt',
          category: 'access',
          entityType: 'screen',
          fieldAccessed: 'screenshot',
          newValue: `📸 Скриншот — Тихая фиксация попытки захвата экрана (${method})`,
          details: { method, key: e.key, code: e.code, meta: e.metaKey, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey },
        });
      }
    };

    // Focus loss shortly after PrintScreen → suspect third-party tool
    const blurHandler = async () => {
      if (printScreenPressedRef.current) {
        printScreenPressedRef.current = false;
        const enabled = await isScreenshotLoggingEnabled();
        if (!enabled) return;

        logEventDirect({
          action: 'screenshot_attempt',
          category: 'access',
          entityType: 'screen',
          fieldAccessed: 'screenshot',
          newValue: '📸 Подозрение на скриншот сторонним софтом (потеря фокуса после PrintScreen)',
          details: { method: 'focus_loss_after_printscreen' },
        });
      }
    };

    const focusHandler = () => { printScreenPressedRef.current = false; };

    // Context menu (right-click)
    const contextHandler = async () => {
      const enabled = await isScreenshotLoggingEnabled();
      if (!enabled) return;

      logEventDirect({
        action: 'context_menu_open',
        category: 'access',
        entityType: 'screen',
        fieldAccessed: 'context_menu',
        newValue: '🖱️ Открытие контекстного меню на странице с данными',
        details: { path: window.location.pathname },
      });
    };

    window.addEventListener('keydown', keyHandler, true);
    window.addEventListener('keyup', keyHandler, true);
    window.addEventListener('blur', blurHandler);
    window.addEventListener('focus', focusHandler);
    document.addEventListener('contextmenu', contextHandler, true);

    return () => {
      window.removeEventListener('keydown', keyHandler, true);
      window.removeEventListener('keyup', keyHandler, true);
      window.removeEventListener('blur', blurHandler);
      window.removeEventListener('focus', focusHandler);
      document.removeEventListener('contextmenu', contextHandler, true);
    };
  }, []);
}
