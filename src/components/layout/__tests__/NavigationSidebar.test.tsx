import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Controlo do scope mock por teste
const mockUseScope = vi.fn(() => ({
  scope: { kind: 'personal' as const },
  setScope: vi.fn(),
  scopedFilter: null,
}));

// Mocks mínimos
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' } }),
}));
vi.mock('../../../hooks/useProfilesQuery', () => ({
  useProfile: () => ({ data: { nome: 'Pedro' }, isLoading: false }),
}));
vi.mock('../../../features/scope', () => ({
  ScopeToggle: () => <div data-testid="scope-toggle" />,
  useScope: () => mockUseScope(),
  useMyFamilies: () => ({ data: [] }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

import { NavigationSidebar } from '../NavigationSidebar';

describe('NavigationSidebar', () => {
  it('renderiza os 8 items de nav principal', () => {
    render(<NavigationSidebar />, { wrapper });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Contas')).toBeInTheDocument();
    expect(screen.getByText('Transações')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
    expect(screen.getByText('Objetivos')).toBeInTheDocument();
    expect(screen.getByText('Recorrentes')).toBeInTheDocument();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('não mostra items de família quando scope é pessoal', () => {
    render(<NavigationSidebar />, { wrapper });
    expect(screen.queryByText('Membros')).not.toBeInTheDocument();
    expect(screen.queryByText('Convites')).not.toBeInTheDocument();
    expect(screen.queryByText('Definições Família')).not.toBeInTheDocument();
  });

  it('mostra items de família quando scope é família', () => {
    mockUseScope.mockReturnValueOnce({
      scope: { kind: 'family', familyId: 'fam-1' },
      setScope: vi.fn(),
      scopedFilter: { userId: 'u1', familyId: 'fam-1' },
    });
    render(<NavigationSidebar />, { wrapper });
    expect(screen.getByText('Membros')).toBeInTheDocument();
    expect(screen.getByText('Convites')).toBeInTheDocument();
    expect(screen.getByText('Definições Família')).toBeInTheDocument();
  });

  it('inclui o ScopeToggle no header da sidebar', () => {
    render(<NavigationSidebar />, { wrapper });
    expect(screen.getByTestId('scope-toggle')).toBeInTheDocument();
  });
});
