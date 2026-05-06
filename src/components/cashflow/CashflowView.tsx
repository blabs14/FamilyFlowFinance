// src/components/cashflow/CashflowView.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import { useCashflowTimeline, CashflowTimelineEvent } from '@/hooks/useCashflowQuery';
import { formatCurrency } from '@/lib/utils';

interface CashflowViewProps {
  daysBefore?: number;
  daysAfter?: number;
}

const BEFORE_OPTIONS = [15, 30, 60] as const;
const AFTER_OPTIONS  = [30, 60, 90] as const;

function EventRow({ event }: { event: CashflowTimelineEvent }) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${event.isProjected ? 'opacity-75 border border-dashed border-muted' : 'hover:bg-muted/40'}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {event.direction === 'in'
          ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
          : <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{event.description}</p>
          <p className="text-xs text-muted-foreground">{event.eventDate}</p>
        </div>
        {event.needsConfirm && (
          <AlertTriangle
            className="h-4 w-4 text-amber-500 shrink-0 ml-1"
            title="Por confirmar"
          />
        )}
      </div>
      <span className={`text-sm font-semibold ml-2 ${event.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
        {event.direction === 'in' ? '+' : '-'}{formatCurrency(event.amountCents / 100)}
      </span>
    </div>
  );
}

export function CashflowView({ daysBefore: initBefore = 30, daysAfter: initAfter = 60 }: CashflowViewProps) {
  const [daysBefore, setDaysBefore] = useState(initBefore);
  const [daysAfter, setDaysAfter]   = useState(initAfter);

  const { data: events = [], isLoading } = useCashflowTimeline({ daysBefore, daysAfter });
  const today = new Date().toISOString().slice(0, 10);

  const past   = events.filter(e => e.eventDate <= today);
  const future = events.filter(e => e.eventDate >  today);

  return (
    <div className="space-y-4">
      {/* Slider controls */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Passado:</span>
            {BEFORE_OPTIONS.map(d => (
              <Button key={d} size="sm" variant={daysBefore === d ? 'default' : 'outline'}
                onClick={() => setDaysBefore(d)}>{d}d</Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Futuro:</span>
            {AFTER_OPTIONS.map(d => (
              <Button key={d} size="sm" variant={daysAfter === d ? 'default' : 'outline'}
                onClick={() => setDaysAfter(d)}>{d}d</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Linha do tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">A carregar...</p>}

          {past.map((e, i) => <EventRow key={`p-${i}`} event={e} />)}

          {/* "Hoje" divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-1 border-t border-primary/50" />
            <span className="mx-3 text-xs font-semibold text-primary uppercase">Hoje</span>
            <div className="flex-1 border-t border-primary/50" />
          </div>

          {future.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-2">Sem eventos futuros</p>
          )}
          {future.map((e, i) => <EventRow key={`f-${i}`} event={e} />)}
        </CardContent>
      </Card>
    </div>
  );
}
