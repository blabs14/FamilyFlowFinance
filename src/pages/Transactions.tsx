import React, { useState, useEffect } from 'react';
import TransactionList from '../components/TransactionList';
import TransactionForm from '../components/TransactionForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Plus, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Calendar
} from 'lucide-react';
import { useTransactions } from '../hooks/useTransactionsQuery';
import { useAccountsDomain } from '../hooks/useAccountsQuery';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../features/family/FamilyContext';
// exportReport será carregado dinamicamente no ponto de uso
import { formatCurrency } from '../lib/utils';
import { useToast } from '../hooks/use-toast';
import { logger } from '../shared/lib/logger';

type TransactionItem = {
  id: string;
  account_id: string;
  categoria_id: string;
  tipo: string;
  valor: number;
  descricao: string; // obrigatória para alinhar com TransactionFormData
  data: string;
};

const TransactionsPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<TransactionItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const { data: transactions = [], isLoading } = useTransactions();
  const { data: accounts = [] } = useAccountsDomain();
  const { data: categories = [] } = useCategoriesDomain();
  const { user } = useAuth();
  const { canEdit, canDelete } = useFamily();
  const { toast } = useToast();

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

  const handleEdit = (tx: TransactionItem) => {
    setEditTx(tx);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditTx(null);
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

      const { exportReport } = await import('../services/exportService');
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
    } catch (error: unknown) {
      logger.error('Erro na exportação:', error);
      const message = (error && typeof error === 'object' && 'message' in error) ? String((error as { message?: string }).message) : 'Ocorreu um erro ao exportar o relatório';
      toast({
        title: 'Erro na exportação',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Estado para métricas filtradas
  const [filteredMetrics, setFilteredMetrics] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    transactionCount: 0
  });

  // Calcular métricas totais (sem filtros)
  const totalIncome = transactions
    .filter(t => t.tipo === 'receita')
    .reduce((sum, t) => {
      const valor = typeof t.valor === 'number' ? t.valor : parseFloat(t.valor) || 0;
      return sum + valor;
    }, 0);

  const totalExpenses = transactions
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => {
        const valor = typeof t.valor === 'number' ? t.valor : parseFloat(t.valor) || 0;
        return sum + valor;
      }, 0);

  const netBalance = totalIncome - totalExpenses;
  const transactionCount = transactions.length;

  // Inicializar métricas filtradas com valores totais
  React.useEffect(() => {
    setFilteredMetrics({
      totalIncome,
      totalExpenses,
      netBalance,
      transactionCount
    });
  }, [totalIncome, totalExpenses, netBalance, transactionCount]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Transações</h1>
          <p className="text-muted-foreground">
            Gerencie suas transações financeiras
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
          {canEdit('transaction') && (
            <Button onClick={handleNew} aria-label="Criar nova transação">
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Receitas</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(filteredMetrics.totalIncome)}</p>
                {filteredMetrics.totalIncome !== totalIncome && (
                  <p className="text-xs text-muted-foreground">Filtrado de {formatCurrency(totalIncome)}</p>
                )}
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Despesas</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(filteredMetrics.totalExpenses)}</p>
                {filteredMetrics.totalExpenses !== totalExpenses && (
                  <p className="text-xs text-muted-foreground">Filtrado de {formatCurrency(totalExpenses)}</p>
                )}
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Saldo Líquido</p>
                <p className={`text-2xl font-bold ${filteredMetrics.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(filteredMetrics.netBalance)}
                </p>
                {filteredMetrics.netBalance !== netBalance && (
                  <p className="text-xs text-muted-foreground">Filtrado de {formatCurrency(netBalance)}</p>
                )}
              </div>
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Transações</p>
                <p className="text-2xl font-bold">{filteredMetrics.transactionCount}</p>
                {filteredMetrics.transactionCount !== transactionCount && (
                  <p className="text-xs text-muted-foreground">Filtrado de {transactionCount}</p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Transações */}
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          <TransactionList 
            key={refreshKey} 
            onEdit={handleEdit}
            onMetricsUpdate={setFilteredMetrics}
          />
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
    </div>
  );
};

export default TransactionsPage;