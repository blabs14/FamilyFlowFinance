import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockUseScope = vi.fn(() => ({
  scope: { kind: 'personal' as const },
  scopedFilter: null,
}));

vi.mock('../../../features/scope', () => ({
  useScope: () => mockUseScope(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

import { BottomTabBar } from '../BottomTabBar';

describe('BottomTabBar', () => {
  beforeEach(() => {
    mockUseScope.mockReset();
    mockUseScope.mockReturnValue({ scope: { kind: 'personal' as const }, scopedFilter: null });
  });

  it('renderiza 4 itens visíveis + botão Mais', () => {
    render(<BottomTabBar />, { wrapper });
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Contas')).toBeInTheDocument();
    expect(screen.getByText('Transações')).toBeInTheDocument();
    expect(screen.getByText('Objetivos')).toBeInTheDocument();
    expect(screen.getByText('Mais')).toBeInTheDocument();
  });

  it('abre o drawer "Mais" ao clicar', () => {
    render(<BottomTabBar />, { wrapper });
    fireEvent.click(screen.getByText('Mais'));
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
    expect(screen.getByText('Recorrentes')).toBeInTheDocument();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('mostra Membros no drawer quando scope é família', () => {
    mockUseScope.mockReturnValue({
      scope: { kind: 'family', familyId: 'fam-1' },
      scopedFilter: { userId: 'u1', familyId: 'fam-1' },
    });
    render(<BottomTabBar />, { wrapper });
    fireEvent.click(screen.getByText('Mais'));
    expect(screen.getByText('Membros')).toBeInTheDocument();
  });
});
