import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useScope } from '../scope';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface Rule {
  id: string;
  scope: string;
  pattern: string;
  match_type: string;
  match_field: string;
  priority: number;
  active: boolean;
  category_id: string | null;
}

interface RuleFormState {
  pattern: string;
  match_type: 'exact' | 'contains' | 'startswith' | 'regex';
  match_field: 'description' | 'counterparty';
  priority: number;
}

const DEFAULT_FORM: RuleFormState = {
  pattern: '',
  match_type: 'contains',
  match_field: 'description',
  priority: 10,
};

export function ImportRulesManager() {
  const { user } = useAuth();
  const { activeFamily } = useScope();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['import-rules', user?.id, activeFamily?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_categorization_rules')
        .select('*')
        .or(`scope.eq.system_seed,user_id.eq.${user!.id}`)
        .order('priority', { ascending: true });
      if (error) throw error;
      return data as Rule[];
    },
    enabled: !!user?.id,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      supabase.from('import_categorization_rules').update({ active }).eq('id', id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['import-rules'] }),
    onError: () => {
      qc.invalidateQueries({ queryKey: ['import-rules'] });
      toast({ title: 'Erro ao atualizar regra', variant: 'destructive' });
    },
  });

  const deleteRule = useMutation({
    mutationFn: (id: string) => supabase.from('import_categorization_rules').delete().eq('id', id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-rules'] });
      toast({ title: 'Regra eliminada' });
    },
  });

  const createRule = useMutation({
    mutationFn: (rule: RuleFormState) =>
      supabase.from('import_categorization_rules').insert({
        ...rule,
        scope: 'user',
        user_id: user!.id,
        active: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-rules'] });
      toast({ title: 'Regra criada' });
      setDialogOpen(false);
      setForm(DEFAULT_FORM);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const handleCreate = () => {
    if (!form.pattern.trim()) {
      toast({ title: 'Padrão obrigatório', variant: 'destructive' });
      return;
    }
    createRule.mutate(form);
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova regra de categorização</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rule-pattern">Padrão</Label>
              <Input
                id="rule-pattern"
                value={form.pattern}
                onChange={(e) => setForm(f => ({ ...f, pattern: e.target.value }))}
                placeholder="ex: NETFLIX"
              />
            </div>
            <div>
              <Label>Tipo de correspondência</Label>
              <Select value={form.match_type} onValueChange={(v) => setForm(f => ({ ...f, match_type: v as RuleFormState['match_type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="exact">Exato</SelectItem>
                  <SelectItem value="startswith">Começa com</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campo</Label>
              <Select value={form.match_field} onValueChange={(v) => setForm(f => ({ ...f, match_field: v as RuleFormState['match_field'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="description">Descrição</SelectItem>
                  <SelectItem value="counterparty">Contraparte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-priority">Prioridade</Label>
              <Input
                id="rule-priority"
                type="number"
                min={1}
                max={100}
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending}>Criar regra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Regras de Categorização</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova regra
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>A carregar...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3">Padrão</th>
                    <th className="text-left py-2 pr-3">Tipo</th>
                    <th className="text-left py-2 pr-3">Campo</th>
                    <th className="text-left py-2 pr-3">Prior.</th>
                    <th className="text-center py-2 pr-3">Ativa</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{rule.pattern}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{rule.match_type}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{rule.match_field}</td>
                      <td className="py-2 pr-3">
                        {rule.scope === 'system_seed' ? (
                          <span className="text-xs text-muted-foreground">sistema</span>
                        ) : rule.priority}
                      </td>
                      <td className="text-center py-2 pr-3">
                        <Switch
                          checked={rule.active}
                          onCheckedChange={(v) => toggleActive.mutate({ id: rule.id, active: v })}
                          aria-label={`Ativar regra ${rule.pattern}`}
                        />
                      </td>
                      <td className="py-2">
                        {rule.scope !== 'system_seed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule.mutate(rule.id)}
                            aria-label={`Eliminar regra ${rule.pattern}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
