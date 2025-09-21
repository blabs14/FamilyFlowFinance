import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../features/family/FamilyContext';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { Button } from './ui/button';
import { LoadingSpinner } from './ui/loading-states';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { useTransactions, useDeleteTransaction } from '../hooks/useTransactionsQuery';
import { useReferenceData } from '../hooks/useCache';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from './ui/confirmation-dialog';
import { useToast } from '../hooks/use-toast';
import { notifySuccess, notifyError } from '../lib/notify';
import { Trash2, Edit, Eye, ChevronLeft, ChevronRight, Search, Filter, Calendar, ChevronDown } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatCurrency } from '../lib/utils';
import { logger } from '@/shared/lib/logger';

type TransactionItem = {
  id: string;
  account_id: string;
  categoria_id: string;
  tipo: string;
  valor: number;
  descricao?: string;
  data: string;
};

const TransactionList = ({ 
  onEdit, 
  onMetricsUpdate 
}: { 
  onEdit?: (tx: TransactionItem) => void;
  onMetricsUpdate?: (metrics: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
  }) => void;
}) => {
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { accounts, categories } = useReferenceData();
  const deleteTransactionMutation = useDeleteTransaction();
  const confirmation = useConfirmation();
  const { canEdit, canDelete } = useFamily();
  const { toast } = useToast();
  
  // Debug: Component rendered
  
  // Estado para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Estado para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [excludeTransfers, setExcludeTransfers] = useState(true);

  const loading = transactionsLoading || accounts.isLoading || categories.isLoading;
  const accountsData = Array.isArray(accounts.data) ? accounts.data : [];
  const categoriesData = Array.isArray(categories.data) ? categories.data : [];

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
      
      // Excluir transferências (opcional)
      if (excludeTransfers && transaction.tipo === 'transferencia') return false;
      
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
  }, [transactions, searchTerm, selectedAccount, selectedCategory, selectedType, dateFilter, dateRange, excludeTransfers]);

  // Calcular paginação
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Debug: Pagination info

  // Resetar página quando filtros mudam
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedAccount, selectedCategory, selectedType, dateFilter, dateRange, excludeTransfers]);

  // Resetar página quando o número de transações muda (nova transação criada)
  React.useEffect(() => {
    // Debug: Resetting to page 1
    setCurrentPage(1);
  }, [transactions.length]);

  // Atalho global '/' coberto por GlobalShortcuts

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

  // Calcular e enviar métricas filtradas
  React.useEffect(() => {
    if (onMetricsUpdate) {
      const filteredIncome = filteredTransactions
        .filter(t => t.tipo === 'receita')
        .reduce((sum, t) => {
          const valor = typeof t.valor === 'number' ? t.valor : parseFloat(t.valor) || 0;
          return sum + valor;
        }, 0);

      const filteredExpenses = filteredTransactions
          .filter(t => t.tipo === 'despesa')
          .reduce((sum, t) => {
            const valor = typeof t.valor === 'number' ? t.valor : parseFloat(t.valor) || 0;
            return sum + valor;
          }, 0);

      const filteredNetBalance = filteredIncome - filteredExpenses;
      const filteredCount = filteredTransactions.length;

      onMetricsUpdate({
        totalIncome: filteredIncome,
        totalExpenses: filteredExpenses,
        netBalance: filteredNetBalance,
        transactionCount: filteredCount
      });
    }
  }, [filteredTransactions, onMetricsUpdate]);



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT');
  };

  // Função para obter o texto do filtro de data
  const getDateFilterText = () => {
    if (dateFilter === 'all') return 'Todas as datas';
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).toLocaleDateString('pt-PT');
      const end = new Date(dateRange.end).toLocaleDateString('pt-PT');
      return `${start} - ${end}`;
    }
    
    const today = new Date();
    switch (dateFilter) {
      case 'today':
        return 'Hoje';
      case 'this-week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return `${startOfWeek.toLocaleDateString('pt-PT')} - ${endOfWeek.toLocaleDateString('pt-PT')}`;
      }
      case 'this-month':
        return `${today.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`;
      case 'this-year':
        return `${today.getFullYear()}`;
      case 'last-week': {
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        return `${lastWeekStart.toLocaleDateString('pt-PT')} - ${lastWeekEnd.toLocaleDateString('pt-PT')}`;
      }
      case 'last-month': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return `${lastMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`;
      }
      default:
        return 'Todas as datas';
    }
  };

  const handleDelete = (transactionId: string) => {
    confirmation.confirm(
      {
        title: 'Eliminar Transação',
        message: 'Tem a certeza que deseja eliminar esta transação? Esta ação não pode ser desfeita.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'destructive',
      },
      async () => {
        try {
          await deleteTransactionMutation.mutateAsync(transactionId as any);
          notifySuccess({ title: 'Transação eliminada', description: 'A transação foi eliminada com sucesso.' });
        } catch (e) {
          notifyError({ title: 'Erro ao eliminar', description: 'Não foi possível eliminar a transação.' });
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">A carregar transações...</span>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Nenhuma transação encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Pesquisa */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Pesquisar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Descrição..."
                value={searchTerm}
                onChange={(e) => {
                  try {
                    setSearchTerm(e.target.value);
                  } catch (error) {
                    logger.error('Erro ao atualizar searchTerm:', error);
                  }
                }}
                className="pl-10"
                aria-describedby="txlist-search-hint"
              />
              <div id="txlist-search-hint" className="text-xs text-muted-foreground mt-1">
                Dica: pressione <kbd className="px-1 py-0.5 border rounded">/</kbd> para pesquisar
              </div>
            </div>
          </div>

          {/* Filtro por Conta */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Conta</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accountsData.map((account) => (
                  <SelectItem key={account.account_id} value={account.account_id}>
                    {account.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Categoria */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Categoria</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tipo</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Data */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Data</label>
            <div className="relative date-picker-container">
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {getDateFilterText()}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              
              {showDatePicker && (
                <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-300 rounded-md shadow-lg">
                  <div className="p-4">
                    <div className="space-y-3">
                      {/* Filtros rápidos */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Filtros Rápidos</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setDateFilter('today');
                              setDateRange({ start: '', end: '' });
                              setShowDatePicker(false);
                            }}
                            className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          >
                            Hoje
                          </button>
                          <button
                            onClick={() => {
                              setDateFilter('this-week');
                              setDateRange({ start: '', end: '' });
                              setShowDatePicker(false);
                            }}
                            className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          >
                            Esta semana
                          </button>
                          <button
                            onClick={() => {
                              setDateFilter('this-month');
                              setDateRange({ start: '', end: '' });
                              setShowDatePicker(false);
                            }}
                            className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          >
                            Este mês
                          </button>
                          <button
                            onClick={() => {
                              setDateFilter('this-year');
                              setDateRange({ start: '', end: '' });
                              setShowDatePicker(false);
                            }}
                            className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          >
                            Este ano
                          </button>
                          <button
                            onClick={() => {
                              setDateFilter('last-week');
                              setDateRange({ start: '', end: '' });
                              setShowDatePicker(false);
                            }}
                            className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          >
                            Semana passada
                          </button>
                          <button
                            onClick={() => {
                              setDateFilter('last-month');
                              setDateRange({ start: '', end: '' });
                              setShowDatePicker(false);
                            }}
                            className="text-left px-3 py-2 text-sm rounded hover:bg-gray-100"
                          >
                            Mês passado
                          </button>
                        </div>
                      </div>
                      
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Intervalo Personalizado</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Data Inicial</label>
                            <input
                              type="date"
                              value={dateRange.start}
                              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Data Final</label>
                            <input
                              type="date"
                              value={dateRange.end}
                              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => {
                                if (dateRange.start && dateRange.end) {
                                  setDateFilter('custom');
                                  setShowDatePicker(false);
                                }
                              }}
                              className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              disabled={!dateRange.start || !dateRange.end}
                            >
                              Aplicar
                            </button>
                            <button
                              onClick={() => {
                                setDateFilter('all');
                                setDateRange({ start: '', end: '' });
                                setShowDatePicker(false);
                              }}
                              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Excluir Transferências */}
          <div className="space-y-2 flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={excludeTransfers} onChange={(e) => setExcludeTransfers(e.target.checked)} />
              Excluir transferências
            </label>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">&nbsp;</label>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedAccount('all');
                setSelectedCategory('all');
                setSelectedType('all');
                setDateFilter('all');
                setDateRange({ start: '', end: '' });
                setExcludeTransfers(true);
                setShowDatePicker(false);
              }}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Resumo de filtros ativos */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {excludeTransfers && (<Badge variant="outline">Sem transferências</Badge>)}
          {selectedAccount !== 'all' && (
            <Badge variant="secondary">Conta filtrada</Badge>
          )}
          {selectedCategory !== 'all' && (
            <Badge variant="secondary">Categoria filtrada</Badge>
          )}
          {selectedType !== 'all' && (
            <Badge variant="secondary">Tipo: {selectedType}</Badge>
          )}
          {dateFilter !== 'all' || (dateRange.start && dateRange.end) ? (
            <Badge variant="outline">Período: {getDateFilterText()}</Badge>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="max-h-[50vh] sm:max-h-[60vh] lg:max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTransactions.map((transaction) => {
                const account = accountsData.find(acc => acc.account_id === transaction.account_id);
                const category = categoriesData.find(cat => cat.id === transaction.categoria_id);

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {formatDate(transaction.data)}
                    </TableCell>
                    <TableCell>{transaction.descricao}</TableCell>
                    <TableCell>
                      {category ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {category.nome}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {account ? (
                        <span className="text-sm text-gray-600">{account.nome}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${
                        transaction.tipo === 'transferencia' ? 'text-blue-600' :
                        transaction.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.tipo === 'transferencia' ? '' :
                          (transaction.tipo === 'receita' ? '+' : '-')
                        }{formatCurrency(transaction.valor, 'pt-PT', 'EUR')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {onEdit && canEdit('transaction') && (
                          <button
                            onClick={() => onEdit(transaction)}
                            className="text-gray-500 hover:text-gray-700 p-1"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete('transaction') && (
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            disabled={deleteTransactionMutation.isPending}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Controles de Paginação */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t">
        <div className="text-sm text-gray-700">
          Mostrando {startIndex + 1} a {Math.min(endIndex, filteredTransactions.length)} de {filteredTransactions.length} transações
          {currentPage > 1 && (
            <span className="ml-2 text-blue-600">
              (Nova transação criada - <button 
                onClick={() => setCurrentPage(1)} 
                className="underline hover:no-underline"
              >
                ir para primeira página
              </button>)
            </span>
          )}
          {filteredTransactions.length > 20 && currentPage === 1 && (
            <span className="ml-2 text-green-600">
              (Há {filteredTransactions.length - 20} transações mais recentes)
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="text-sm text-gray-700">
            Página {currentPage} de {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

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

export default TransactionList;