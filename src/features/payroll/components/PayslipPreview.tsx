import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePayslipCalculation } from '../hooks/usePayslipCalculation';
import { usePayslips } from '../hooks/usePayslips';
import { createPayslipDraft, postPayslip } from '../services/payrollService';
import {
  formatCents,
  periodLabel,
  currentPeriod,
  availablePeriods,
  enrichComponents,
} from '../services/payrollCalculator';

interface PayslipPreviewProps {
  contractId: string;
  defaultPeriod?: string;
}

type PostingState = 'idle' | 'posting' | 'done' | 'error';

export default function PayslipPreview({ contractId, defaultPeriod }: PayslipPreviewProps) {
  const [period, setPeriod] = useState(defaultPeriod ?? currentPeriod());
  const [postingState, setPostingState] = useState<PostingState>('idle');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const periods = useMemo(() => availablePeriods(12), []);

  const { data: calculation, isLoading, error } = usePayslipCalculation(contractId, period);
  const { data: payslips = [] } = usePayslips(contractId);

  const isAlreadyPosted = useMemo(
    () => payslips.some(p => p.period === period && p.status === 'posted'),
    [payslips, period],
  );

  const postedRecord = useMemo(
    () => payslips.find(p => p.period === period && p.status === 'posted'),
    [payslips, period],
  );

  const handlePost = async () => {
    if (!calculation || postingState === 'posting' || postingState === 'done') return;
    setPostingState('posting');
    try {
      const payslipId = await createPayslipDraft(contractId, period);
      const result = await postPayslip(payslipId);
      queryClient.invalidateQueries({ queryKey: ['payroll-payslips', contractId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      setPostingState('done');
      if (result.idempotent) {
        toast({ title: 'Recibo já existia', description: `O recibo de ${periodLabel(period)} já estava lançado.` });
      } else {
        toast({ title: 'Recibo lançado', description: `Ordenado líquido de ${periodLabel(period)} registado.` });
      }
    } catch (err: any) {
      setPostingState('error');
      toast({
        title: 'Erro ao lançar recibo',
        description: err?.message ?? 'Erro inesperado',
        variant: 'destructive',
      });
    }
  };

  const enriched = calculation ? enrichComponents(calculation.components) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Recibo de Vencimento</CardTitle>
        <Select value={period} onValueChange={p => { setPeriod(p); setPostingState('idle'); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div data-testid="payslip-skeleton" className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Erro ao calcular: {error.message}</p>
        )}

        {!isLoading && calculation && (
          <>
            {/* Components table */}
            <div className="divide-y text-sm">
              {enriched.map((c, i) => (
                <div key={i} className="flex justify-between py-2">
                  <span className={c.isDeduction ? 'text-destructive' : ''}>{c.label}</span>
                  <span className={`font-mono ${c.isDeduction ? 'text-destructive' : 'text-green-600'}`}>
                    {c.sign === '-' ? '−' : '+'} {c.formatted}
                  </span>
                </div>
              ))}
            </div>

            {/* Net total */}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Líquido a receber</span>
              <span className="text-green-700 font-mono text-lg">
                {formatCents(calculation.net_cents)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {calculation.working_days} dias úteis · Seg–Sex excluindo feriados
            </p>

            {/* Action area */}
            {isAlreadyPosted ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Recibo já lançado</span>
                {postedRecord?.transactionId && (
                  <span className="ml-auto font-mono text-xs">{postedRecord.transactionId.slice(0, 8)}</span>
                )}
              </div>
            ) : (
              <Button
                type="button"
                onClick={handlePost}
                disabled={postingState === 'posting' || postingState === 'done'}
                aria-busy={postingState === 'posting'}
                className="w-full"
              >
                {postingState === 'posting' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> A lançar...</>
                ) : postingState === 'error' ? (
                  'Tentar novamente'
                ) : (
                  'Lançar Recibo'
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
