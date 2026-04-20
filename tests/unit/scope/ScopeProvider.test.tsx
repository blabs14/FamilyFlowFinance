import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScopeProvider } from '../../../src/features/scope/ScopeProvider';
import { saveScope } from '../../../src/features/scope/storage';
import { useScope } from '../../../src/features/scope/useScope';

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../src/features/scope/useMyFamilies', () => ({
  useMyFamilies: vi.fn(),
}));

import { useAuth } from '../../../src/contexts/AuthContext';
import { useMyFamilies } from '../../../src/features/scope/useMyFamilies';

const Probe = () => {
  const { scope, setScope } = useScope();

  return (
    <div>
      <span data-testid="kind">{scope.kind}</span>
      <span data-testid="family">
        {scope.kind === 'family' ? scope.familyId : '-'}
      </span>
      <button onClick={() => setScope({ kind: 'family', familyId: 'fam-1' })}>
        to-family
      </button>
      <button onClick={() => setScope({ kind: 'personal' })}>to-personal</button>
    </div>
  );
};

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return (
    <QueryClientProvider client={qc}>
      <ScopeProvider>{ui}</ScopeProvider>
    </QueryClientProvider>
  );
};

describe('ScopeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useMyFamilies).mockReturnValue({
      data: [{ id: 'fam-1', nome: 'Silva' }],
      isSuccess: true,
    } as never);
  });

  it('defaults to personal scope when nothing is stored', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);

    render(wrap(<Probe />));

    expect(screen.getByTestId('kind').textContent).toBe('personal');
  });

  it('hydrates family scope from storage', () => {
    saveScope('user-1', {
      kind: 'family',
      familyId: '550e8400-e29b-41d4-a716-446655440000',
    });
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

    render(wrap(<Probe />));

    expect(screen.getByTestId('kind').textContent).toBe('family');
    expect(screen.getByTestId('family').textContent).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('falls back to personal when stored family is no longer a membership', () => {
    saveScope('user-1', {
      kind: 'family',
      familyId: '550e8400-e29b-41d4-a716-446655440099',
    });
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);

    render(wrap(<Probe />));

    expect(screen.getByTestId('kind').textContent).toBe('personal');
  });

  it('persists setScope changes to storage', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);

    render(wrap(<Probe />));

    act(() => screen.getByText('to-family').click());

    expect(screen.getByTestId('kind').textContent).toBe('family');
    expect(localStorage.getItem('ffinance.scope.user-1')).toContain('family');
  });

  it('throws when useScope is called outside the provider', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);

    const Orphan = () => {
      useScope();
      return null;
    };

    expect(() => render(<Orphan />)).toThrow(/ScopeProvider/);
  });
});
