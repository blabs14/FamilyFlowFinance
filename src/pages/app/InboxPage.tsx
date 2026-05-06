// src/pages/app/InboxPage.tsx
import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-states';
import InboxItemComponent from '@/components/inbox/InboxItem';
import { useInboxItems, useDismissInboxItem, useDoneInboxItem } from '@/hooks/useInboxQuery';
import { useToast } from '@/hooks/use-toast';
import type { InboxItem } from '@/services/inbox';

export default function InboxPage() {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useInboxItems();
  const dismiss = useDismissInboxItem();
  const done    = useDoneInboxItem();

  const handleDone = async (item: InboxItem) => {
    try {
      await done.mutateAsync(item);
      toast({ title: 'Feito ✓' });
    } catch {
      toast({ title: 'Erro ao confirmar item', variant: 'destructive' });
    }
  };

  const handleDismiss = async (item: InboxItem) => {
    try {
      await dismiss.mutateAsync(item);
    } catch {
      toast({ title: 'Erro ao saltar item', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'item pendente' : 'itens pendentes'}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Tudo em dia 🎉</p>
          <p className="text-sm mt-1">Não há itens pendentes no inbox.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <InboxItemComponent
              key={item.id}
              item={item}
              onDone={handleDone}
              onDismiss={handleDismiss}
              isLoading={done.isPending || dismiss.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
