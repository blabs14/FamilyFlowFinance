import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Calendar, CheckCircle, XCircle, Clock, Euro } from 'lucide-react';
import { performanceBonusService } from '../services/performanceBonusService';
import { PerformanceBonusResult } from '../types/performanceBonus';
import { useToast } from '../../../hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatDateLocal } from '@/lib/dateUtils';

interface PerformanceBonusResultsProps {
  contractId?: string;
}

export const PerformanceBonusResults: React.FC<PerformanceBonusResultsProps> = ({ contractId }) => {
  const [results, setResults] = useState<PerformanceBonusResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadResults();
  }, [contractId, filterPeriod]);

  const loadResults = async () => {
    try {
      setLoading(true);
      
      let period;
      if (filterPeriod !== 'all') {
        const now = new Date();
        const start = new Date();
        
        switch (filterPeriod) {
          case 'current_month':
            start.setDate(1);
            break;
          case 'last_month':
            start.setMonth(start.getMonth() - 1);
            start.setDate(1);
            now.setDate(0); // Last day of previous month
            break;
          case 'current_quarter':
            const quarterStart = Math.floor(start.getMonth() / 3) * 3;
            start.setMonth(quarterStart);
            start.setDate(1);
            break;
          case 'last_quarter':
            const lastQuarterStart = Math.floor(start.getMonth() / 3) * 3 - 3;
            start.setMonth(lastQuarterStart);
            start.setDate(1);
            now.setMonth(now.getMonth() - 3);
            now.setDate(0);
            break;
        }
        
        period = {
          start: formatDateLocal(start),
          end: formatDateLocal(now)
        };
      }
      
      const data = await performanceBonusService.getResults(contractId, period);
      setResults(data);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar resultados de bónus',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBonus = async (resultId: string) => {
    if (!confirm('Tem certeza que deseja aplicar este bónus?')) return;
    
    try {
      setLoading(true);
      await performanceBonusService.applyBonus(resultId);
      toast({
        title: 'Sucesso',
        description: 'Bónus aplicado com sucesso'
      });
      loadResults();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao aplicar bónus',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'calculated':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Calculado</Badge>;
      case 'applied':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Aplicado</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getThresholdBadge = (thresholdMet: boolean) => {
    return thresholdMet ? (
      <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Atingido</Badge>
    ) : (
      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Não Atingido</Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: pt });
  };

  const filteredResults = results.filter(result => {
    if (filterStatus !== 'all' && result.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const totalBonusCalculated = filteredResults.reduce((sum, result) => sum + (typeof result.calculated_bonus_amount === 'number' ? result.calculated_bonus_amount : parseFloat(result.calculated_bonus_amount) || 0), 0);
  const totalBonusApplied = filteredResults.filter(r => r.status === 'applied').reduce((sum, result) => sum + (typeof result.applied_bonus_amount === 'number' ? result.applied_bonus_amount : parseFloat(result.applied_bonus_amount) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Resultados de Bónus de Performance</h2>
          <p className="text-muted-foreground">
            Histórico de cálculos e aplicações de bónus baseados em performance
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Calculado</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBonusCalculated)}</p>
              </div>
              <Euro className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Aplicado</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBonusApplied)}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendente</p>
                <p className="text-2xl font-bold">{formatCurrency(totalBonusCalculated - totalBonusApplied)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Período</label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="current_month">Mês atual</SelectItem>
                  <SelectItem value="last_month">Mês anterior</SelectItem>
                  <SelectItem value="current_quarter">Trimestre atual</SelectItem>
                  <SelectItem value="last_quarter">Trimestre anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <label className="text-sm font-medium">Estado</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  <SelectItem value="calculated">Calculado</SelectItem>
                  <SelectItem value="applied">Aplicado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Bónus</CardTitle>
          <CardDescription>
            {filteredResults.length} resultado(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredResults.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Valor Calculado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(result.evaluation_period_start)}</div>
                        <div className="text-muted-foreground">até {formatDate(result.evaluation_period_end)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {result.calculation_details?.bonus_name || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{result.metric_value}</div>
                        <div className="text-muted-foreground text-xs">
                          {result.calculation_details?.metric_type || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="text-sm">
                          {result.calculation_details?.operator} {result.calculation_details?.threshold_value}
                        </div>
                        {getThresholdBadge(result.threshold_met)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {formatCurrency(result.calculated_bonus_amount)}
                      </div>
                      {result.applied_bonus_amount !== result.calculated_bonus_amount && (
                        <div className="text-xs text-muted-foreground">
                          Aplicado: {formatCurrency(result.applied_bonus_amount)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(result.status)}
                      {result.applied_at && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDate(result.applied_at)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {result.status === 'calculated' && result.threshold_met && (
                        <Button
                          size="sm"
                          onClick={() => handleApplyBonus(result.id)}
                          disabled={loading}
                        >
                          Aplicar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? 'A carregar...' : 'Nenhum resultado encontrado para os filtros selecionados.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};