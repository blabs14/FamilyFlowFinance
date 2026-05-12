import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { nome: 'Ana', foto_url: null }, error: null }) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: {}, error: null }) })) })) })),
    })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })) })) },
  },
}));
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.com' } }) }));
vi.mock('../../../../hooks/useUserPreferences', () => ({ useUserPreferences: () => ({ data: null }), useUpdateUserPreferences: () => ({ mutateAsync: vi.fn() }) }));

import { ProfileSettings } from '../ProfileSettings';

describe('ProfileSettings', () => {
  it('renders name and email fields', () => {
    render(<QueryClientProvider client={new QueryClient()}><ProfileSettings /></QueryClientProvider>);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows password section', () => {
    render(<QueryClientProvider client={new QueryClient()}><ProfileSettings /></QueryClientProvider>);
    expect(screen.getByText(/alterar password/i)).toBeInTheDocument();
  });
});
