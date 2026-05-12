// src/features/payroll/pages/TravelAllowancesPage.tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useActiveContract } from '../hooks/useActiveContract';
import { useTravelAllowances } from '../hooks/useTravelAllowances';
import { calcTravelAllowance } from '../lib/calc';
import type { TravelAllowanceRecord, TravelAllowanceType } from '../types/payroll-advanced.types';

// 2026 caps — hardcoded for client-side preview (loaded from DB via service in Phase 2)
const CAPS_2026 = {
  national_general_cents: 6589, national_admin_cents: 7265,
  foreign_general_cents: 15636, foreign_admin_cents: 17542,
  breakdown: { lunch: 0.25, dinner: 0.25, sleep: 0.50 },
} as const;

const TYPE_LABELS: Record<TravelAllowanceType, string> = {
  deslocacao_nacional:        'Deslocacao Nacional',
  deslocacao_estrangeiro:     'Deslocacao Estrangeiro',
  deslocacao_viatura_propria: 'Viatura Propria (km)',
  alojamento:                 'Alojamento',
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function TravelAllowancesPage() {
  const { toast } = useToast();
  const { activeContract } = useActiveContract();
  const period = currentPeriod();
  const { allowances, save, remove } = useTravelAllowances(activeContract?.id ?? null, period);

  const [type, setType] = useState<TravelAllowanceType>('deslocacao_nacional');
  const [role, setRole] = useState<'general' | 'admin'>('general');
  const [dateStart, setDateStart] = useState('');
  const [days, setDays] = useState('');
  const [km, setKm] = useState('');
  const [declaredEuros, setDeclaredEuros] = useState('');

  const declaredCents = Math.round(parseFloat(declaredEuros || '0') * 100);
  const daysNum = parseFloat(days || '1');
  const kmNum   = parseFloat(km || '0');

  const preview = useMemo(() => {
    if (declaredCents <= 0) return null;
    return calcTravelAllowance(
      { type, days: daysNum, km: type === 'deslocacao_viatura_propria' ? kmNum : undefined, role, declaredCents },
      CAPS_2026,
      40,
    );
  }, [type, role, daysNum, kmNum, declaredCents]);

  const handleSave = async () => {
    if (!activeContract?.id) return;
    try {
      await save.mutateAsync({
        contract_id:          activeContract.id,
        type,
        date_start:           dateStart || new Date().toISOString().split('T')[0],
        days:                 type !== 'deslocacao_viatura_propria' ? daysNum : undefined,
        km:                   type === 'deslocacao_viatura_propria' ? kmNum : undefined,
        role,
        declared_cents:       declaredCents,
        taxable_excess_cents: preview?.taxableExcessCents ?? 0,
        operation_id:         `${activeContract.id}-${Date.now()}`,
      });
      toast({ title: 'Guardado', description: 'Ajuda de custo registada.' });
      setDeclaredEuros(''); setDays(''); setKm(''); setDateStart('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Ajudas de Custo</h1>

      <Card>
        <CardHeader><CardTitle>Registar ajuda de custo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as TravelAllowanceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [TravelAllowanceType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'general' | 'admin')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Data inicio</Label>
              <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </div>

            {type !== 'deslocacao_viatura_propria' ? (
              <div className="space-y-1">
                <Label>Dias</Label>
                <Input type="number" step="0.5" min="0.5" value={days} onChange={e => setDays(e.target.value)} placeholder="ex: 3" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Quilometros</Label>
                <Input type="number" step="1" min="1" value={km} onChange={e => setKm(e.target.value)} placeholder="ex: 150" />
              </div>
            )}

            <div className="space-y-1 col-span-2">
              <Label htmlFor="valor-declarado">Valor declarado (EUR)</Label>
              <Input
                id="valor-declarado"
                type="number" step="0.01"
                value={declaredEuros}
                onChange={e => setDeclaredEuros(e.target.value)}
                placeholder="ex: 197.67"
              />
            </div>
          </div>

          {preview && (
            <div className="flex gap-4 p-3 bg-muted rounded-md text-sm">
              <span>Isento: <strong>{formatCurrency(preview.exemptCents / 100)}</strong></span>
              <span>Tributavel: <strong>{formatCurrency(preview.taxableExcessCents / 100)}</strong></span>
            </div>
          )}

          <Button onClick={handleSave} disabled={save.isPending}>Guardar</Button>
        </CardContent>
      </Card>

      {allowances.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ajudas do mes</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">Data</th>
                  <th className="text-right py-2">Declarado</th>
                  <th className="text-right py-2">Isento</th>
                  <th className="text-right py-2">Tributavel</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allowances.map((a: TravelAllowanceRecord) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2">{TYPE_LABELS[a.type as TravelAllowanceType]}</td>
                    <td className="py-2">{a.date_start}</td>
                    <td className="text-right py-2">{formatCurrency(a.declared_cents / 100)}</td>
                    <td className="text-right py-2">{formatCurrency((a.declared_cents - a.taxable_excess_cents) / 100)}</td>
                    <td className="text-right py-2">
                      {a.taxable_excess_cents > 0 && (
                        <Badge variant="destructive">{formatCurrency(a.taxable_excess_cents / 100)}</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" onClick={() => remove.mutate(a.id)}>x</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
