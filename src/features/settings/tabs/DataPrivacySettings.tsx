import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { requestAccountDeletion, cancelAccountDeletion, getPendingDeletion } from '../../../services/accountDeletion';
import { supabase } from '../../../lib/supabaseClient';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../hooks/use-toast';
import { Download, Trash2, AlertTriangle } from 'lucide-react';

const CONFIRM_WORD = 'APAGAR';

export function DataPrivacySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: pending } = useQuery({
    queryKey: ['deletion-pending', user?.id],
    queryFn: () => getPendingDeletion(user!.id).then((r) => r.data),
    enabled: !!user?.id,
  });

  const requestDeletion = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('Not authenticated');
      return requestAccountDeletion(user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletion-pending'] });
      setDeleteOpen(false);
      setTyped('');
      toast({ title: 'Pedido de eliminação registado', description: 'Conta será eliminada em 30 dias. Podes cancelar antes do prazo.' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao criar pedido de eliminação' }),
  });

  const cancelDeletion = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('Not authenticated');
      return cancelAccountDeletion(user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletion-pending'] });
      toast({ title: 'Eliminação cancelada' });
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const { error } = await supabase.functions.invoke('export-user-data');
      if (error) throw error;
      toast({ title: 'Exportação iniciada', description: 'Receberás um email com o link de download em breve.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao exportar dados' });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exportar Dados</CardTitle>
          <CardDescription>Recebe um ZIP com todos os teus dados (transações, contas, objetivos, etc.) por email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'A preparar...' : 'Exportar dados (RGPD Art. 15)'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Máximo 1 pedido por semana.</p>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Eliminar Conta</CardTitle>
          <CardDescription>Esta ação é irreversível após o período de 30 dias.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p>Eliminação agendada para {new Date(pending.expires_at!).toLocaleDateString('pt-PT')}.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => cancelDeletion.mutate()}>
                  Cancelar eliminação
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Apagar conta
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminação</DialogTitle>
            <DialogDescription>
              A tua conta será eliminada em 30 dias. Todos os dados serão apagados de forma irreversível.
              Para confirmar, escreve <strong>{CONFIRM_WORD}</strong> no campo abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">Escreve {CONFIRM_WORD} para confirmar</Label>
            <Input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={CONFIRM_WORD}
              aria-label={`Escreve ${CONFIRM_WORD} para confirmar eliminação`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setTyped(''); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={typed !== CONFIRM_WORD || requestDeletion.isPending}
              onClick={() => requestDeletion.mutate()}
            >
              {requestDeletion.isPending ? 'A processar...' : 'Eliminar conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
