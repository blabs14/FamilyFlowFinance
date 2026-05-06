// src/pages/app/RecurrentsPage.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-states';
import {
  useRecurringRules,
  useDeleteRecurringRule,
  usePauseRecurringRule,
  useResumeRecurringRule,
} from '@/hooks/useRecurrentsQuery';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/money';

// Lazy-load the form sheet to keep the main bundle small
const RecurringRuleSheet = React.lazy(
  () => import('@/components/recurrents/RecurringRuleSheet')
);

type Rule = {
  id: string;
  description: string | null;
  payee: string | null;
  amount_cents: number;
  interval_unit: string;
  interval_count: number;
  status: string;
  execution_mode: string;
  amount_mode: string;
  schedule_type: string;
  next_run_date: string;
  is_subscription: boolean;
  type: string;
  [key: string]: unknown;
};

const INTERVAL_LABEL: Record<string, string> = {
  day: 'dias', week: 'semanas', month: 'meses', year: 'anos',
};

export default function RecurrentsPage() {
  const { toast } = useToast();
  const { data: rules = [], isLoading } = useRecurringRules();
  const deleteRule  = useDeleteRecurringRule();
  const pauseRule   = usePauseRecurringRule();
  const resumeRule  = useResumeRecurringRule();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Rule | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Tens a certeza que queres eliminar esta regra?')) return;
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: 'Regra eliminada' });
    } catch {
      toast({ title: 'Erro ao eliminar', variant: 'destructive' });
    }
  };

  const handleTogglePause = async (rule: Rule) => {
    try {
      if (rule.status === 'active') {
        await pauseRule.mutateAsync(rule.id);
        toast({ title: 'Regra pausada' });
      } else {
        await resumeRule.mutateAsync(rule.id);
        toast({ title: 'Regra retomada' });
      }
    } catch {
      toast({ title: 'Erro ao alterar estado', variant: 'destructive' });
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recorrentes</h1>
          <p className="text-sm text-muted-foreground">
            {rules.length} regra{rules.length !== 1 ? 's' : ''} ativas
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          + Nova regra
        </Button>
      </div>

      {/* Rule cards */}
      {rules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Sem regras recorrentes</p>
          <p className="text-sm mt-1">Cria uma regra para automação de lançamentos.</p>
          <Button className="mt-4" onClick={() => setFormOpen(true)}>
            Criar primeira regra
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(rules as Rule[]).map((rule) => (
            <div key={rule.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-base truncate">
                      {rule.payee ?? rule.description ?? 'Recorrente'}
                    </span>
                    {rule.is_subscription && (
                      <Badge variant="secondary" className="text-xs">Sub</Badge>
                    )}
                    {rule.execution_mode === 'confirm' && (
                      <Badge variant="outline" className="text-xs">Confirmação</Badge>
                    )}
                    {rule.status !== 'active' && (
                      <Badge variant="destructive" className="text-xs">Pausado</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(rule.amount_cents)} · cada {rule.interval_count}{' '}
                    {INTERVAL_LABEL[rule.interval_unit] ?? rule.interval_unit}
                    {' · '}próximo: {new Date(rule.next_run_date).toLocaleDateString('pt-PT')}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditTarget(rule);
                      setFormOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTogglePause(rule)}
                  >
                    {rule.status === 'active' ? 'Pausar' : 'Retomar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(rule.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form sheet (lazy) */}
      <React.Suspense fallback={null}>
        {formOpen && (
          <RecurringRuleSheet
            rule={editTarget}
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
