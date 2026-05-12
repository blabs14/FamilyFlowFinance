// src/services/__tests__/exportService.test.ts
import { describe, it, expect, vi } from 'vitest';

// exportService.ts imports supabase at module level — stub it to avoid env-var throw
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
import { exportCashflow } from '../exportService';

describe('exportCashflow', () => {
  it('produces valid CSV with header and one row', () => {
    const csv = exportCashflow([{
      eventDate: '2026-05-10',
      amountCents: 5000,
      direction: 'out',
      sourceType: 'transaction',
      sourceId: 'id-1',
      description: 'Supermercado',
      isProjected: false,
      needsConfirm: false,
    }]);

    expect(csv).toContain('Data,Descrição');
    expect(csv).toContain('2026-05-10');
    expect(csv).toContain('Supermercado');
    expect(csv).toContain('50.00');
    expect(csv).toContain('Saída');
    expect(csv).toContain('Não'); // isProjected: false
  });

  it('handles empty events array', () => {
    const csv = exportCashflow([]);
    expect(csv).toContain('Data,Descrição');
    // Header only — no trailing rows
    expect(csv.trim()).toBe('Data,Descrição,Direção,Tipo,Valor (EUR),Projetado,Por Confirmar');
  });

  it('escapes double quotes in description', () => {
    const csv = exportCashflow([{
      eventDate: '2026-05-10',
      amountCents: 1000,
      direction: 'in',
      sourceType: 'recurring_rule',
      sourceId: 'id-2',
      description: 'Salário "base"',
      isProjected: true,
      needsConfirm: false,
    }]);
    expect(csv).toContain('"Salário ""base"""');
    expect(csv).toContain('Entrada');
    expect(csv).toContain('Sim'); // isProjected: true
  });

  it('marks projected and needsConfirm events correctly', () => {
    const csv = exportCashflow([{
      eventDate: '2026-06-01',
      amountCents: 2000,
      direction: 'out',
      sourceType: 'recurring_rule',
      sourceId: 'id-3',
      description: 'Netflix',
      isProjected: true,
      needsConfirm: true,
    }]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain('Sim,Sim'); // isProjected=Sim, needsConfirm=Sim
  });
});
