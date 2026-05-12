import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';

vi.mock('../../hooks/useUserPreferences', () => ({
  useUserPreferences: vi.fn(),
}));

import { useUserPreferences } from '../../hooks/useUserPreferences';
const mockUseUserPreferences = vi.mocked(useUserPreferences);

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    vi.clearAllMocks();
  });

  it('adds dark class when theme is dark', () => {
    mockUseUserPreferences.mockReturnValue({ data: { theme: 'dark' } } as any);
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when theme is light', () => {
    document.documentElement.classList.add('dark');
    mockUseUserPreferences.mockReturnValue({ data: { theme: 'light' } } as any);
    render(<ThemeProvider><div /></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('defaults to system theme when prefs are null', () => {
    mockUseUserPreferences.mockReturnValue({ data: null } as any);
    // Should not throw
    render(<ThemeProvider><div /></ThemeProvider>);
  });
});
