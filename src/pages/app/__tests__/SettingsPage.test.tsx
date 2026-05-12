import { describe, it, expect, vi } from 'vitest';
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
  useScope: () => ({ scope: 'personal', activeFamily: null }),
}));
vi.mock('../../../hooks/useFamilyRole', () => ({
  useFamilyRole: () => null,
}));

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  it('renders 4 tabs for personal scope', () => {
    wrap(<SettingsPage />);
    expect(screen.getByRole('tab', { name: /perfil/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /preferências/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notificações/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /dados/i })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /família/i })).not.toBeInTheDocument();
  });
});
