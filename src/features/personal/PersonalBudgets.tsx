import React, { useState, useEffect } from 'react';
import { usePersonal } from './PersonalProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Progress } from '../../components/ui/progress';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { BarChart3, Plus, Edit, Trash2, Loader2, Target } from 'lucide-react';
import { getCategoryIcon } from '../../lib/utils';
import * as LucideIcons from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { useBudgets } from '../../hooks/useBudgets';
import { useCategoriesDomain } from '../../hooks/useCategoriesQuery';
import { useTransactions } from '../../hooks/useTransactionsQuery';
import { useAuth } from '../../contexts/AuthContext';
import { budgetSchema } from '../../validation/budgetSchema';
import { useToast } from '../../hooks/use-toast';
import { logger } from '../../shared/lib/logger';
import { useConfirmation } from '../../hooks/useConfirmation';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { getAuditLogsByRow } from '../../services/audit_logs';
type AuditEntry = { id: string; timestamp: string; operation: string; old_data?: any; new_data?: any; details?: any };

interface BudgetFormData {
  categoria_id: string;
  valor: string;
  mes: string;
}

const PersonalBudgets: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'warn' | 'over'>('all');
  const [editBudget, setEditBudget] = useState<any | null>(null);
  const [form, setForm] = useState<BudgetFormData>({
    categoria_id: '',
    valor: '',
    mes: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Usar os hooks robustos que já funcionam
  const { budgets, loading, create, update, remove } = useBudgets();
  const { data: categories = [] } = useCategoriesDomain();
  const { data: transactions = [] } = useTransactions();
  const { user } = useAuth();
  const { toast } = useToast();
  const confirmation = useConfirmation();

  // Atalho global '/' coberto por GlobalShortcuts

  const handleNew = () => {
    setEditBudget(null);
    setForm({ categoria_id: '', valor: '', mes: '' });
    setValidationErrors({});
    setModalOpen(true);
  };

  const handleEdit = (budget: any) => {
    setEditBudget(budget);
    setForm({
      categoria_id: budget.categoria_id || '',
      valor: ((budget.amount_cents || 0) / 100).toString() || '',
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
    } catch (error: any) {
      const errors: Record<string, string> = {};
      error.errors?.forEach((err: any) => {
        if (err.path) {
          errors[err.path[0]] = err.message;
        }
      });
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
      const monthStr = (form.mes || '').slice(0, 7); // garantir YYYY-MM
      const payload = {
        categoria_id: form.categoria_id,
        amount_cents: Math.round(parseFloat(form.valor) * 100),
        mes: monthStr,
      } as const;

      if (editBudget) {
        const result = await update(editBudget.id, payload, user.id);
        if (result.error) {
          toast({
            title: "Erro",
            description: result.error?.message || 'Erro ao atualizar orçamento',
            variant: "destructive",
          });
          logger.error('[PersonalBudgets] update budget error:', result.error);
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
            description: result.error?.message || 'Erro ao criar orçamento',
            variant: "destructive",
          });
          logger.error('[PersonalBudgets] create budget error:', result.error);
        } else {
          toast({
            title: "Sucesso",
            description: "Orçamento criado com sucesso",
          });
          handleClose();
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error?.message || "Erro inesperado",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
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
    } catch (error) {
      return monthString;
    }
  };

  // Calcular gastos reais baseados nas transações
  const getGastoForBudget = (budget: any) => {
    if (!transactions || transactions.length === 0) {
      return 0;
    }

    // Filtrar transações que são despesas, da mesma categoria e do mesmo mês
    const budgetTransactions = transactions.filter((transaction: any) => {
      const transactionDate = new Date(transaction.data);
      const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      
      return (
        transaction.tipo === 'despesa' &&
        transaction.categoria_id === budget.categoria_id &&
        transactionMonth === budget.mes
      );
    });

    // Somar todos os valores das transações filtradas
    const totalGasto = budgetTransactions.reduce((sum: number, transaction: any) => {
      return sum + (transaction.amount_cents || 0) / 100;
    }, 0);

    return totalGasto;
  };

  if (loading) {
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
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Orçamentos Pessoais
          </h2>
          <p className="text-sm text-muted-foreground">
            Seus orçamentos mensais por categoria
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Filtros rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="personal-budgets-month">Filtrar por mês</Label>
          <Input id="personal-budgets-month" type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} aria-describedby="personal-budgets-month-hint" />
          <div id="personal-budgets-month-hint" className="text-xs text-muted-foreground mt-1">
            Dica: pressione <kbd className="px-1 py-0.5 border rounded">/</kbd> para focar
          </div>
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ok">Dentro</SelectItem>
              <SelectItem value="warn">{'>'} 80%</SelectItem>
              <SelectItem value="over">Ultrapassado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Budgets Grid */}
      {budgets.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Nenhum orçamento encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Clica em "Novo Orçamento" para começar
          </p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Orçamento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets
            .filter((b) => !filterMonth || b.mes === filterMonth)
            .filter((b) => {
              const gasto = getGastoForBudget(b);
              const bVal = (b.amount_cents || 0) / 100;
              const pct = getProgressPercentage(gasto, bVal);
              if (filterStatus === 'ok') return pct < 80;
              if (filterStatus === 'warn') return pct >= 80 && pct < 100;
              if (filterStatus === 'over') return pct >= 100;
              return true;
            })
            .map((budget) => {
              const gasto = getGastoForBudget(budget);
              const budgetValor = (budget.amount_cents || 0) / 100;
              const percentage = getProgressPercentage(gasto, budgetValor);
              const progressColor = getProgressColor(percentage);

              return (
                <Card key={budget.id} className="hover:shadow-md transition-shadow h-fit">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium truncate flex-1 mr-2">
                      {getCategoryName(budget.categoria_id)}
                    </CardTitle>
                    {gasto > budgetValor && (
                      <Badge variant="destructive" className="mr-2">Over</Badge>
                    )}
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
                        <Badge variant="secondary" className="text-xs">
                          {formatMonth(budget.mes)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Orçamento</span>
                        <span className="font-medium">{formatCurrency(budgetValor)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Gasto</span>
                        <span className={`font-medium ${
                          gasto === 0 ? 'text-gray-600' :
                          gasto > budgetValor ? 'text-red-600' : 'text-green-600'
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
 
                    {/* Histórico de alterações (Audit Log) */}
                    <Accordion type="single" collapsible className="pt-2">
                      <AccordionItem value={`hist-${budget.id}`}>
                        <AccordionTrigger>Histórico</AccordionTrigger>
                        <AccordionContent>
                          <PersonalBudgetAuditList budgetId={budget.id} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
 
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(budget)}
                        className="flex-1"
                        aria-label="Editar orçamento"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(budget.id)}
                        className="text-red-600 hover:text-red-700 flex-1"
                        aria-label="Eliminar orçamento"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Create/Edit Budget Modal */}
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
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

export default PersonalBudgets;

// Histórico de alterações para Orçamento Pessoal
const PersonalBudgetAuditList: React.FC<{ budgetId: string }> = ({ budgetId }) => {
  const [entries, setEntries] = React.useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await getAuditLogsByRow('budgets', budgetId, 20);
        if (!cancelled) {
          if (!error && Array.isArray(data)) setEntries(data);
          else setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [budgetId]);

  if (loading && !entries) return <div className="text-sm text-muted-foreground">A carregar histórico…</div>;
  if (!entries || entries.length === 0) return <div className="text-sm text-muted-foreground">Sem alterações registadas.</div>;

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const oldValue = e.old_data?.valor; const newValue = e.new_data?.valor;
        const oldMonth = e.old_data?.mes; const newMonth = e.new_data?.mes;
        return (
          <div key={e.id} className="text-xs border rounded p-2">
            <div className="flex justify-between">
              <span className="font-medium">{new Date(e.timestamp).toLocaleString('pt-PT')}</span>
              <span className="uppercase text-muted-foreground">{e.operation}</span>
            </div>
            <div className="mt-1">
              {oldValue !== newValue && (
                <div>Valor: {oldValue ?? '—'} → {newValue ?? '—'}</div>
              )}
              {oldMonth !== newMonth && (
                <div>Período: {oldMonth ?? '—'} → {newMonth ?? '—'}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};