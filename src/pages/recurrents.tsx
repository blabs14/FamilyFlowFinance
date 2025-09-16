import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyContext } from '@/features/family/FamilyContext';
import { createRecurringRule, listRecurringRules, RecurringRule, pauseRecurringRule, resumeRecurringRule, cancelAtPeriodEnd, skipNextOccurrence } from '@/services/recurrents';
import { advanceNextRunDate, makePeriodKey } from '@/lib/recurrents';
import { useCategoriesDomain } from '@/hooks/useCategoriesQuery';
import { useAllAccountsWithBalances } from '../hooks/useAccountsQuery';
import { useToast } from '@/hooks/use-toast';
import { useConfirmation } from '@/hooks/useConfirmation';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export default function RecurrentsPage() {
  const { user } = useAuth();
  const famCtx = React.useContext(FamilyContext);
  const family = famCtx?.family;
  const { toast } = useToast();
  const scope: 'personal' | 'family' = family ? 'family' : 'personal';
  const [rules, setRules] = React.useState<any[]>([]);
  const { data: categories = [] } = useCategoriesDomain();
  const { data: accounts = [] } = useAllAccountsWithBalances();
  const [filters, setFilters] = React.useState<{ status?: string; subscription?: string; category?: string; method?: string }>({});
  const [sort, setSort] = React.useState<string>('next_asc');
  const [page, setPage] = React.useState<number>(1);
  const pageSize = 10;
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Partial<RecurringRule>>({
    scope: scope,
    user_id: user?.id || '',
    family_id: family?.id,
    amount_cents: 999,
    currency: 'EUR',
    interval_unit: 'month',
    interval_count: 1,
    start_date: new Date().toISOString().slice(0,10),
    next_run_date: new Date().toISOString().slice(0,10),
    status: 'active',
    is_subscription: true,
    vendor: 'Netflix',
    transaction_type: 'expense'
  });
  const { isOpen, options, confirm, close, onConfirm, onCancel } = useConfirmation();

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await listRecurringRules(scope, family?.id);
    let list = data || [];
    if (filters.status) list = list.filter((r:any)=> r.status === filters.status);
    if (filters.subscription === 'yes') list = list.filter((r:any)=> r.is_subscription);
    if (filters.subscription === 'no') list = list.filter((r:any)=> !r.is_subscription);
    if (filters.category) list = list.filter((r:any)=> r.category_id === filters.category);
    if (filters.method) list = list.filter((r:any)=> (r.payment_method||'') === filters.method);
    // Ordenação
    list = [...list].sort((a:any,b:any)=>{
      if (sort==='next_asc') return String(a.next_run_date||'').localeCompare(String(b.next_run_date||''));
      if (sort==='next_desc') return String(b.next_run_date||'').localeCompare(String(a.next_run_date||''));
      if (sort==='amount_desc') return (b.amount_cents||0)-(a.amount_cents||0);
      if (sort==='amount_asc') return (a.amount_cents||0)-(b.amount_cents||0);
      return 0;
    });
    setRules(list);
    setLoading(false);
  }, [scope, family?.id, user?.id, filters.status, filters.subscription, filters.category, filters.method, sort]);

  React.useEffect(() => { load(); }, [load]);

  const preview = React.useMemo(() => {
    try {
      const arr: { due_date: string; period_key: string }[] = [];
      if (!form.next_run_date || !form.interval_unit || !form.interval_count) return arr;
      let cursor = new Date(form.next_run_date);
      for (let i=0;i<3;i++) {
        const dateStr = cursor.toISOString().slice(0,10);
        arr.push({ due_date: dateStr, period_key: makePeriodKey(dateStr, form.interval_unit) });
        cursor = new Date(advanceNextRunDate(dateStr, form.interval_unit, form.interval_count));
      }
      return arr;
    } catch { return []; }
  }, [form.next_run_date, form.interval_unit, form.interval_count]);

  // Detectar transferências cross-scope
  const isCrossScopeTransfer = React.useMemo(() => {
    if (form.transaction_type !== 'transfer' || !form.from_account_id || !form.to_account_id) return false;
    
    const fromAccount = accounts.find((acc:any) => acc.id === form.from_account_id);
    const toAccount = accounts.find((acc:any) => acc.id === form.to_account_id);
    
    return fromAccount && toAccount && fromAccount.scope !== toAccount.scope;
  }, [form.transaction_type, form.from_account_id, form.to_account_id, accounts]);

  const onCreate = async () => {
    if (!user) return;
    
    // Validação para transferências
    if (form.transaction_type === 'transfer') {
      if (!form.from_account_id || !form.to_account_id) {
        toast({ title: 'Erro', description: 'Por favor, selecione as contas de origem e destino para a transferência.', variant: 'destructive' });
        return;
      }
      if (form.from_account_id === form.to_account_id) {
        toast({ title: 'Erro', description: 'A conta de origem e destino não podem ser a mesma.', variant: 'destructive' });
        return;
      }
    }
    
    try {
      setLoading(true);
      const payload = {
        ...form,
        scope,
        user_id: user.id,
        family_id: scope==='family' ? family?.id || null : null,
      };
      await createRecurringRule(payload);
      setForm({
         description: '',
         amount_cents: 0,
         currency: 'EUR',
         interval_unit: 'month',
         interval_count: 1,
         category_id: '',
         next_run_date: '',
         end_date: '',
         payment_method_id: '',
         transaction_type: 'expense',
         from_account_id: '',
         to_account_id: ''
       });
      setOpen(false);
        await load();
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao criar regra recorrente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recorrentes</h1>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={(v)=>{ setSort(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="next_asc">Próximo (↑)</SelectItem>
              <SelectItem value="next_desc">Próximo (↓)</SelectItem>
              <SelectItem value="amount_desc">Valor (↓)</SelectItem>
              <SelectItem value="amount_asc">Valor (↑)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)} aria-label="Criar nova regra de transação recorrente">Nova Regra</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={filters.status || '__all__'} onValueChange={(v)=>setFilters(f=>({...f, status: v === '__all__' ? undefined : v }))}>
          <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="canceled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.subscription || '__all__'} onValueChange={(v)=>setFilters(f=>({...f, subscription: v === '__all__' ? undefined : v }))}>
          <SelectTrigger><SelectValue placeholder="Subscrição" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            <SelectItem value="yes">Só subscrições</SelectItem>
            <SelectItem value="no">Exclui subscrições</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category || '__all__'} onValueChange={(v)=>setFilters(f=>({...f, category: v === '__all__' ? undefined : v }))}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas</SelectItem>
            {categories.map((c:any)=>(<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
          </SelectContent>
        </Select>
        <Input placeholder="Método Pagamento" value={filters.method||''} onChange={(e)=>setFilters(f=>({...f, method: e.target.value||undefined }))} aria-label="Filtrar por método de pagamento" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">A carregar…</p>
      ) : rules.length === 0 ? (
        <p className="text-muted-foreground">Sem regras.</p>
      ) : (
        <div className="space-y-2">
          {(rules.slice((page-1)*pageSize, page*pageSize)).map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{r.vendor || r.payee || r.description || 'Regra'}</CardTitle>
                <Badge variant={r.status==='active'?'secondary':r.status==='paused'?'outline':'destructive'}>{r.status}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-4">
                  <span>{(r.amount_cents/100).toFixed(2)} {r.currency}</span>
                  <span>Every {r.interval_count} {r.interval_unit}</span>
                  <span>Próximo: {r.next_run_date}</span>
                  {r.is_subscription && <Badge>Subscrição</Badge>}
                </div>
                <div className="mt-2 flex gap-2">
                  {r.status==='active' ? (
                    <Button size="sm" variant="outline" onClick={()=>{
                      confirm({ title: 'Pausar regra?', message: 'Esta regra ficará inativa.' }, async ()=>{
                        const { error } = await pauseRecurringRule(r.id);
                        if (error) toast({ title: 'Erro a pausar', description: String(error.message||error), variant: 'destructive' });
                        else toast({ title: 'Regra pausada' });
                        load();
                      });
                    }}>Pausar</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={()=>{
                      confirm({ title: 'Retomar regra?', message: 'A regra voltará a gerar instâncias.' }, async ()=>{
                        const { error } = await resumeRecurringRule(r.id);
                        if (error) toast({ title: 'Erro a retomar', description: String(error.message||error), variant: 'destructive' });
                        else toast({ title: 'Regra retomada' });
                        load();
                      });
                    }}>Retomar</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={()=>{
                    confirm({ title: 'Avançar próximo?', message: 'Vai ignorar o próximo lançamento e avançar para o seguinte.' }, async ()=>{
                      const { error } = await skipNextOccurrence(r.id);
                      if (error) toast({ title: 'Erro a avançar', description: String(error.message||error), variant: 'destructive' });
                      else toast({ title: 'Próximo lançamento avançado' });
                      load();
                    });
                  }}>Skip próximo</Button>
                  <Button size="sm" variant="destructive" onClick={()=>{
                    confirm({ title: 'Cancelar no fim do período?', message: 'A regra será cancelada após o próximo ciclo.', variant: 'destructive' }, async ()=>{
                      const { error } = await cancelAtPeriodEnd(r.id);
                      if (error) toast({ title: 'Erro a cancelar no fim', description: String(error.message||error), variant: 'destructive' });
                      else toast({ title: 'Cancelamento no fim do período marcado' });
                      load();
                    });
                  }}>Cancelar no fim</Button>
                  <Button size="sm" variant="destructive" onClick={()=>{
                    confirm({ title: 'Eliminar subscrição?', message: 'Isto remove a regra e as execuções futuras. As transações passadas não são alteradas.', variant: 'destructive', confirmText: 'Eliminar' }, async ()=>{
                      const { deleteRecurringRule } = await import('@/services/recurrents');
                      const { error } = await deleteRecurringRule(r.id);
                      if (error) toast({ title: 'Erro ao eliminar', description: String(error.message||error), variant: 'destructive' });
                      else toast({ title: 'Subscrição eliminada' });
                      load();
                    });
                  }}>Eliminar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between items-center pt-2">
            <Button variant="outline" size="sm" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} aria-label="Página anterior">Anterior</Button>
            <div className="text-xs text-muted-foreground">Página {page} de {Math.max(1, Math.ceil(rules.length/pageSize))}</div>
            <Button variant="outline" size="sm" disabled={page>=Math.ceil(rules.length/pageSize)} onClick={()=>setPage(p=>p+1)} aria-label="Página seguinte">Seguinte</Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Regra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Descrição/Vendor" value={form.vendor || form.description || ''} onChange={(e)=>setForm(f=>({...f, vendor: e.target.value}))} />
            
            <Select value={form.transaction_type} onValueChange={(v)=>setForm(f=>({...f, transaction_type: v as 'expense' | 'income' | 'transfer'}))}>
              <SelectTrigger><SelectValue placeholder="Tipo de Transação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
              </SelectContent>
            </Select>
            
            {form.transaction_type === 'transfer' && (
              <div className="space-y-2">
                <Select value={form.from_account_id || undefined} onValueChange={(v)=>setForm(f=>({...f, from_account_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Conta de Origem" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((account:any)=>(
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${account.scope === 'family' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {account.scope === 'family' ? 'Familiar' : 'Pessoal'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(account.balance_cents / 100).toFixed(2)} €
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={form.to_account_id || undefined} onValueChange={(v)=>setForm(f=>({...f, to_account_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Conta de Destino" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((account:any)=>(
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${account.scope === 'family' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {account.scope === 'family' ? 'Familiar' : 'Pessoal'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(account.balance_cents / 100).toFixed(2)} €
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
             )}
             
             {isCrossScopeTransfer && (
               <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                 <div className="flex items-center gap-2 text-amber-800">
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                   </svg>
                   <span className="font-medium">Transferência entre âmbitos</span>
                 </div>
                 <p className="text-sm text-amber-700 mt-1">
                   Esta transferência será entre uma conta pessoal e uma conta familiar. Certifique-se de que tem as permissões necessárias.
                 </p>
               </div>
             )}
             
             <div className="flex gap-2">
              <Input type="number" placeholder="Valor (cêntimos)" value={form.amount_cents} onChange={(e)=>setForm(f=>({...f, amount_cents: Number(e.target.value||0)}))} />
              <Input placeholder="Moeda" value={form.currency} onChange={(e)=>setForm(f=>({...f, currency: e.target.value}))} />
            </div>
            <div className="flex gap-2">
              <Select value={form.interval_unit} onValueChange={(v)=>setForm(f=>({...f, interval_unit: v as 'days' | 'weeks' | 'months' | 'years'}))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                  <SelectItem value="year">Ano</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" className="w-24" value={form.interval_count} onChange={(e)=>setForm(f=>({...f, interval_count: Number(e.target.value||1)}))} />
            </div>
            <Select value={form.category_id} onValueChange={(v)=>setForm(f=>({...f, category_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {categories.map((c:any)=>(<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={form.start_date} onChange={(e)=>setForm(f=>({...f, start_date: e.target.value}))} />
              <Input type="date" value={form.next_run_date} onChange={(e)=>setForm(f=>({...f, next_run_date: e.target.value}))} />
            </div>
            <div>
              <p className="text-sm font-medium">Próximos 3 lançamentos</p>
              <div className="text-xs text-muted-foreground">
                {preview.map((p)=> (
                  <div key={p.period_key} className="flex gap-2"><span>{p.due_date}</span><span>{p.period_key}</span></div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button>
              <Button onClick={onCreate}>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        isOpen={isOpen}
        onClose={close}
        onConfirm={onConfirm}
        onCancel={onCancel}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
      />
    </div>
  );
}