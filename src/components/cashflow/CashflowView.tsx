import React, { useState, useEffect } from 'react';
import { Calendar, List, Download, Settings, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/use-toast';
import { CashflowCalendar } from './CashflowCalendar';
import { CashflowList } from './CashflowList';
import { CashflowFilters, DailyCashflowSummary, CashflowScope } from '../../types/cashflow';
import { cashflowService } from '../../services/cashflowService';
import { exportCashflowData, filterCashflowEventsByDateRange, filterCashflowSummariesByDateRange, CashflowExportOptions } from '../../services/exportService';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '@/shared/lib/logger';

interface CashflowViewProps {
  initialScope?: CashflowScope;
  initialAccountId?: string;
  className?: string;
}

export function CashflowView({ 
  initialScope = 'personal', 
  initialAccountId,
  className 
}: CashflowViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [dailySummaries, setDailySummaries] = useState<DailyCashflowSummary[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; nome: string; tipo: string }>>([]);
  
  const [filters, setFilters] = useState<CashflowFilters>({
    scope: initialScope,
    account_id: initialAccountId,
    days_ahead: 30
  });

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
      loadCashflowData();
      loadAccounts();
    }
  }, [user, filters]);

  const loadCashflowData = async () => {
    try {
      setIsLoading(true);
      const projection = await cashflowService.generateProjection(filters);
      setDailySummaries(projection.daily_summaries);
    } catch (error) {
      logger.error('Erro ao carregar dados de fluxo de caixa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de fluxo de caixa.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const accountsData = await cashflowService.getAccountBalances(filters.scope);
      setAccounts(accountsData.map(acc => ({
        id: acc.account_id,
        nome: acc.account_name,
        tipo: acc.account_type
      })));
    } catch (error) {
      logger.error('Erro ao carregar contas:', error);
    }
  };

  const handleScopeChange = (scope: CashflowScope) => {
    setFilters(prev => ({ ...prev, scope, account_id: undefined }));
  };

  const handleAccountChange = (accountId: string | undefined) => {
    setFilters(prev => ({ ...prev, account_id: accountId }));
  };

  const handleDaysAheadChange = (days: number) => {
    setFilters(prev => ({ ...prev, days_ahead: days }));
  };

  const handleRefresh = () => {
    loadCashflowData();
  };

  const handleExportCSV = async () => {
    try {
      const events = dailySummaries.flatMap(summary => summary.events);
      
      const exportOptions: CashflowExportOptions = {
        format: 'csv',
        filename: `fluxo-caixa-${filters.scope}-${new Date().toISOString().split('T')[0]}`,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + filters.days_ahead * 24 * 60 * 60 * 1000)
        }
      };
      
      exportCashflowData(events, dailySummaries, exportOptions);
      
      toast({
        title: 'Sucesso',
        description: 'Dados exportados para CSV com sucesso.'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao exportar dados para CSV.',
        variant: 'destructive'
      });
    }
  };

  const handleExportICS = async () => {
    try {
      const events = dailySummaries.flatMap(summary => summary.events);
      
      const exportOptions: CashflowExportOptions = {
        format: 'ics',
        filename: `calendario-fluxo-caixa-${filters.scope}-${new Date().toISOString().split('T')[0]}`,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + filters.days_ahead * 24 * 60 * 60 * 1000)
        }
      };
      
      exportCashflowData(events, dailySummaries, exportOptions);
      
      toast({
        title: 'Sucesso',
        description: 'Calendário exportado para ICS com sucesso.'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao exportar calendário para ICS.',
        variant: 'destructive'
      });
    }
  };



  const totalEvents = dailySummaries.reduce((sum, day) => sum + (day.events ? day.events.length : 0), 0);
  const totalIncome = dailySummaries.reduce((sum, day) => sum + (typeof day.total_income_cents === 'number' ? day.total_income_cents : parseFloat(day.total_income_cents) || 0), 0);
  const totalExpense = dailySummaries.reduce((sum, day) => sum + (typeof day.total_expense_cents === 'number' ? day.total_expense_cents : parseFloat(day.total_expense_cents) || 0), 0);
  const netFlow = totalIncome - totalExpense;

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Faça login para ver o calendário de fluxos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Cabeçalho com filtros */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Calendário de Fluxos & Previsões
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={isLoading || dailySummaries.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportICS}
                disabled={isLoading || dailySummaries.length === 0}
              >
                <Calendar className="h-4 w-4" />
                Exportar ICS
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Escopo */}
            <div>
              <label className="text-sm font-medium mb-2 block">Escopo</label>
              <Select
                value={filters.scope}
                onValueChange={handleScopeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Pessoal</SelectItem>
                  <SelectItem value="family">Família</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Conta */}
            <div>
              <label className="text-sm font-medium mb-2 block">Conta</label>
              <Select
                value={filters.account_id || 'all'}
                onValueChange={(value) => handleAccountChange(value === 'all' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.nome} ({account.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Período */}
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select
                value={filters.days_ahead.toString()}
                onValueChange={(value) => handleDaysAheadChange(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Próximos 7 dias</SelectItem>
                  <SelectItem value="15">Próximos 15 dias</SelectItem>
                  <SelectItem value="30">Próximos 30 dias</SelectItem>
                  <SelectItem value="60">Próximos 60 dias</SelectItem>
                  <SelectItem value="90">Próximos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Resumo rápido */}
            <div className="flex flex-col justify-center">
              <div className="text-sm text-muted-foreground">Total de eventos</div>
              <div className="text-2xl font-bold">{totalEvents}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Receitas</p>
                <p className="text-2xl font-bold text-green-600">
                  {(totalIncome / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Receitas
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Despesas</p>
                <p className="text-2xl font-bold text-red-600">
                  {(totalExpense / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </p>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Despesas
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Saldo Líquido</p>
                <p className={`text-2xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(netFlow / 100).toLocaleString('pt-PT', {
                    style: 'currency',
                    currency: 'EUR'
                  })}
                </p>
              </div>
              <Badge 
                variant="secondary" 
                className={netFlow >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
              >
                {netFlow >= 0 ? 'Positivo' : 'Negativo'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo principal */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Vista Calendário
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Vista Lista
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="calendar" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Carregando dados...</p>
              </CardContent>
            </Card>
          ) : (
            <CashflowCalendar
              dailySummaries={dailySummaries}
              currency="EUR"
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
          )}
        </TabsContent>
        
        <TabsContent value="list" className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Carregando dados...</p>
              </CardContent>
            </Card>
          ) : (
            <CashflowList
              dailySummaries={dailySummaries}
              currency="EUR"
              onDateSelect={setSelectedDate}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}