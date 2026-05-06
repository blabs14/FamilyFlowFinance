// src/components/budgets/__tests__/BudgetProgressCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BudgetProgressCard from '../BudgetProgressCard';

const mockBudget = {
  instance_id: 'inst-1',
  budget_id: 'bud-1',
  categoria_id: 'cat-1',
  categoria_nome: 'Alimentação',
  categoria_cor: '#22c55e',
  period_type: 'monthly',
  period_key: '2026-04',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  budget_cents: 50000,   // €500
  spent_cents: 40000,    // €400 (80%)
  remaining_cents: 10000,
  progresso_percentual: 80,
  rollover_mode: 'reset',
  cap_type: 'flexible',
  parent_id: null,
  is_projected_over: false,
  status: 'active',
};

describe('BudgetProgressCard', () => {
  it('mostra nome da categoria', () => {
    render(<BudgetProgressCard budget={mockBudget} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
  });

  it('mostra percentagem de progresso', () => {
    render(<BudgetProgressCard budget={mockBudget} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/80/)).toBeInTheDocument();
  });

  it('mostra badge amarelo quando >=80%', () => {
    render(<BudgetProgressCard budget={mockBudget} onEdit={() => {}} onDelete={() => {}} />);
    // Badge "Atencao" aparece quando 80% <= pct < 100%
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('mostra badge vermelho quando ultrapassado', () => {
    const over = { ...mockBudget, spent_cents: 55000, remaining_cents: -5000, progresso_percentual: 110 };
    render(<BudgetProgressCard budget={over} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Excedido')).toBeInTheDocument();
  });

  it('mostra badge de projecao quando is_projected_over e pct < 80', () => {
    // Projecao badge only shows when pct < 80 but is_projected_over=true
    const proj = { ...mockBudget, progresso_percentual: 50, spent_cents: 25000, remaining_cents: 25000, is_projected_over: true };
    render(<BudgetProgressCard budget={proj} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Projeção')).toBeInTheDocument();
  });
});
