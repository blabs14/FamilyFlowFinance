import React, { useState } from 'react';
import { useFamily } from '../features/family/FamilyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useGoals, useGoalProgress, useDeleteGoal, useCreateGoal, useUpdateGoal } from '../hooks/useGoalsQuery';
import { useToast } from '../hooks/use-toast';
import { formatCurrency } from '../lib/utils';
import { Target, Plus, Edit, Trash2, Calendar, CheckCircle, Trophy } from 'lucide-react';
import { GoalAllocationModal } from '../components/GoalAllocationModal';
import GoalForm from '../components/GoalForm';
import { GoalProgress, Goal } from '../integrations/supabase/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';

export default function Goals() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<GoalProgress | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  const { data: goals = [], isLoading, error, refetch } = useGoals();
  const { data: goalProgress = [] } = useGoalProgress();
  const deleteGoalMutation = useDeleteGoal();
  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const { toast } = useToast();
  const confirmation = useConfirmation();
  const { canEdit, canDelete } = useFamily();

  const handleCreateGoal = () => {
    setShowCreateModal(true);
  };

  const handleAllocationSuccess = () => {
    setShowAllocationModal(false);
    setSelectedGoal(null);
    toast({
      title: 'Alocação realizada',
      description: 'Valor alocado com sucesso ao objetivo!',
    });
  };

  const handleAllocateToGoal = (goal: GoalProgress) => {
    setSelectedGoal(goal);
    setShowAllocationModal(true);
  };

  const handleEditGoal = (goal: GoalProgress) => {
    // Buscar os dados completos do objetivo
    const fullGoal = goals.find(g => g.id === goal.goal_id);
    if (fullGoal) {
      setEditingGoal(fullGoal);
      setShowEditModal(true);
    } else {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do objetivo',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    // Encontrar o objetivo para mostrar informações específicas
    const goal = goalProgress.find(g => g.goal_id === goalId);
    const isCompleted = goal?.progresso_percentual >= 100;
    
    let message = 'Tem a certeza que deseja eliminar este objetivo? Esta ação não pode ser desfeita.';
    
    if (goal) {
      if (isCompleted) {
        message = `O objetivo "${goal.nome}" foi atingido a 100%. Ao eliminar, o valor alocado (${formatCurrency(goal.total_alocado)}) será mantido na conta objetivos e não será restituído à conta original.`;
      } else {
        message = `O objetivo "${goal.nome}" está a ${goal.progresso_percentual}%. Ao eliminar, o valor alocado (${formatCurrency(goal.total_alocado)}) será restituído ao saldo disponível da conta original.`;
      }
    }
    
    confirmation.confirm(
      {
        title: 'Eliminar Objetivo',
        message: message,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'destructive',
      },
      async () => {
        try {
          const result = await deleteGoalMutation.mutateAsync(goalId);
          
          if (result && typeof result === 'object') {
            const { goal_name, total_allocated, goal_progress, restored_to_account } = result;
            
            if (restored_to_account) {
              toast({
                title: 'Objetivo eliminado',
                description: `O objetivo "${goal_name}" foi eliminado. ${formatCurrency(total_allocated)} foi restituído à conta original.`,
              });
            } else {
              toast({
                title: 'Objetivo eliminado',
                description: `O objetivo "${goal_name}" foi eliminado. O valor alocado foi mantido na conta objetivos.`,
              });
            }
          } else {
            toast({
              title: 'Objetivo removido',
              description: 'O objetivo foi removido com sucesso.',
            });
          }
        } catch (error: any) {
          toast({
            title: 'Erro ao remover objetivo',
            description: error.message || 'Erro ao remover objetivo',
            variant: 'destructive',
          });
        }
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT');
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 80) return 'bg-yellow-500';
    if (progress >= 50) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const getProgressText = (progress: number) => {
    if (progress >= 100) return 'Concluído';
    if (progress >= 80) return 'Quase concluído';
    if (progress >= 50) return 'A meio caminho';
    return 'A começar';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-red-600">Erro ao carregar objetivos: {error.message}</p>
        <Button onClick={() => refetch()} className="mt-4" aria-label="Tentar carregar objetivos novamente">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Objetivos</h1>
        {canEdit('goal') && (
          <Button onClick={handleCreateGoal} aria-label="Criar novo objetivo financeiro">
            <Plus className="h-4 w-4 mr-2" />
            Novo Objetivo
          </Button>
        )}
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goalProgress.map((goal) => {
          const isCompleted = goal.progresso_percentual >= 100;
          const remaining = Math.max(goal.valor_objetivo - goal.total_alocado, 0);

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
                    </CardTitle>
                    <div className="flex gap-1">
                      {!isCompleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAllocateToGoal(goal)}
                          className="h-8 w-8 p-0"
                          aria-label="Alocar ao objetivo"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
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
                      {canEdit('goal') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditGoal(goal)}
                          className="h-8 w-8 p-0"
                          aria-label="Editar objetivo"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete('goal') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGoal(goal.goal_id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          aria-label="Eliminar objetivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
                      {formatCurrency(goal.total_alocado)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Restante</span>
                    <span className={`font-medium ${isCompleted ? 'text-green-600' : remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {isCompleted ? '0,00€' : formatCurrency(remaining)}
                    </span>
                  </div>
                </div>

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
          {canEdit('goal') && (
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
}