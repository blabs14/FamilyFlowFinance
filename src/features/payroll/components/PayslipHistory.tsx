import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePayslips } from '../hooks/usePayslips';
import { formatCents, periodLabel, enrichComponents } from '../services/payrollCalculator';

interface PayslipHistoryProps {
  contractId: string;
}

const PAGE_SIZE = 10;

export default function PayslipHistory({ contractId }: PayslipHistoryProps) {
  const { data: payslips = [], isLoading } = usePayslips(contractId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const paged = payslips.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(payslips.length / PAGE_SIZE);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Recibos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payslips.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Recibos</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sem recibos lançados ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de Recibos</CardTitle></CardHeader>
      <CardContent className="space-y-1 p-0">
        {paged.map(slip => {
          const isOpen = expanded === slip.id;
          const enriched = enrichComponents(slip.components ?? []);
          return (
            <div key={slip.id} className="border-b last:border-0">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : slip.id)}
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="font-medium">{periodLabel(slip.period)}</span>
                  <Badge variant="secondary">{slip.status}</Badge>
                </div>
                <span className="font-mono font-semibold text-green-700">
                  {formatCents(slip.net_cents)}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-1 bg-muted/20">
                  {enriched.map((c, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.label}</span>
                      <span className={`font-mono ${c.isDeduction ? 'text-destructive' : ''}`}>
                        {c.sign === '-' ? '−' : '+'} {c.formatted}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-semibold pt-1 border-t">
                    <span>Líquido</span>
                    <span className="font-mono">{formatCents(slip.net_cents)}</span>
                  </div>
                  {slip.transactionId && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Transacção: {slip.transactionId.slice(0, 8)}…
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <span>{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Próximo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
