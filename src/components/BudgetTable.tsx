import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from './ui/table';
import { Button } from './ui/button';

interface Budget {
  id: string;
  categoria: string;
  valor: number;
  mes: string;
}

interface BudgetTableProps {
  budgets: Budget[];
  onEdit?: (budget: Budget) => void;
  onRemove?: (id: string) => void;
}

const getSumBy = (budgets: Budget[], key: keyof Budget) => {
  const map = new Map<string, number>();
  budgets.forEach((b) => {
    const k = b[key] as string;
    map.set(k, (map.get(k) || 0) + (typeof b.valor === 'number' ? b.valor : parseFloat(b.valor) || 0));
  });
  return Array.from(map.entries());
};

const BudgetTable = ({ budgets, onEdit, onRemove }: BudgetTableProps) => {
  const sumByCategoria = getSumBy(budgets, 'categoria');
  const sumByMes = getSumBy(budgets, 'mes');

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[400px] text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 sm:px-4">Categoria</TableHead>
            <TableHead className="px-2 sm:px-4">Valor</TableHead>
            <TableHead className="px-2 sm:px-4">Mês</TableHead>
            <TableHead className="px-2 sm:px-4">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets.map((b) => (
            <TableRow key={b.id} className="hover:bg-muted/50">
              <TableCell className="px-2 sm:px-4">{b.categoria}</TableCell>
              <TableCell className="px-2 sm:px-4">€{b.valor.toFixed(2)}</TableCell>
              <TableCell className="px-2 sm:px-4">{b.mes}</TableCell>
              <TableCell className="px-2 sm:px-4">
                <div className="flex gap-2">
                  {onEdit && (
                    <Button size="sm" variant="outline" onClick={() => onEdit(b)}>
                      Editar
                    </Button>
                  )}
                  {onRemove && (
                    <Button size="sm" variant="destructive" onClick={() => onRemove(b.id)}>
                      Remover
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {budgets.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center">Nenhum orçamento encontrado.</TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-bold px-2 sm:px-4">Total por categoria</TableCell>
            <TableCell colSpan={3} className="px-2 sm:px-4">
              {sumByCategoria.map(([cat, total]) => (
                <span key={cat} className="mr-4">{cat}: <b>€{total.toFixed(2)}</b></span>
              ))}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-bold px-2 sm:px-4">Total por mês</TableCell>
            <TableCell colSpan={3} className="px-2 sm:px-4">
              {sumByMes.map(([mes, total]) => (
                <span key={mes} className="mr-4">{mes}: <b>€{total.toFixed(2)}</b></span>
              ))}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
};

export default BudgetTable;