import { useEffect } from 'react';
import { useUserPreferences } from '../hooks/useUserPreferences';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: prefs } = useUserPreferences();
  const theme = prefs?.theme ?? 'system';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system: track OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [theme]);

  return <>{children}</>;
}
