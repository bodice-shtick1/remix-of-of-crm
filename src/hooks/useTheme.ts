import { useState, useEffect, useCallback, useRef } from 'react';
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

function applyThemeToDOM(theme: ThemeId) {
  const html = document.documentElement;
  if (theme === 'slate') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

function cacheTheme(theme: ThemeId) {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
}

function getCachedTheme(): ThemeId {
  try {
    return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function useTheme() {
  // Start with cached theme — main.tsx already applied it to DOM
  const [theme, setThemeState] = useState<ThemeId>(getCachedTheme);
  const [isSynced, setIsSynced] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const applyDbTheme = (dbTheme: ThemeId) => {
      // Write cache FIRST so next page load picks it up immediately
      cacheTheme(dbTheme);
      applyThemeToDOM(dbTheme);
      setThemeState(dbTheme);
    };

    const loadThemeForUser = async (userId: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('theme')
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        const dbTheme = ((data as any)?.theme as ThemeId) || DEFAULT_THEME;
        applyDbTheme(dbTheme);
      } catch {
        // On error keep cached theme, don't reset
      }
      if (!cancelled) setIsSynced(true);
    };

    // On mount: check session and load theme from DB simultaneously
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        loadThemeForUser(session.user.id);
      } else {
        // No session — cached theme is fine, mark synced
        setIsSynced(true);
      }
    });

    // React to future auth changes (not the initial SIGNED_IN that fires on mount)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      // Skip the initial SIGNED_IN event — we already handled it above via getSession
      if (isInitialMount.current && event === 'INITIAL_SESSION') {
        return;
      }
      isInitialMount.current = false;

      if (event === 'SIGNED_OUT') {
        // User explicitly logged out — reset to default
        cacheTheme(DEFAULT_THEME);
        applyThemeToDOM(DEFAULT_THEME);
        setThemeState(DEFAULT_THEME);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // New login (possibly different user) — load their theme
        setIsSynced(false);
        loadThemeForUser(session.user.id);
      }
    });

    // After first onAuthStateChange callback, clear the flag
    // Give it a tick so the initial event can be skipped
    setTimeout(() => { isInitialMount.current = false; }, 500);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Keep DOM in sync if theme changes via setTheme
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  const setTheme = useCallback(async (t: ThemeId) => {
    cacheTheme(t);
    applyThemeToDOM(t);
    setThemeState(t);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ theme: t } as any)
        .eq('user_id', user.id);
    }
  }, []);

  return { theme, setTheme, isSynced };
}
