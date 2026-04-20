import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScopeProvider } from '../../../src/features/scope/ScopeProvider';
import { ScopeToggle } from '../../../src/features/scope/ScopeToggle';

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/features/scope/useMyFamilies', () => ({
  useMyFamilies: vi.fn(),
}));

import { useAuth } from '../../../src/contexts/AuthContext';
import { useMyFamilies } from '../../../src/features/scope/useMyFamilies';

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <QueryClientProvider client={qc}>
      <ScopeProvider>{ui}</ScopeProvider>
    </QueryClientProvider>
  );
};

describe('ScopeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when user is not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as never);
    vi.mocked(useMyFamilies).mockReturnValue({ data: [], isSuccess: true } as never);

    const { container } = render(wrap(<ScopeToggle />));

    expect(container.firstChild).toBeNull();
  });

  it('shows Pessoal as default label', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);
    vi.mocked(useMyFamilies).mockReturnValue({ data: [], isSuccess: true } as never);

    render(wrap(<ScopeToggle />));

    expect(screen.getByRole('button', { name: /Pessoal/i })).toBeInTheDocument();
  });

  it('switches to a family when a family item is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);
    vi.mocked(useMyFamilies).mockReturnValue({
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'Silva',
        },
      ],
      isSuccess: true,
    } as never);

    render(wrap(<ScopeToggle />));

    await userEvent.click(screen.getByRole('button', { name: /Pessoal/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Silva/i }));

    expect(
      screen.getByRole('button', { name: /Família: Silva/i }),
    ).toBeInTheDocument();
  });

  it('switches back to Pessoal', async () => {
    localStorage.setItem(
      'ffinance.scope.user-1',
      JSON.stringify({
        kind: 'family',
        familyId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    );
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);
    vi.mocked(useMyFamilies).mockReturnValue({
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'Silva',
        },
      ],
      isSuccess: true,
    } as never);

    render(wrap(<ScopeToggle />));

    await userEvent.click(screen.getByRole('button', { name: /Família: Silva/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^Pessoal$/i }));

    expect(screen.getByRole('button', { name: /^Pessoal$/i })).toBeInTheDocument();
  });
});
