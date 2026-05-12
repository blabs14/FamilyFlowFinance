import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamilySettingsPanel } from '../FamilySettingsPanel';

vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../../features/scope', () => ({
  useScope: () => ({ activeFamily: { id: 'f1', name: 'Família Silva' } }),
}));
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'm1', user_id: 'u1', role: 'owner', profiles: { nome: 'Ana', foto_url: null } }],
          error: null,
        }),
      })),
    })),
  },
}));

describe('FamilySettingsPanel', () => {
  it('shows family name and members list heading', async () => {
    render(<QueryClientProvider client={new QueryClient()}><FamilySettingsPanel /></QueryClientProvider>);
    expect(screen.getByText(/família silva/i)).toBeInTheDocument();
  });
});
