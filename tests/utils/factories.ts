import type { Database } from '@/integrations/supabase/database.types';

type Tables = Database['public']['Tables'];

export type TestUser = {
  id: string;
  email: string;
  user_metadata: {
    name: string;
  };
  app_metadata: Record<string, never>;
  aud: 'authenticated';
  created_at: string;
};

let idCounter = 1;

const nextId = () => String(idCounter++).padStart(12, '0');
const uuid = () => `00000000-0000-0000-0000-${nextId()}`;
const now = () => new Date().toISOString();

export const makeUser = (
  overrides: Partial<{ id: string; email: string; name: string }> = {}
): TestUser => ({
  id: overrides.id ?? uuid(),
  email: overrides.email ?? 'test@example.com',
  user_metadata: { name: overrides.name ?? 'Test User' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: now(),
});

export const makeProfile = (
  overrides: Partial<Tables['profiles']['Row']> = {}
): Tables['profiles']['Row'] =>
  ({
    id: uuid(),
    user_id: uuid(),
    nome: 'Perfil Teste',
    first_name: 'Perfil',
    last_name: 'Teste',
    birth_date: null,
    foto_url: null,
    percentual_divisao: 50,
    personal_settings: null,
    phone: null,
    poupanca_mensal: 0,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  }) as Tables['profiles']['Row'];

export const makeFamily = (
  overrides: Partial<Tables['families']['Row']> = {}
): Tables['families']['Row'] =>
  ({
    id: uuid(),
    created_by: uuid(),
    nome: 'Familia Teste',
    description: 'Familia gerada para testes',
    settings: null,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  }) as Tables['families']['Row'];

export const makeFamilyMember = (
  overrides: Partial<Tables['family_members']['Row']> = {}
): Tables['family_members']['Row'] =>
  ({
    id: uuid(),
    family_id: uuid(),
    user_id: uuid(),
    role: 'member',
    permissions: [],
    joined_at: now(),
    ...overrides,
  }) as Tables['family_members']['Row'];

export const makeAccount = (
  overrides: Partial<Tables['accounts']['Row']> = {}
): Tables['accounts']['Row'] =>
  ({
    id: uuid(),
    user_id: uuid(),
    family_id: null,
    nome: 'Conta Teste',
    tipo: 'corrente',
    saldo: 1000,
    billing_cycle_day: null,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  }) as Tables['accounts']['Row'];

export const makeCategory = (
  overrides: Partial<Tables['categories']['Row']> = {}
): Tables['categories']['Row'] =>
  ({
    id: uuid(),
    user_id: uuid(),
    family_id: null,
    nome: 'Categoria Teste',
    normalized_nome: 'categoria teste',
    tipo: 'despesa',
    cor: '#888888',
    icone: 'Wallet',
    created_at: now(),
    ...overrides,
  }) as Tables['categories']['Row'];

export const makeTransaction = (
  overrides: Partial<Tables['transactions']['Row']> = {}
): Tables['transactions']['Row'] =>
  ({
    id: uuid(),
    user_id: uuid(),
    account_id: uuid(),
    categoria_id: uuid(),
    family_id: null,
    goal_id: null,
    tipo: 'despesa',
    valor: 50,
    descricao: 'Transacao Teste',
    data: now().slice(0, 10),
    created_at: now(),
    ...overrides,
  }) as Tables['transactions']['Row'];

export const makeGoal = (
  overrides: Partial<Tables['goals']['Row']> = {}
): Tables['goals']['Row'] =>
  ({
    id: uuid(),
    user_id: uuid(),
    family_id: null,
    account_id: uuid(),
    nome: 'Objetivo Teste',
    prazo: null,
    status: 'active',
    ativa: true,
    valor_atual: 0,
    valor_meta: null,
    valor_objetivo: 1000,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  }) as Tables['goals']['Row'];

export const makeBudget = (
  overrides: Partial<Tables['budgets']['Row']> = {}
): Tables['budgets']['Row'] =>
  ({
    id: uuid(),
    user_id: uuid(),
    family_id: null,
    categoria_id: uuid(),
    mes: '2026-04',
    valor: 250,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  }) as Tables['budgets']['Row'];

export const resetFactoryCounter = () => {
  idCounter = 1;
};
