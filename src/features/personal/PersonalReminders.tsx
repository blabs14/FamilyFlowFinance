import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { useReminders, useDeleteReminder } from '../../hooks/useRemindersQuery';
import ReminderForm from '../../components/ReminderForm';
import { Calendar, Plus, Edit, Trash2, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useConfirmation } from '../../hooks/useConfirmation';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import { getReminderDate } from '../../lib/dateUtils';

interface Reminder {
  id: string;
  title?: string;
  titulo?: string;
  description?: string;
  descricao?: string;
  date?: string;
  data_lembrete?: string;
  data?: string;
  recurring?: boolean;
  repetir?: string;
}

const PersonalReminders: React.FC = () => {
  const { data: reminders = [], isLoading } = useReminders();
  const deleteReminderMutation = useDeleteReminder();
  const confirmation = useConfirmation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'recurring'>('all');

  const filtered = React.useMemo(() => {
    const list = reminders || [];
    if (filter === 'all') return list;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay()); // domingo
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return list
      .filter((r) => {
        const d = getReminderDate(r as Record<string, unknown>);
        if (!d) return false;
        switch (filter) {
          case 'today':
            return d >= startOfDay && d <= endOfDay;
          case 'week':
            return d >= startOfWeek && d <= endOfWeek;
          case 'month':
            return d >= startOfMonth && d <= endOfMonth;
          default:
            return true;
        }
      })
      .filter((r) => {
        if (statusFilter === 'all') return true;
        const d = getReminderDate(r as Record<string, unknown>);
        if (!d) return false;
        const now = new Date();
        const startOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const isRecurring = Boolean(r.recurring);
        const isOverdue = d < startOfDayLocal;
        const isToday = d >= startOfDayLocal && d <= endOfDayLocal;
        const isUpcoming = d > endOfDayLocal;
        if (statusFilter === 'overdue') return isOverdue;
        if (statusFilter === 'today') return isToday;
        if (statusFilter === 'upcoming') return isUpcoming;
        if (statusFilter === 'recurring') return isRecurring;
        return true;
      });
  }, [reminders, filter, statusFilter]);

  const handleDelete = (id: string) => {
    confirmation.confirm(
      {
        title: 'Eliminar Lembrete',
        message: 'Tem a certeza que deseja eliminar este lembrete? Esta ação não pode ser desfeita.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        variant: 'destructive',
      },
      async () => {
        await deleteReminderMutation.mutateAsync(id);
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lembretes Pessoais
          </h2>
          <p className="text-sm text-muted-foreground">Gerir lembretes pessoais</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} aria-label="Criar novo lembrete">
          <Plus className="h-4 w-4 mr-2" />
          Novo Lembrete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Lembretes</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" /> Filtros
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'today' | 'week' | 'month')} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="week">Esta semana</TabsTrigger>
              <TabsTrigger value="month">Este mês</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Estado</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'overdue' | 'today' | 'upcoming' | 'recurring')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Em atraso</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="upcoming">Próximos</SelectItem>
                  <SelectItem value="recurring">Recorrentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Sem lembretes</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r: Reminder) => (
                <Card key={r.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {r.title}
                        {(() => {
                          const d = getReminderDate(r as Record<string, unknown>);
                          const now = new Date();
                          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                          const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                          const isOverdue = !!d && d < startOfDay;
                          const isToday = !!d && d >= startOfDay && d <= endOfDay;
                          const isRecurring = Boolean(r.recurring);
                          const badges = [] as React.ReactNode[];
                          if (isOverdue) {
                            badges.push(<Badge key={`${r.id}-overdue`} variant="destructive">Em atraso</Badge>);
                          }
                          if (isToday && !isOverdue) {
                            badges.push(<Badge key={`${r.id}-today`} variant="secondary">Hoje</Badge>);
                          }
                          if (isRecurring) {
                            badges.push(<Badge key={`${r.id}-recurring`} variant="outline" className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Recorrente</Badge>);
                          }
                          return <>{badges}</>;
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.description || '—'} • {(getReminderDate(r as Record<string, unknown>)?.toLocaleDateString('pt-PT')) ?? '—'} {r.recurring ? '• Recorrente' : ''}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(r); setModalOpen(true); }}>
                        <Edit className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(String(r.id))}>
                        <Trash2 className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Lembrete' : 'Novo Lembrete'}</DialogTitle>
            <DialogDescription>{editing ? 'Atualize os dados do lembrete' : 'Crie um novo lembrete'}</DialogDescription>
          </DialogHeader>
          <ReminderForm
            initialData={editing || undefined}
            onSuccess={() => { setModalOpen(false); setEditing(null); }}
            onCancel={() => { setModalOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel}
        title={confirmation.options.title}
        message={confirmation.options.message}
        confirmText={confirmation.options.confirmText}
        cancelText={confirmation.options.cancelText}
        variant={confirmation.options.variant}
      />
    </div>
  );
};

export default PersonalReminders;