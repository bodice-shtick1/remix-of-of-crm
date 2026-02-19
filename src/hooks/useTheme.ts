import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeId = 'slate' | 'night' | 'enterprise' | 'light';

const THEME_STORAGE_KEY = 'app-theme';
const DEFAULT_THEME: ThemeId = 'slate';

export const THEMES: { id: ThemeId; label: string; color: string; description: string }[] = [
  { id: 'slate', label: 'Slate', color: 'hsl(210 85% 45%)', description: 'Синий + бирюзовый' },
  { id: 'light', label: 'Светлая', color: 'hsl(210 85% 55%)', description: 'Классическая светлая' },
  { id: 'night', label: 'Ночь', color: 'hsl(0 0% 0%)', description: 'Тотальный чёрный' },
  { id: 'enterprise', label: 'Классика 1С', color: 'hsl(45 100% 50%)', description: 'Жёлтый без скруглений' },
];

function applyTheme(theme: ThemeId) {
  const html = document.documentElement;
  if (theme === 'slate') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
  // Keep localStorage in sync as a cache for next page load
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
}

function clearThemeStorage() {
  try { localStorage.removeItem(THEME_STORAGE_KEY); } catch {}
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  // Listen to auth state changes — load theme from DB on login, reset on logout
  useEffect(() => {
    // Immediate check for current user
    let cancelled = false;

    const loadThemeForUser = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('theme')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const dbTheme = ((data as any)?.theme as ThemeId) || DEFAULT_THEME;
      setThemeState(dbTheme);
      applyTheme(dbTheme);
    };

    const resetTheme = () => {
      clearThemeStorage();
      setThemeState(DEFAULT_THEME);
      applyTheme(DEFAULT_THEME);
    };

    // Load for current session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (user) {
        loadThemeForUser(user.id);
      }
    });

    // React to auth changes (login / logout / token refresh with different user)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        resetTheme();
      } else if (event === 'SIGNED_IN' && session?.user) {
        loadThemeForUser(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(async (t: ThemeId) => {
    setThemeState(t);
    applyTheme(t);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ theme: t } as any)
        .eq('user_id', user.id);
    }
  }, []);

  return { theme, setTheme };
}
