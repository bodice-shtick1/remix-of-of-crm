import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ThemeId = 'slate' | 'night' | 'enterprise' | 'light';

const THEME_STORAGE_KEY = 'app-theme';

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
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeId) || 'slate';
    } catch {
      return 'slate';
    }
  });

  const [isSynced, setIsSynced] = useState(false);

  // On mount, load theme from DB if authenticated
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setIsSynced(true); return; }
      supabase
        .from('profiles')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const dbTheme = (data as any)?.theme as ThemeId | null;
          if (dbTheme && dbTheme !== theme) {
            setThemeState(dbTheme);
            try { localStorage.setItem(THEME_STORAGE_KEY, dbTheme); } catch {}
            applyTheme(dbTheme);
          }
          setIsSynced(true);
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback(async (t: ThemeId) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch {}
    applyTheme(t);

    // Save to DB
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
