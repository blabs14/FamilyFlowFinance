import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataPrivacySettings } from '../DataPrivacySettings';

vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../../hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ data: {} }),
}));
vi.mock('../../../../services/accountDeletion', () => ({
  getPendingDeletion: vi.fn().mockResolvedValue({ data: null, error: null }),
  requestAccountDeletion: vi.fn().mockResolvedValue({ data: { id: 'tok1', expires_at: '2026-06-12T00:00:00Z' }, error: null }),
  cancelAccountDeletion: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

describe('DataPrivacySettings', () => {
  it('shows export and delete account buttons', () => {
    render(<QueryClientProvider client={new QueryClient()}><DataPrivacySettings /></QueryClientProvider>);
    expect(screen.getByRole('button', { name: /exportar dados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apagar conta/i })).toBeInTheDocument();
  });

  it('delete button opens confirmation dialog', async () => {
    const u = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><DataPrivacySettings /></QueryClientProvider>);
    await u.click(screen.getByRole('button', { name: /apagar conta/i }));
    expect(screen.getByText(/confirmar eliminação/i)).toBeInTheDocument();
  });
});
