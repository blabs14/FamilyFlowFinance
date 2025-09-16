import React, { useState, useEffect } from 'react';
import { usePersonal } from './PersonalProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  TrendingUp, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingDown,
  Download,
  Wallet,
  Calendar,
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { useTransactions, useDeleteTransaction } from '../../hooks/useTransactionsQuery';
import { useAccountsDomain } from '../../hooks/useAccountsQuery';
import { useCategoriesDomain } from '../../hooks/useCategoriesQuery';
import { useReferenceData } from '../../hooks/useCache';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmation } from '../../hooks/useConfirmation';
import { useToast } from '../../hooks/use-toast';
import { notifySuccess, notifyError } from '../../lib/notify';
import TransactionForm from '../../components/TransactionForm';
// exportReport será carregado dinamicamente no ponto de uso
import { formatCurrency } from '../../lib/utils';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';

const PersonalTransactions: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Usar os hooks robustos que já funcionam
  const { data: transactions = [], isLoading } = useTransactions();
  const deleteTransaction = useDeleteTransaction();
  const { data: accounts = [] } = useAccountsDomain();
  const { data: categories = [] } = useCategoriesDomain();
  const { accounts: refAccounts, categories: refCategories } = useReferenceData();
  const { user } = useAuth();
  const confirmation = useConfirmation();
  const { toast } = useToast();

  const accountsData = Array.isArray(refAccounts.data) ? refAccounts.data : [];
  const categoriesData = Array.isArray(refCategories.data) ? refCategories.data : [];

  // Forçar atualização quando o modal fecha
  useEffect(() => {
    if (!modalOpen) {
      setRefreshKey(prev => prev + 1);
    }
  }, [modalOpen]);

  const handleNew = () => {
    setEditTx(null);
    setModalOpen(true);
  };

  const handleEdit = (tx: any) => {
    setEditTx(tx);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditTx(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAccount('all');
    setSelectedCategory('all');
    setSelectedType('all');
    setDateFilter('all');
    setDateRange({ start: '', end: '' });
  };

  const handleExport = async () => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Utilizador não autenticado',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      // Determinar o intervalo de datas baseado nos filtros ou usar o último ano
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { exportReport } = await import('../../services/exportService');
      const { blob, filename } = await exportReport(user.id, {
        format: 'excel',
        dateRange: { start: startDate, end: endDate },
      });

      // Criar link de download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Exportação concluída',
        description: `Relatório exportado como ${filename}`,
      });
    } catch (error: any) {
      // Error logging handled by error boundary
      toast({
        title: 'Erro na exportação',
        description: error.message || 'Ocorreu um erro ao exportar o relatório',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };



  // Calcular métricas totais (sem filtros)
  const totalIncome = transactions
    .filter(t => t.tipo === 'receita')
    .reduce((sum, t) => sum + t.valor, 0);

  const totalExpenses = transactions
    .filter(t => t.tipo === 'despesa')
    .reduce((sum, t) => sum + t.valor, 0);

  const netBalance = totalIncome - totalExpenses;
  const transactionCount = transactions.length;

  // Filtrar transações
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = !searchTerm || 
        (transaction.descricao && transaction.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesAccount = selectedAccount === 'all' || 
        transaction.account_id === selectedAccount;
      
      const matchesCategory = selectedCategory === 'all' || 
        transaction.categoria_id === selectedCategory;
      
      const matchesType = selectedType === 'all' || 
        transaction.tipo === selectedType;
      
      // Filtro por data
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const transactionDate = new Date(transaction.data);
        const today = new Date();
        
        if (dateRange.start && dateRange.end) {
          // Filtro por intervalo de datas personalizado
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          matchesDate = transactionDate >= startDate && transactionDate <= endDate;
        } else {
          // Filtros predefinidos
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
          startOfWeek.setHours(0, 0, 0, 0);
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
          endOfWeek.setHours(23, 59, 59, 999);
          
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
          
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
          
          switch (dateFilter) {
            case 'today': {
              const startOfDay = new Date(today);
              startOfDay.setHours(0, 0, 0, 0);
              const endOfDay = new Date(today);
              endOfDay.setHours(23, 59, 59, 999);
              matchesDate = transactionDate >= startOfDay && transactionDate <= endOfDay;
              break;
            }
            case 'this-week':
              matchesDate = transactionDate >= startOfWeek && transactionDate <= endOfWeek;
              break;
            case 'this-month':
              matchesDate = transactionDate >= startOfMonth && transactionDate <= endOfMonth;
              break;
            case 'this-year':
              matchesDate = transactionDate >= startOfYear && transactionDate <= endOfYear;
              break;
            case 'last-week': {
              const lastWeekStart = new Date(startOfWeek);
              lastWeekStart.setDate(startOfWeek.getDate() - 7);
              const lastWeekEnd = new Date(startOfWeek);
              lastWeekEnd.setDate(startOfWeek.getDate() - 1);
              lastWeekEnd.setHours(23, 59, 59, 999);
              matchesDate = transactionDate >= lastWeekStart && transactionDate <= lastWeekEnd;
              break;
            }
            case 'last-month': {
              const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
              matchesDate = transactionDate >= lastMonthStart && transactionDate <= lastMonthEnd;
              break;
            }
          }
        }
      }
      
      return matchesSearch && matchesAccount && matchesCategory && matchesType && matchesDate;
    });
  }, [transactions, searchTerm, selectedAccount, selectedCategory, selectedType, dateFilter, dateRange]);

  // Remover estado e usar memo para métricas filtradas
  const filteredMetrics = React.useMemo(() => {
    const filteredIncome = filteredTransactions
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => sum + t.valor, 0);

    const filteredExpenses = filteredTransactions
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => sum + t.valor, 0);

    const filteredNetBalance = filteredIncome - filteredExpenses;
    const filteredCount = filteredTransactions.length;

    return {
      totalIncome: filteredIncome,
      totalExpenses: filteredExpenses,
      netBalance: filteredNetBalance,
      transactionCount: filteredCount
    };
  }, [filteredTransactions]);

  const getDateFilterText = () => {
    switch (dateFilter) {
      case 'today': return 'Hoje';
      case 'this-week': return 'Esta semana';
      case 'this-month': return 'Este mês';
      case 'this-year': return 'Este ano';
      case 'last-week': return 'Última semana';
      case 'last-month': return 'Último mês';
      case 'custom': return 'Personalizado';
      default: return 'Todas as datas';
    }
  };

  // Fechar date picker quando clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDatePicker && !target.closest('.date-picker-container')) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  // Atalho global '/' coberto por GlobalShortcuts

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transações Pessoais
          </h2>
          <p className="text-sm text-muted-foreground">
            Histórico das suas transações pessoais
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'A exportar...' : 'Exportar'}
          </Button>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>



      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              disabled={!searchTerm && selectedAccount === 'all' && selectedCategory === 'all' && selectedType === 'all' && dateFilter === 'all'}
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Pesquisa */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="personal-tx-search"
                  placeholder="Pesquisar transações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  aria-describedby="personal-tx-search-hint"
                />
                <div id="personal-tx-search-hint" className="text-xs text-muted-foreground mt-1">
                  Dica: pressione <kbd className="px-1 py-0.5 border rounded">/</kbd> para pesquisar
                </div>
              </div>
            </div>

            {/* Filtro por Conta */}
            <div>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Categoria */}
            <div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categoriesData.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Tipo */}
            <div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="receita">Receitas</SelectItem>
                  <SelectItem value="despesa">Despesas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Data */}
            <div className="relative date-picker-container">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as datas</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="this-week">Esta semana</SelectItem>
                  <SelectItem value="this-month">Este mês</SelectItem>
                  <SelectItem value="this-year">Este ano</SelectItem>
                  <SelectItem value="last-week">Última semana</SelectItem>
                  <SelectItem value="last-month">Último mês</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtro de data personalizado */}
          {dateFilter === 'custom' && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Data inicial</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="end-date">Data final</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Resumo dos filtros ativos */}
          {(searchTerm || selectedAccount !== 'all' || selectedCategory !== 'all' || selectedType !== 'all' || dateFilter !== 'all') && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Filtros ativos:</strong> 
                                 {searchTerm && ` Pesquisa: "${searchTerm}"`}
                 {selectedAccount !== 'all' && ` Conta: ${accounts.find(a => a.id === selectedAccount)?.nome}`}
                 {selectedCategory !== 'all' && ` Categoria: ${categories.find(c => c.id === selectedCategory)?.nome}`}
                 {selectedType !== 'all' && ` Tipo: ${selectedType === 'receita' ? 'Receitas' : 'Despesas'}`}
                 {dateFilter !== 'all' && ` Data: ${getDateFilterText()}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Transações */}
      <Card>
        <CardContent className="pt-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {transactions.length === 0 
                  ? 'Nenhuma transação pessoal encontrada' 
                  : 'Nenhuma transação encontrada com os filtros aplicados'
                }
              </p>
              <Button variant="outline" className="mt-4" onClick={transactions.length === 0 ? handleNew : clearFilters}>
                <Plus className="h-4 w-4 mr-2" />
                {transactions.length === 0 ? 'Registar primeira transação' : 'Limpar filtros'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.slice(0, 50).map((transaction) => (
                <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          transaction.tipo === 'receita' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {transaction.tipo === 'receita' ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.descricao || 'Transação'}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{categories.find(c => c.id === transaction.categoria_id)?.nome || 'Sem categoria'}</span>
                            <span>•</span>
                                                         <span>{accounts.find(a => a.id === transaction.account_id)?.nome || 'Conta'}</span>
                            <span>•</span>
                            <span>{new Date(transaction.data).toLocaleDateString('pt-PT')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`font-bold ${
                            transaction.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.tipo === 'receita' ? '+' : '-'}
                            {(transaction.valor || 0).toFixed(2)}€
                          </p>
                          <Badge variant="outline" className="text-xs">
                            Pessoal
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(transaction)} aria-label="Editar transação">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              confirmation.confirm(
                                {
                                  title: 'Eliminar Transação',
                                  message: 'Tem a certeza que pretende eliminar esta transação? Esta ação não pode ser desfeita.',
                                  confirmText: 'Eliminar',
                                  cancelText: 'Cancelar',
                                  variant: 'destructive',
                                },
                                async () => {
                                  try {
                                    await deleteTransaction.mutateAsync(transaction.id);
                                    notifySuccess({ title: 'Transação eliminada', description: 'A transação foi eliminada com sucesso.' });
                                  } catch (e) {
                                    notifyError({ title: 'Erro ao eliminar', description: 'Não foi possível eliminar a transação.' });
                                  }
                                }
                              );
                            }}
                            aria-label="Eliminar transação"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog 
        open={modalOpen} 
        onOpenChange={(open) => {
          setModalOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTx ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
            <DialogDescription>
              {editTx ? 'Editar dados da transação' : 'Criar nova transação'}
            </DialogDescription>
          </DialogHeader>
          <TransactionForm 
            initialData={editTx || undefined} 
            onSuccess={() => {
              handleClose();
            }} 
            onCancel={handleClose} 
          />
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

export default PersonalTransactions;