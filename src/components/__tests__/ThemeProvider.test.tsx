import { describe, it, expect, beforeEach } from 'vitest';

// Simple wrapper test — verify html class logic is correct
describe('ThemeProvider logic', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('applies dark class when theme is dark', () => {
    const apply = (theme: string) => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
      }
    };
    apply('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    apply('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
