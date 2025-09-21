import { useEffect, useMemo, useState } from 'react';
import { useGoalFunding } from '../hooks/useGoalFunding';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { FormSubmitButton } from './ui/loading-button';
import { useToast } from '../hooks/use-toast';

interface Props {
  goalId: string;
  canEdit?: boolean;
}

export const GoalFundingSection = ({ goalId, canEdit = true }: Props) => {
  const { toast } = useToast();
  const { rules, contributions, createRule, updateRule, removeRule } = useGoalFunding(goalId);
  const { data: categories = [] } = useCategoriesDomain();

  const [type, setType] = useState<'income_percent'|'fixed_monthly'|'roundup_expense'>('income_percent');
  const [enabled, setEnabled] = useState(true);
  const [percentBp, setPercentBp] = useState('');
  const [fixedCents, setFixedCents] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  // Usar um valor sentinela não-vazio para representar "todas" as categorias, evitando erro do Radix Select
  const [categoryId, setCategoryId] = useState<string>('all');
  const [minCents, setMinCents] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formatação segura de datas que respeita o locale do utilizador e força relógio 24h
  const formatDateTime = (value?: string | Date | null) => {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    try {
      const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'pt-PT';
      return d.toLocaleString(locale, { hour12: false });
    } catch {
      try {
        return d.toLocaleString('pt-PT', { hour12: false });
      } catch {
        return '';
      }
    }
  };

  const previewIncome = useMemo(() => {
    // 2.000€ => 200000 cents
    const cents = 200000;
    if (type === 'income_percent') {
      const percentage = Number(percentBp) || 0;
      return Math.floor((cents * percentage) / 100);
    }
    return 0;
  }, [type, percentBp]);

  const previewRoundup = useMemo(() => {
    // 12,53€ => 1253 cents => roundup: (100 - (1253 % 100)) % 100 = 47
    const cents = 1253;
    if (type === 'roundup_expense') {
      return (100 - (cents % 100)) % 100;
    }
    return 0;
  }, [type]);

  const create = async () => {
    if (!canEdit) {
      toast({
        title: 'Acesso negado',
        description: 'Não tem permissões para criar regras de financiamento.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      const payload: any = {
        goal_id: goalId,
        type,
        enabled,
        currency: 'EUR'
      };
      if (type === 'income_percent') payload.percent_bp = (Number(percentBp) || 0) * 100;
      if (type === 'fixed_monthly') {
        payload.fixed_cents = Number(fixedCents) || 0;
        payload.day_of_month = Number(dayOfMonth) || 1;
      }
      // Só enviar category_id quando uma categoria específica for selecionada
      if (categoryId && categoryId !== 'all') payload.category_id = categoryId;
      if (minCents) payload.min_amount_cents = Number(minCents) || null;
      const { error } = await createRule.mutateAsync(payload);
      if (error) throw error;
      toast({ title: 'Regra criada' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao criar regra', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await removeRule.mutateAsync(id);
      if (error) throw error;
      toast({ title: 'Regra removida' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Falha ao remover', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funding automático</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v)=>setType(v as 'monthly' | 'one_time')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income_percent">Percentagem de receitas</SelectItem>
                <SelectItem value="fixed_monthly">Mensal fixo</SelectItem>
                <SelectItem value="roundup_expense">Arredondamento em despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ativa</Label>
            <div className="h-10 flex items-center gap-2">
              <Checkbox checked={enabled} onCheckedChange={(v)=>setEnabled(!!v)} />
              <span className="text-sm text-muted-foreground">{enabled ? 'Ativada' : 'Pausada'}</span>
            </div>
          </div>
          <div>
            <Label>Moeda</Label>
            <Input value="EUR" disabled />
          </div>
        </div>

        {type === 'income_percent' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Percentagem (%)</Label>
              <Input value={percentBp} onChange={(e)=>setPercentBp(e.target.value.replace(/[^\d]/g,''))} placeholder="ex.: 10" />
            </div>
            <div>
              <Label>Categoria (opcional)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(Array.isArray(categories) ? categories : []).map(c=> (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mínimo por transação (cêntimos)</Label>
              <Input value={minCents} onChange={(e)=>setMinCents(e.target.value.replace(/[^\d]/g,''))} placeholder="ex.: 5000 = 50€" />
            </div>
            <div className="md:col-span-3 text-sm text-muted-foreground">Preview (receita 2.000€): { (previewIncome/100).toFixed(2) }€</div>
          </div>
        )}

        {type === 'fixed_monthly' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Valor fixo (cêntimos)</Label>
              <Input value={fixedCents} onChange={(e)=>setFixedCents(e.target.value.replace(/[^\d]/g,''))} placeholder="ex.: 5000 = 50€" />
            </div>
            <div>
              <Label>Dia do mês (1–28)</Label>
              <Input value={dayOfMonth} onChange={(e)=>setDayOfMonth(e.target.value.replace(/[^\d]/g,''))} placeholder="1" />
            </div>
          </div>
        )}

        {type === 'roundup_expense' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Categoria (opcional)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(Array.isArray(categories) ? categories : []).map(c=> (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mínimo por transação (cêntimos)</Label>
              <Input value={minCents} onChange={(e)=>setMinCents(e.target.value.replace(/[^\d]/g,''))} placeholder="ex.: 5000 = 50€" />
            </div>
            <div className="md:col-span-3 text-sm text-muted-foreground">Preview (despesa 12,53€): { (previewRoundup/100).toFixed(2) }€</div>
          </div>
        )}

        <div className="flex gap-2">
          {canEdit && (
            <FormSubmitButton isSubmitting={isSubmitting} submitText="Criar regra" submittingText="A criar..." onClick={create} />
          )}
        </div>

        <div className="pt-4">
          <div className="text-sm font-medium mb-2">Regras existentes</div>
          <div className="space-y-2">
            {(rules.data || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between border rounded p-2">
                <div className="text-sm">
                  <div><b>Tipo:</b> {r.type} {r.enabled ? '' : '(paused)'}</div>
                  <div><b>Config:</b> {r.type==='income_percent' ? `${(r.percent_bp/100).toFixed(1)}%` : r.type==='fixed_monthly' ? `${(r.fixed_cents||0)/100}€ dia ${r.day_of_month}` : 'round-up'}</div>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" onClick={()=>updateRule.mutate({ id: r.id, updates: { enabled: !r.enabled }})}>{r.enabled ? 'Pausar' : 'Ativar'}</Button>
                      <Button size="sm" variant="destructive" onClick={()=>remove(r.id)}>Eliminar</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <div className="text-sm font-medium mb-2">Contribuições recentes</div>
          <div className="space-y-2">
            {(contributions.data || []).map((c: any) => (
              <div key={c.id} className="text-sm border rounded p-2 flex items-center justify-between">
                <div>
                  <div><b>Origem:</b> {c.description || c.source_type}</div>
                  <div className="text-muted-foreground">{formatDateTime(c?.created_at)}</div>
                </div>
                <div className="font-medium">{(c.amount_cents/100).toFixed(2)}€</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};