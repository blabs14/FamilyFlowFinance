import { useCreditCardSummary } from '../hooks/useAccountsQuery';
import { formatCurrency } from '../lib/utils';

interface CreditCardBalanceProps {
  accountId: string;
  fallbackBalance: number;
  accountType: string;
}

export const CreditCardBalance = ({ accountId, fallbackBalance, accountType }: CreditCardBalanceProps) => {
  const { data: summary } = useCreditCardSummary(accountId);
  
  // Para cartões de crédito, o saldo total deve ser sempre <= 0
  const balance = summary ? Math.min(0, summary.saldo) : Math.min(0, fallbackBalance);
  
  // Determinar a cor baseada no saldo (sempre vermelho para cartões de crédito, exceto quando = 0)
  const balanceColor = balance < 0 ? 'text-red-600' : 'text-gray-600';
  
  // Para cartões de crédito, mostrar a dívida como valor positivo
  const displayValue = balance < 0 ? Math.abs(balance) : 0;
  const displayColor = balance < 0 ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Dívida</span>
        <span className={`text-lg font-semibold ${displayColor}`}>
          {formatCurrency(displayValue)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground capitalize">{accountType}</p>
    </div>
  );
};