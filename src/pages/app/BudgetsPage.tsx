// src/pages/app/BudgetsPage.tsx
// Unified budgets page replacing PersonalBudgets + FamilyBudgets
import React, { useMemo, useState } from 'react';
import { BarChart3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-states';
import { useBudgetInstances } from '../../hooks/useBudgetsQuery';
import BudgetProgressCard from '../../components/budgets/BudgetProgressCard';
import type { GetBudgetsRow } from '../../services/budgets';

// Lazy-loaded sheets to avoid circular deps
const BudgetFormSheet = React.lazy(
  () => import('../../components/budgets/BudgetForm')
);

type FilterStatus = 'all' | 'ok' | 'warn' | 'over' | 'projected';

const BudgetsPage: React.FC = () => {
  const [filterMonth, setFilterMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<GetBudgetsRow | null>(null);

  const { data: budgets, isLoading } = useBudgetInstances({
    periodType: 'monthly',
    periodKey: filterMonth,
  });

  // Organize parent/child hierarchy
  const { roots, childrenMap } = useMemo(() => {
    const all = budgets ?? [];
    const childrenMap: Record<string, GetBudgetsRow[]> = {};
    const roots: GetBudgetsRow[] = [];

    all.forEach((b) => {
      if (b.parent_id) {
        childrenMap[b.parent_id] = childrenMap[b.parent_id] ?? [];
        childrenMap[b.parent_id].push(b);
      } else {
        roots.push(b);
      }
    });

    return { roots, childrenMap };
  }, [budgets]);

  const applyFilter = (b: GetBudgetsRow) => {
    const pct = b.progresso_percentual;
    if (filterStatus === 'ok') return pct < 80;
    if (filterStatus === 'warn') return pct >= 80 && pct < 100;
    if (filterStatus === 'over') return pct >= 100;
    if (filterStatus === 'projected') return b.is_projected_over;
    return true;
  };

  const handleNew = () => {
    setEditingBudget(null);
    setFormOpen(true);
  };

  const handleEdit = (b: GetBudgetsRow) => {
    setEditingBudget(b);
    setFormOpen(true);
  };

  const handleDelete = (_instanceId: string) => {
    // Handled by BudgetDetailSheet in full flow
  };

  const filteredRoots = roots.filter(applyFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Envelopes por categoria com projeção linear
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="filter-month">Mês</Label>
          <Input
            id="filter-month"
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ok">Dentro do orçamento</SelectItem>
              <SelectItem value="warn">Atenção (≥80%)</SelectItem>
              <SelectItem value="over">Excedido (≥100%)</SelectItem>
              <SelectItem value="projected">Projeção a ultrapassar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards grid */}
      {filteredRoots.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Nenhum orçamento encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Cria o teu primeiro orçamento para este período.
          </p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Orçamento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoots.map((budget) => (
            <BudgetProgressCard
              key={budget.instance_id}
              budget={budget}
              onEdit={handleEdit}
              onDelete={handleDelete}
            >
              {(childrenMap[budget.budget_id] ?? []).map((child) => (
                <BudgetProgressCard
                  key={child.instance_id}
                  budget={child}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </BudgetProgressCard>
          ))}
        </div>
      )}

      {/* Form sheet */}
      <React.Suspense fallback={null}>
        <BudgetFormSheet
          open={formOpen}
          editingBudget={editingBudget}
          onClose={() => setFormOpen(false)}
        />
      </React.Suspense>
    </div>
  );
};

export default BudgetsPage;
