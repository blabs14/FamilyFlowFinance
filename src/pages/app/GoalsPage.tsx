// src/pages/app/GoalsPage.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-states';
import GoalCard from '@/components/goals/GoalCard';
import GoalAllocationModal from '@/components/goals/GoalAllocationModal';
import GoalCompletionModal from '@/components/goals/GoalCompletionModal';
import { useGoalsWithBalance, useDeleteGoal } from '@/hooks/useGoalsQuery';
import { useToast } from '@/hooks/use-toast';
import type { GoalWithBalance } from '@/services/goals';

// Lazy-load GoalForm sheet to reduce bundle
const GoalFormSheet = React.lazy(() => import('@/components/goals/GoalFormSheet'));

export default function GoalsPage() {
  const { toast } = useToast();
  const { data: goals = [], isLoading } = useGoalsWithBalance();
  const deleteGoal = useDeleteGoal();

  const [allocationTarget, setAllocationTarget] = useState<GoalWithBalance | null>(null);
  const [completionTarget, setCompletionTarget] = useState<GoalWithBalance | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<GoalWithBalance | null>(null);

  const handleDelete = async (goalId: string) => {
    if (!confirm('Tens a certeza que queres apagar este objetivo?')) return;
    try {
      await deleteGoal.mutateAsync(goalId);
      toast({ title: 'Objetivo apagado' });
    } catch {
      toast({ title: 'Erro ao apagar objetivo', variant: 'destructive' });
    }
  };

  const handleEdit = (goal: GoalWithBalance) => {
    setEditTarget(goal);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Objetivos</h1>
          <p className="text-sm text-muted-foreground">
            {goals.length} objetivo{goals.length !== 1 ? 's' : ''} ativos
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          + Novo objetivo
        </Button>
      </div>

      {/* Goal cards grid */}
      {goals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Ainda não tens objetivos</p>
          <p className="text-sm mt-1">Cria o teu primeiro objetivo para começar a poupar.</p>
          <Button
            className="mt-4"
            onClick={() => setFormOpen(true)}
          >
            Criar primeiro objetivo
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onAllocate={setAllocationTarget}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onComplete={goal.progress_percent >= 100 ? setCompletionTarget : undefined}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {allocationTarget && (
        <GoalAllocationModal
          goal={allocationTarget}
          open={!!allocationTarget}
          onClose={() => setAllocationTarget(null)}
        />
      )}

      {completionTarget && (
        <GoalCompletionModal
          goal={completionTarget}
          open={!!completionTarget}
          onClose={() => setCompletionTarget(null)}
        />
      )}

      {/* Form sheet (lazy-loaded) */}
      <React.Suspense fallback={null}>
        {formOpen && (
          <GoalFormSheet
            goal={editTarget}
            open={formOpen}
            onClose={() => {
              setFormOpen(false);
              setEditTarget(null);
            }}
          />
        )}
      </React.Suspense>
    </div>
  );
}
