import React, { useState, useEffect } from 'react';
import { usePersonal } from './PersonalProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Target, Plus, Edit, Trash2, Calendar, CheckCircle, Trophy } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { useCreateGoal, useUpdateGoal, useDeleteGoal } from '../../hooks/useGoalsQuery';
import { useToast } from '../../hooks/use-toast';
import { formatCurrency } from '../../lib/utils';
import { GoalAllocationModal } from '../../components/GoalAllocationModal';
import { GoalDeallocationModal } from '../../components/GoalDeallocationModal';
import GoalForm from '../../components/GoalForm';
import { GoalProgress } from '../../integrations/supabase/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { useConfirmation } from '@/hooks/useConfirmation';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { getAuditLogsByRow } from '../../services/audit_logs';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { GoalFundingSection } from '../../components/GoalFundingSection';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LazyWrapper } from '../../components/ui/lazy-wrapper';
type AuditEntry = { id: string; timestamp: string; operation: string; old_data?: any; new_data?: any; details?: any };

const PersonalGoals: React.FC = () => {

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showDeallocationModal, setShowDeallocationModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalProgress | null>(null);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'progress' | 'warn' | 'done'>('all');
  
  // Usar dados do PersonalProvider
  const { myGoals: goalsRaw, isLoading: loadingState, refetchAll } = usePersonal();
  const goals = Array.isArray(goalsRaw) ? goalsRaw : [];
  // Carregamento da página depende apenas de goals
  const isLoading = !!loadingState?.goals;
  // Log de diagnóstico leve
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[PersonalGoals] isLoading.goals=', loadingState?.goals, 'goals.length=', goals.length);
  }

  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  
  // Converter goals para goalProgress format se necessário
  const goalProgress = goals.map(goal => ({
    ...goal,
    progress_percentage: goal.valor_atual && goal.valor_objetivo 
      ? Math.min((goal.valor_atual / goal.valor_objetivo) * 100, 100) 
      : 0
  }));
  
  const { toast } = useToast();
  const confirmation = useConfirmation();
  // Objetivos pessoais são sempre editáveis pelo próprio utilizador
  const canEditGoal = true;

  const handleCreateGoal = () => {
    setShowCreateModal(true);
  };

  const handleAllocationSuccess = () => {
    setShowAllocationModal(false);
    setSelectedGoal(null);
    refetchAll(); // Atualizar todos os dados
    toast({
      title: 'Alocação realizada',
      description: 'Valor alocado com sucesso ao objetivo!',
    });
  };

  const handleAllocateToGoal = (goal: GoalProgress) => {
    setSelectedGoal(goal);
    setShowAllocationModal(true);
  };

  const handleDeallocateFromGoal = (goal: GoalProgress) => {
    setSelectedGoal(goal);
    setShowDeallocationModal(true);
  };

  const handleEditGoal = (goal: any) => {
    // O objetivo já vem com todos os dados necessários
    setEditingGoal(goal);
    setShowEditModal(true);
  };

  const handleDeleteGoal = async (goalId: string) => {

    
    const confirmed = await confirmation.confirm({
      title: 'Eliminar Objetivo',
      message: 'Tens a certeza que queres eliminar este objetivo? Esta ação não pode ser desfeita.',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      variant: 'destructive'
    });

    if (!confirmed) {
      return;
    }
    
    try {
      const result = await deleteGoalMutation.mutateAsync(goalId);

      toast({
        title: 'Objetivo eliminado',
        description: 'O objetivo foi eliminado com sucesso.',
      });
    } catch (error) {

      toast({
        title: 'Erro',
        description: `Erro ao eliminar objetivo: ${error?.message || 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    }
  };

  const getProgressText = (progress: number) => {
    if (progress >= 100) return 'Concluído';
    if (progress >= 80) return 'Quase concluído';
    if (progress >= 50) return 'A meio caminho';
    return 'A começar';
  };

  // Atalho global '/' coberto por GlobalShortcuts

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Erro handling é feito pelo PersonalProvider

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objetivos Pessoais
          </h2>
          <p className="text-sm text-muted-foreground">
            Suas metas financeiras e objetivos de poupança
          </p>
        </div>
        {canEditGoal && (
          <Button onClick={handleCreateGoal} aria-label="Criar novo objetivo financeiro">
            <Plus className="h-4 w-4 mr-2" />
            Novo Objetivo
          </Button>
        )}
      </div>

      {/* Filtros rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Estado</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | 'active' | 'completed')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="progress">Em progresso</SelectItem>
              <SelectItem value="warn">{'> '} 80%</SelectItem>
              <SelectItem value="done">Concluídos</SelectItem>
            </SelectContent>
          </Select>
          <div id="personal-goals-hint" className="text-xs text-muted-foreground mt-1">
            Dica: pressione <kbd className="px-1 py-0.5 border rounded">/</kbd> para focar o seletor
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goalProgress
          .filter((g) => {
            const pct = Number((g as any).progress_percentage ?? 0);
            if (filterStatus === 'progress') return pct < 80;
            if (filterStatus === 'warn') return pct >= 80 && pct < 100;
            if (filterStatus === 'done') return pct >= 100;
            return true;
          })
          .map((goal) => {
          const isCompleted = (goal as any).progress_percentage >= 100;
          const remaining = Math.max((goal.valor_objetivo ?? 0) - (goal.total_alocado ?? 0), 0);

           return (
             <Card 
               key={goal.goal_id} 
               className={`hover:shadow-lg transition-shadow ${
                 isCompleted ? 'border-green-200 bg-green-50' : ''
               }`}
             >
              <CardHeader>
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2">
                      {isCompleted ? (
                        <Trophy className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <Target className="h-5 w-5 text-blue-600" />
                      )}
                      {goal.nome}
                      {!isCompleted && goal.progresso_percentual >= 80 && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Quase</Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-1">
                      {!isCompleted ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAllocateToGoal(goal)}
                            className="h-8 w-8 p-0"
                            aria-label="Alocar ao objetivo"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {goal.total_alocado > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeallocateFromGoal(goal)}
                              className="h-8 w-8 p-0"
                              aria-label="Desalocar do objetivo"
                            >
                              –
                            </Button>
                          )}
                        </>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="h-8 w-8 p-0 opacity-50 cursor-not-allowed"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Objetivo já atingido! Edite o valor objetivo ou o valor atual para continuar.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditGoal(goal)}
                        className="h-8 w-8 p-0"
                        aria-label="Editar objetivo"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGoal(goal.goal_id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        aria-label="Eliminar objetivo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {isCompleted && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 w-fit">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Atingido
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className={`font-medium ${isCompleted ? 'text-green-600' : ''}`}>
                      {goal.progresso_percentual}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(goal.progresso_percentual, 100)} 
                    className={`h-2 ${isCompleted ? 'bg-green-100' : ''}`}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className={isCompleted ? 'text-green-600 font-medium' : ''}>
                      {isCompleted ? 'Objetivo Atingido! 🎉' : getProgressText(goal.progresso_percentual)}
                    </span>
                    <span className="text-right">
                      {formatCurrency(goal.total_alocado ?? 0)} / {formatCurrency(goal.valor_objetivo ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Values */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Objetivo</span>
                    <span className="font-medium">{formatCurrency(goal.valor_objetivo ?? 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Alocado</span>
                    <span className={`font-medium ${isCompleted ? 'text-green-600' : 'text-green-600'}`}>
                      {formatCurrency(goal.total_alocado ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Restante</span>
                    <span className={`font-medium ${isCompleted ? 'text-green-600' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {isCompleted ? '0,00€' : formatCurrency(remaining)}
                    </span>
                  </div>
                </div>

                {/* Funding automático */}
                <ErrorBoundary>
                  <LazyWrapper fallback={<div className="text-sm text-muted-foreground">A carregar funding…</div>}>
                    <GoalFundingSection goalId={goal.goal_id} canEdit={canEditGoal} />
                  </LazyWrapper>
                </ErrorBoundary>

                {/* Histórico de alterações (Audit Log) */}
                <Accordion type="single" collapsible className="pt-2">
                  <AccordionItem value={`hist-${goal.goal_id}`}>
                    <AccordionTrigger>Histórico</AccordionTrigger>
                    <AccordionContent>
                      <PersonalGoalAuditList goalId={goal.goal_id} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {isCompleted && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium">Parabéns! Objetivo atingido com sucesso!</span>
                    </div>
                    <p className="text-xs text-green-600 mt-1 leading-relaxed">
                      Para continuar a alocar valores, edite o objetivo e aumente o valor alvo ou reduza o valor atual.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {goalProgress.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Nenhum objetivo encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Cria o teu primeiro objetivo para começar a poupar
          </p>
          {canEditGoal && (
            <Button onClick={handleCreateGoal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Objetivo
            </Button>
          )}
        </div>
      )}

      {/* Create Goal Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Objetivo</DialogTitle>
            <DialogDescription>
              Cria um novo objetivo financeiro
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            onSuccess={() => {
              setShowCreateModal(false);
              refetchAll();
            }}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Goal Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Objetivo</DialogTitle>
            <DialogDescription>
              Edita os dados do objetivo
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            initialData={editingGoal}
            onSuccess={() => {
              setShowEditModal(false);
              setEditingGoal(null);
              refetchAll();
            }}
            onCancel={() => {
              setShowEditModal(false);
              setEditingGoal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Allocation Modal */}
      {selectedGoal && (
        <GoalAllocationModal
          isOpen={showAllocationModal}
          onClose={handleAllocationSuccess}
          goalId={selectedGoal.goal_id}
          goalName={selectedGoal.nome}
          currentProgress={selectedGoal.total_alocado}
          targetAmount={selectedGoal.valor_objetivo}
          canEdit={canEditGoal}
        />
      )}

      {/* Deallocation Modal */}
      {selectedGoal && (
        <GoalDeallocationModal
          isOpen={showDeallocationModal}
          onClose={() => { setShowDeallocationModal(false); setSelectedGoal(null); }}
          goalId={selectedGoal.goal_id}
          goalName={selectedGoal.nome}
          canEdit={canEditGoal}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel}
        title={confirmation.options.title}
        message={confirmation.options.message}
        confirmText={confirmation.options.confirmText}
        cancelText={confirmation.options.cancelText}
        variant={confirmation.options.variant}
      />
      

    </div>
  );
};

export default PersonalGoals;

// Histórico de alterações para Objetivo Pessoal
const PersonalGoalAuditList: React.FC<{ goalId: string }> = ({ goalId }) => {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await getAuditLogsByRow('goals', goalId, 20);
        if (!cancelled) {
          if (!error && Array.isArray(data)) setEntries(data as unknown as AuditEntry[]);
          else setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [goalId]);

  if (loading && !entries) return <div className="text-sm text-muted-foreground">A carregar histórico…</div>;
  if (!entries || entries.length === 0) return <div className="text-sm text-muted-foreground">Sem alterações registadas.</div>;

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const oldName = e.old_data?.nome; const newName = e.new_data?.nome;
        const oldTarget = e.old_data?.valor_objetivo; const newTarget = e.new_data?.valor_objetivo;
        return (
          <div key={e.id} className="text-xs border rounded p-2">
            <div className="flex justify-between">
              <span className="font-medium">{new Date(e.timestamp).toLocaleString('pt-PT')}</span>
              <span className="uppercase text-muted-foreground">{e.operation}</span>
            </div>
            <div className="mt-1">
              {oldName !== newName && (
                <div>Nome: {oldName ?? '—'} → {newName ?? '—'}</div>
              )}
              {oldTarget !== newTarget && (
                <div>Valor objetivo: {oldTarget ?? '—'} → {newTarget ?? '—'}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};