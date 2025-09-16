import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Plus, Edit, Trash2, Loader2, BarChart3 } from 'lucide-react';
import { getCategoryIcon } from '../lib/utils';
import * as LucideIcons from 'lucide-react';
import { useBudgets } from '../hooks/useBudgets';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { useTransactions } from '../hooks/useTransactionsQuery';
import { useAuth } from '../contexts/AuthContext';
import { budgetSchema } from '../validation/budgetSchema';
import { useToast } from '../hooks/use-toast';
import { z } from 'zod';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';
import { useFamily } from '../features/family/FamilyContext';
import type { Budget, Transaction } from '../integrations/supabase/types';

interface BudgetFormData {
  categoria_id: string;
  valor: string;
  mes: string;
}

const BudgetsPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<any | null>(null);
  const [form, setForm] = useState<BudgetFormData>({
    categoria_id: '',
    valor: '',
    mes: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { budgets, loading, create, update, remove } = useBudgets();
  const { data: categories = [] } = useCategoriesDomain();
  const { data: transactions = [] } = useTransactions();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirmation = useConfirmation();
  const { canEdit, canDelete } = useFamily();

  const handleNew = () => {
    setEditBudget(null);
    setForm({ categoria_id: '', valor: '', mes: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleEdit = (budget: Budget) => {
    setEditBudget(budget);
    setForm({
      categoria_id: budget.categoria_id || '',
      valor: budget.valor?.toString() || '',
      mes: budget.mes || '',
    });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditBudget(null);
    setForm({ categoria_id: '', valor: '', mes: '' });
    setValidationErrors({});
    setIsSubmitting(false);
  };

  const handleChange = (field: keyof BudgetFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    try {
      budgetSchema.parse({
        ...form,
        valor: parseFloat(form.valor) || 0,
      });
      setValidationErrors({});
      return true;
    } catch (error) {
      const errors: Record<string, string> = {};
      if (error instanceof z.ZodError) {
        error.errors?.forEach((err) => {
          if (err.path) {
            errors[err.path[0] as string] = err.message;
          }
        });
      }
      setValidationErrors(errors);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Utilizador não autenticado",
        variant: "destructive",
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        categoria_id: form.categoria_id,
        valor: parseFloat(form.valor),
        mes: form.mes,
      };

      if (editBudget) {
        const result = await update(editBudget.id, payload, user.id);
        if (result.error) {
          toast({
            title: "Erro",
            description: "Erro ao atualizar orçamento",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sucesso",
            description: "Orçamento atualizado com sucesso",
          });
          handleClose();
        }
      } else {
        const result = await create(payload, user.id);
        if (result.error) {
          toast({
            title: "Erro",
            description: "Erro ao criar orçamento",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sucesso",
            description: "Orçamento criado com sucesso",
          });
          handleClose();
        }
      }
    } catch {
      toast({
        title: "Erro",
        description: "Erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Utilizador não autenticado",
        variant: "destructive",
      });
      return;
    }

    confirmation.confirm(
      {
        title: 'Eliminar Orçamento',
        message: 'Tem a certeza que deseja eliminar este orçamento? Esta ação não pode ser desfeita.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'destructive',
      },
      async () => {
        const result = await remove(id, user.id);
        if (result.error) {
          toast({
            title: "Erro",
            description: "Erro ao remover orçamento",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sucesso",
            description: "Orçamento removido com sucesso",
          });
        }
      }
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const getProgressPercentage = (gasto: number, valor: number) => {
    return Math.min((gasto / valor) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage === 0) return 'bg-gray-300'; // Sem gastos
    if (percentage >= 100) return 'bg-red-500'; // Ultrapassado
    if (percentage >= 80) return 'bg-yellow-500'; // Quase a ultrapassar
    return 'bg-green-500'; // Dentro do orçamento
  };

  const getCategoryName = (categoriaId: string) => {
    const category = categories.find(cat => cat.id === categoriaId);
    return category?.nome || 'Categoria não encontrada';
  };

  const formatMonth = (monthString: string) => {
    if (!monthString) return 'Período não definido';
    
    try {
      const [year, month] = monthString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('pt-PT', { 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return monthString;
    }
  };

  // Calcular gastos reais baseados nas transações
  const getGastoForBudget = (budget: Budget) => {
    if (!transactions || transactions.length === 0) {
      return 0;
    }

    // Filtrar transações que são despesas, da mesma categoria e do mesmo mês
    const budgetTransactions = transactions.filter((transaction: Transaction) => {
      const transactionDate = new Date(transaction.data);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      
      return (
        transaction.tipo === 'despesa' &&
        transaction.categoria_id === budget.categoria_id &&
        transactionMonth === budget.mes
      );
    });

    // Somar todos os valores das transações filtradas
    const totalGasto = budgetTransactions.reduce((sum: number, transaction: Transaction) => {
      return sum + (Number(transaction.valor) || 0);
    }, 0);

    return totalGasto;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Cabeçalho Fixo - Sempre visível */}
      <div className="flex-shrink-0 bg-background border-b p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Orçamentos</h1>
          {canEdit('budget') && (
            <Button onClick={handleNew} className="w-full sm:w-auto" aria-label="Criar novo orçamento">
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          )}
        </div>
      </div>
      
      {/* Conteúdo com Scroll apenas nos dados */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>A carregar orçamentos...</span>
              </div>
            </div>
          ) : budgets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum orçamento encontrado</p>
                <p className="text-sm">Clica em "Novo Orçamento" para começar</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto">
                {budgets.map((budget) => {
                  const gasto = getGastoForBudget(budget);
                  const percentage = getProgressPercentage(gasto, budget.valor);
                  const progressColor = getProgressColor(percentage);
                  
                  return (
                    <Card key={budget.id} className="hover:shadow-md transition-shadow h-fit">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                          <CardTitle className="text-sm font-medium truncate flex-1 mr-2">
                    {getCategoryName(budget.categoria_id)}
                  </CardTitle>
                  {(() => {
                    const categoryName = getCategoryName(budget.categoria_id);
                    const iconName = getCategoryIcon(categoryName);
                    const IconComponent = (LucideIcons as Record<string, React.ComponentType<any>>)[iconName] || LucideIcons.Target;
                    return <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
                  })()}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Período</span>
                            <span className="text-sm font-medium text-blue-600">
                              {formatMonth(budget.mes)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Orçamento</span>
                            <span className="font-medium">{formatCurrency(budget.valor)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Gasto</span>
                            <span className={`font-medium ${
                              gasto === 0 ? 'text-gray-600' : 
                              gasto > budget.valor ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {formatCurrency(gasto)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progresso</span>
                            <span>{percentage.toFixed(1)}%</span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className={`h-2 ${progressColor}`}
                          />
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          {canEdit('budget') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(budget)}
                              className="flex-1"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Editar
                            </Button>
                          )}
                          {canDelete('budget') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(budget.id)}
                              className="text-red-600 hover:text-red-700 flex-1"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remover
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBudget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
            <DialogDescription>
              {editBudget ? 'Editar dados do orçamento' : 'Criar novo orçamento'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={form.categoria_id} onValueChange={(value) => handleChange('categoria_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {validationErrors.categoria_id && (
                <div className="text-red-600 text-sm">{validationErrors.categoria_id}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor (€)</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.valor}
                onChange={(e) => handleChange('valor', e.target.value)}
              />
              {validationErrors.valor && (
                <div className="text-red-600 text-sm">{validationErrors.valor}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mes">Mês</Label>
              <Input
                id="mes"
                type="month"
                value={form.mes}
                onChange={(e) => handleChange('mes', e.target.value)}
              />
              {validationErrors.mes && (
                <div className="text-red-600 text-sm">{validationErrors.mes}</div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editBudget ? 'A guardar...' : 'A criar...'}
                  </>
                ) : (
                  editBudget ? 'Guardar' : 'Criar'
                )}
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting} aria-label="Cancelar criação de orçamento">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

export default BudgetsPage;