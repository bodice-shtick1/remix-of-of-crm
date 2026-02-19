import { useState, useEffect, useCallback } from 'react';

export type ThemeId = 'slate' | 'night' | 'enterprise' | 'light';

const THEME_STORAGE_KEY = 'app-theme';

export const THEMES: { id: ThemeId; label: string; color: string }[] = [
  { id: 'slate', label: 'Slate', color: 'hsl(210 85% 45%)' },
  { id: 'night', label: 'Night', color: 'hsl(0 0% 0%)' },
  { id: 'enterprise', label: 'Enterprise', color: 'hsl(45 100% 50%)' },
  { id: 'light', label: 'Light', color: 'hsl(210 85% 55%)' },
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

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch {}
  }, []);

  return { theme, setTheme };
}
