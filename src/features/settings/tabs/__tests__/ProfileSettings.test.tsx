import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
vi.mock('../../../../hooks/useProfilesQuery', () => ({
  useProfile: () => ({ data: { id: 'u1', nome: 'Ana', foto_url: null }, isLoading: false }),
  useUpdateProfile: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

import { ProfileSettings } from '../ProfileSettings';

describe('ProfileSettings', () => {
  it('renders name and email fields', () => {
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ProfileSettings /></QueryClientProvider></MemoryRouter>);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows password section', () => {
    render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ProfileSettings /></QueryClientProvider></MemoryRouter>);
    expect(screen.getByText(/alterar password/i)).toBeInTheDocument();
  });
});
