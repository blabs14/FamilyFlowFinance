// src/components/goals/__tests__/GoalCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GoalCard from '../GoalCard';
import type { GoalWithBalance } from '@/services/goals';

vi.mock('@/lib/money', () => ({
  formatMoney: (cents: number) => `€${(cents / 100).toFixed(2)}`,
}));

const baseGoal: GoalWithBalance = {
  id: 'g-1',
  user_id: 'u-1',
  nome: 'Férias Algarve',
  prazo: '2026-08-01',
  tipo: 'savings',
  priority: 3,
  order_index: 0,
  status: 'active',
  ativa: true,
  family_id: null,
  target_cents: 100000,
  valor_atual_cents: 45000,
  progress_percent: 45,
  required_monthly_cents: 5500,
  is_behind_schedule: false,
  target_account_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('GoalCard', () => {
  it('renders goal name and progress', () => {
    render(
      <GoalCard
        goal={baseGoal}
        onAllocate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Férias Algarve')).toBeInTheDocument();
    expect(screen.getByText(/45%/)).toBeInTheDocument();
  });

  it('shows required_monthly_cents when prazo is set', () => {
    render(
      <GoalCard
        goal={baseGoal}
        onAllocate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText(/€55\.00\/mês/)).toBeInTheDocument();
  });

  it('shows "Atraso" badge when behind schedule', () => {
    render(
      <GoalCard
        goal={{ ...baseGoal, is_behind_schedule: true }}
        onAllocate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('Atraso')).toBeInTheDocument();
  });

  it('shows completion button when progress >= 100', () => {
    render(
      <GoalCard
        goal={{ ...baseGoal, progress_percent: 100, valor_atual_cents: 100000 }}
        onAllocate={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(screen.getByText('Concluir')).toBeInTheDocument();
  });
});
