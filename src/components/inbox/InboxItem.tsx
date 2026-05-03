// src/components/inbox/InboxItem.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { InboxItem as InboxItemType } from '@/services/inbox';

interface Props {
  item: InboxItemType;
  onDone: (item: InboxItemType) => void;
  onDismiss: (item: InboxItemType) => void;
  isLoading?: boolean;
}

const SOURCE_LABELS: Record<InboxItemType['source_type'], string> = {
  recurring_instance: 'Recorrente',
  budget_threshold:   'Orçamento',
  goal_deadline:      'Objetivo',
  manual:             'Manual',
};

const InboxItem: React.FC<Props> = ({ item, onDone, onDismiss, isLoading }) => {
  const isRecurring = item.source_type === 'recurring_instance';
  const dueDate = item.due_at
    ? new Date(item.due_at).toLocaleDateString('pt-PT')
    : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs shrink-0">
            {SOURCE_LABELS[item.source_type]}
          </Badge>
          {dueDate && (
            <span className="text-xs text-muted-foreground">{dueDate}</span>
          )}
        </div>
        <p className="font-medium text-sm truncate">{item.title}</p>
        {item.body && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDismiss(item)}
          disabled={isLoading}
        >
          Saltar
        </Button>
        <Button
          size="sm"
          onClick={() => onDone(item)}
          disabled={isLoading}
        >
          {isRecurring ? 'Confirmar' : 'Resolver'}
        </Button>
      </div>
    </div>
  );
};

export default InboxItem;
