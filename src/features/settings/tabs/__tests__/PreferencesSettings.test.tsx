import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesSettings } from '../PreferencesSettings';

vi.mock('../../../../hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ data: { theme: 'system', language: 'pt-PT', currency: 'EUR', compact_mode: false, show_currency_symbol: true }, isLoading: false }),
  useUpdateUserPreferences: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('PreferencesSettings', () => {
  it('shows theme, language and currency selects', () => {
    render(<QueryClientProvider client={new QueryClient()}><PreferencesSettings /></QueryClientProvider>);
    expect(screen.getByLabelText(/tema/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/idioma/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/moeda/i)).toBeInTheDocument();
  });
});
