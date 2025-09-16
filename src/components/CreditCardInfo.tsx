import { useCreditCardSummary } from '../hooks/useAccountsQuery';
import { formatCurrency } from '../lib/utils';
import { Badge } from './ui/badge';
import { CreditCard, AlertTriangle } from 'lucide-react';

interface CreditCardInfoProps {
  accountId: string;
}

export const CreditCardInfo = ({ accountId }: CreditCardInfoProps) => {
  const { data: summary, isLoading } = useCreditCardSummary(accountId);
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
      </div>
    );
  }
  
  if (!summary) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4" />
        <span>Informações não disponíveis</span>
      </div>
    );
  }
  
  const totalGastos = Number(summary.total_gastos);
  const totalPagamentos = Number(summary.total_pagamentos);
  const balance = Number(summary.saldo); // negativo
  
  // Para cartões de crédito, mostrar a dívida atual (valor absoluto do saldo negativo)
  const currentDebt = balance < 0 ? -balance : 0;
  const utilizationPercentage = 0; // não temos limite para calcular efetivamente
  
  return (
    <div className="space-y-3">
      {/* Estado */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <CreditCard className="h-3 w-3" />
          Estado
        </span>
        <Badge 
          variant={summary.status === 'em dívida' ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          {summary.status}
        </Badge>
      </div>
      
      {/* Dívida Atual */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Dívida</span>
        <span className={`text-sm font-medium ${
          currentDebt > 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          {formatCurrency(currentDebt)}
        </span>
      </div>
      
      {/* Totais do ciclo */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Gastos (ciclo)</span>
        <span className="text-sm font-medium">{formatCurrency(totalGastos)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Pagamentos (ciclo)</span>
        <span className="text-sm font-medium">{formatCurrency(totalPagamentos)}</span>
      </div>
      
      {/* Taxa de Utilização (placeholder até existir limite) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Utilização</span>
          <Badge 
            variant={utilizationPercentage > 80 ? "destructive" : utilizationPercentage > 50 ? "secondary" : "outline"}
            className="text-xs"
          >
            {utilizationPercentage.toFixed(1)}%
          </Badge>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              utilizationPercentage > 80 
                ? 'bg-red-500' 
                : utilizationPercentage > 50 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};