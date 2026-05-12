import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../SettingsPage';

vi.mock('../../../hooks/useUserPreferences', () => ({
  useUserPreferences: () => ({ data: null, isLoading: false }),
}));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../../../features/scope', () => ({
  useScope: vi.fn(),
}));
vi.mock('../../../hooks/useFamilyRole', () => ({
  useFamilyRole: vi.fn(),
}));

import { useScope } from '../../../features/scope';
import { useFamilyRole } from '../../../hooks/useFamilyRole';

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.mocked(useScope).mockReturnValue({ scope: 'personal', activeFamily: null } as any);
    vi.mocked(useFamilyRole).mockReturnValue(null as any);
  });

  it('renders 4 tabs for personal scope', () => {
    wrap(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /perfil/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /preferências/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notificações/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /dados/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /família/i })).not.toBeInTheDocument();
  });

  it('shows Família tab for family owner', () => {
    vi.mocked(useScope).mockReturnValue({ scope: 'family', activeFamily: { id: 'f1' } } as any);
    vi.mocked(useFamilyRole).mockReturnValue('owner' as any);
    wrap(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /família/i })).toBeInTheDocument();
  });

  it('hides Família tab for family member', () => {
    vi.mocked(useScope).mockReturnValue({ scope: 'family', activeFamily: { id: 'f1' } } as any);
    vi.mocked(useFamilyRole).mockReturnValue('member' as any);
    wrap(<SettingsPage />);
    expect(screen.queryByRole('tab', { name: /família/i })).not.toBeInTheDocument();
  });
});
