import type { Goal } from '../../integrations/supabase/types';

export type GoalDomain = {
  id: string;
  nome: string;
  valorObjetivo: number;
  valorAtual: number;
  prazo: string | null;
  ativa: boolean;
  familyId?: string | null;
  accountId?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function mapGoalRowToDomain(row: Goal): GoalDomain {
  return {
    id: row.id,
    nome: row.nome,
    valorObjetivo: (row as any).target_cents != null
      ? (row as any).target_cents / 100
      : Number(row.valor_objetivo ?? row.valor_meta ?? 0),
    valorAtual: Number(row.valor_atual ?? 0),
    prazo: row.prazo ?? null,
    ativa: Boolean(row.ativa),
    familyId: row.family_id ?? null,
    accountId: row.account_id ?? null,
    status: row.status ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
} 