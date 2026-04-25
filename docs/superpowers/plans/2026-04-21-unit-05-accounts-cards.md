# Unit 5: Accounts & Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar contas bancárias de cartões de crédito em tabelas distintas (`accounts` + `credit_cards`), adicionar `currency`/`order_index`/`deleted_at` a `accounts`, enforçar FK dupla XOR em `transactions`, e criar serviço + UI scope-aware para ambos os instrumentos.

**Architecture:** `credit_cards` é uma tabela de primeira classe com limite, ciclo de faturação, APR e suporte a parcelamentos; `transactions.account_id XOR credit_card_id` é enforçado por CHECK constraint na DB; todas as páginas de contas convergem em `/app/contas` usando `useScope()` de Unit 1 — sem lógica duplicada entre personal e family. Cartões existentes em `accounts.tipo='cartão de crédito'` são migrados para a nova tabela na Task 3.

**Tech Stack:** Supabase PostgreSQL, RLS, React Query v5, TypeScript, Zod, shadcn/ui, Vitest + @testing-library/react

**Assumes complete:** Unit 1 (ScopeProvider + useScope), Unit 2 (amount_cents, is_goals removido)

---

## Desvios do Spec (documentados)

- `credit_card_installments` e `credit_card_statements` são estruturas previstas no spec para Unit 5 avançado. Este plano cria as tabelas mas não implementa toda a lógica de juros/fechos — essa lógica (cron de fecho, calculate_credit_card_interest) pertence à Unit 9 (Recorrentes). O schema está preparado.
- `billing_cycle_day` existente em `accounts` é migrado para `credit_cards.closing_day` durante a migração de dados (Task 3). A coluna é depois dropada de `accounts`.
- `useAccounts.ts` (legacy confirmado pelo spec) é eliminado nesta unit.
- Drag-n-drop UI (`@dnd-kit/sortable`) para reordenar contas é scaffolded mas o handler de persist (`reorderAccounts`) fica como TO-IMPLEMENT inline no componente — os testes cobrem o serviço subjacente. Reordenação completa em UI pode ser acabada em Unit 3 se necessário.

---

## Estrutura de Ficheiros

### Criar
- `supabase/migrations/20260421100000_unit05_accounts_columns.sql` — adiciona `currency`, `order_index`, `deleted_at` a `accounts`; remove `billing_cycle_day`
- `supabase/migrations/20260421110000_unit05_credit_cards.sql` — cria tabela `credit_cards` completa com RLS
- `supabase/migrations/20260421120000_unit05_credit_card_installments.sql` — cria `credit_card_installments` e `credit_card_statements`
- `supabase/migrations/20260421130000_unit05_transactions_xor.sql` — adiciona `credit_card_id` a `transactions` + CHECK XOR + migra linhas de cartões
- `supabase/migrations/20260421140000_unit05_rpcs.sql` — RPCs `get_user_accounts`, `get_user_credit_cards`, `soft_delete_account`, `soft_delete_credit_card`, `reorder_accounts`, `pay_credit_card`
- `src/services/creditCards.ts` — CRUD de cartões, ciclo de extrato, saldo utilizado
- `src/services/__tests__/creditCards.test.ts` — testes TDD do serviço de cartões
- `src/components/CreditCardFormNew.tsx` — form de criação/edição de cartão com campos de Unit 5
- `src/pages/ContasPage.tsx` — página unificada `/app/contas` (scope-aware)

### Modificar
- `src/services/accounts.ts` — soft-delete, reorder, currency; remover lógica de cartões; usar RPCs novas
- `src/services/__tests__/accounts.unit05.test.ts` — testes novos para soft-delete e reorder
- `src/shared/types/accounts.ts` — adicionar `CreditCard`, `CreditCardInsert`, `CreditCardWithBalance`; atualizar `AccountDomain`
- `src/validation/accountSchema.ts` — remover `'cartão de crédito'` de `tipo`; criar `creditCardSchema`
- `src/hooks/useAccountsQuery.ts` — adicionar hooks para credit cards; atualizar invalidation keys
- `src/components/AccountList.tsx` — mostrar apenas contas (não cartões); soft-delete em vez de hard-delete
- `src/features/personal/PersonalAccounts.tsx` — delegar para `ContasPage`
- `src/features/family/FamilyAccounts.tsx` — delegar para `ContasPage`

### Eliminar
- `src/hooks/useAccounts.ts` — legacy confirmado pelo spec

---

## Task 1: Migration — Adicionar currency / order_index / deleted_at a accounts

**Ficheiros:**
- Criar: `supabase/migrations/20260421100000_unit05_accounts_columns.sql`

- [ ] **Step 1.1: Escrever a migração**

```sql
-- supabase/migrations/20260421100000_unit05_accounts_columns.sql
-- Unit 5 / Task 1: accounts recebe currency, order_index, deleted_at
-- Remove billing_cycle_day (migra para credit_cards na Task 3)

set local search_path = public;

BEGIN;

-- Adicionar colunas novas
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS currency     text        NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS order_index  int,
  ADD COLUMN IF NOT EXISTS deleted_at   timestamptz;

-- Popular order_index com row_number baseado em created_at (determinístico)
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC NULLS LAST) AS rn
  FROM public.accounts
)
UPDATE public.accounts a
SET order_index = o.rn
FROM ordered o
WHERE a.id = o.id;

-- Índice para soft-delete: queries filtram deleted_at IS NULL por omissão
CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at
  ON public.accounts(deleted_at)
  WHERE deleted_at IS NULL;

-- Índice para ordenação
CREATE INDEX IF NOT EXISTS idx_accounts_order_index
  ON public.accounts(user_id, order_index);

-- Atualizar RLS: políticas existentes filtram deleted_at IS NULL implicitamente via RPCs.
-- As RLS policies em accounts usam user_id = auth.uid() ou family_members join.
-- Adicionar filtro deleted_at nas policies existentes para SELECT.

-- Verificar e recriar policy de SELECT para personal scope
DO $$
BEGIN
  -- Dropar policies existentes de SELECT em accounts se existirem
  -- (nomes variam consoante migração histórica)
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS sel_accounts_personal ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS accounts_select_policy ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Nova policy de SELECT: exclui soft-deleted
CREATE POLICY sel_accounts ON public.accounts
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR (
        family_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = accounts.family_id
            AND fm.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT policy: dono da conta
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS ins_accounts ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY ins_accounts ON public.accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE policy: dono da conta (não usa deleted_at para permitir restore futuro via RPC)
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS upd_accounts ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY upd_accounts ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE policy: manter para hard-delete de emergência (RPCs fazem soft-delete)
DO $$
BEGIN
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS del_accounts ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts';
    EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY del_accounts ON public.accounts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
```

- [ ] **Step 1.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 1.3: Verificar schema**

```bash
npx supabase db push --dry-run
```

Confirmar que `accounts` tem `currency`, `order_index`, `deleted_at`.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260421100000_unit05_accounts_columns.sql
git commit -m "feat(db): unit05 task1 — accounts gains currency, order_index, deleted_at + updated RLS"
```

---

## Task 2: Migration — Criar tabela credit_cards

**Ficheiros:**
- Criar: `supabase/migrations/20260421110000_unit05_credit_cards.sql`

- [ ] **Step 2.1: Escrever a migração**

```sql
-- supabase/migrations/20260421110000_unit05_credit_cards.sql
-- Unit 5 / Task 2: criar tabela credit_cards com RLS completa (personal + family)

set local search_path = public;

BEGIN;

CREATE TABLE public.credit_cards (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id             uuid        REFERENCES public.families(id) ON DELETE SET NULL,
  nome                  text        NOT NULL,
  -- Limite de crédito em cêntimos (ex: 5000 EUR = 500000)
  credit_limit_cents    bigint      NOT NULL DEFAULT 0 CHECK (credit_limit_cents >= 0),
  -- Saldo utilizado em cêntimos (calculado via RPCs; coluna denormalizada para performance)
  current_balance_cents bigint      NOT NULL DEFAULT 0,
  -- Dia de fecho do extrato (1-28)
  closing_day           smallint    CHECK (closing_day BETWEEN 1 AND 28),
  -- Dia de pagamento do extrato (1-28, após o fecho)
  payment_day           smallint    CHECK (payment_day BETWEEN 1 AND 28),
  -- APR: taxa de juro anual, ex: 0.1999 = 19.99%
  apr                   numeric(6,4) DEFAULT 0 CHECK (apr >= 0),
  -- Anuidade em cêntimos
  annual_fee_cents      bigint      NOT NULL DEFAULT 0 CHECK (annual_fee_cents >= 0),
  -- Moeda (ISO 4217)
  currency              text        NOT NULL DEFAULT 'EUR',
  -- Ordem de apresentação dentro do scope do user
  order_index           int,
  -- Soft-delete
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_credit_cards_user_id    ON public.credit_cards(user_id);
CREATE INDEX idx_credit_cards_family_id  ON public.credit_cards(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_credit_cards_deleted_at ON public.credit_cards(deleted_at) WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- SELECT: personal scope + family scope; exclui soft-deleted
CREATE POLICY sel_credit_cards ON public.credit_cards
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR (
        family_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = credit_cards.family_id
            AND fm.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: apenas o próprio user
CREATE POLICY ins_credit_cards ON public.credit_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: apenas o dono
CREATE POLICY upd_credit_cards ON public.credit_cards
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: apenas o dono (hard-delete de emergência; soft-delete via RPC)
CREATE POLICY del_credit_cards ON public.credit_cards
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;

COMMIT;
```

- [ ] **Step 2.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 2.3: Verificar RLS**

Correr no Supabase SQL Editor:

```sql
-- Confirmar que tabela existe com as colunas corretas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'credit_cards'
ORDER BY ordinal_position;

-- Confirmar RLS ativo
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'credit_cards';
```

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/20260421110000_unit05_credit_cards.sql
git commit -m "feat(db): unit05 task2 — create credit_cards table with full RLS (personal + family scope)"
```

---

## Task 3: Migration — Tabelas auxiliares de cartões (installments + statements)

**Ficheiros:**
- Criar: `supabase/migrations/20260421120000_unit05_credit_card_installments.sql`

- [ ] **Step 3.1: Escrever a migração**

```sql
-- supabase/migrations/20260421120000_unit05_credit_card_installments.sql
-- Unit 5 / Task 3: tabelas auxiliares para parcelamentos e extratos de cartão
-- Lógica de cron/juros implementada em Unit 9 — estas tabelas são o schema preparado.

set local search_path = public;

BEGIN;

-- Parcelamentos: quando uma transação de cartão é parcelada
CREATE TABLE public.credit_card_installments (
  id                   uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id       uuid      NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  -- transaction_id aponta para a transação original (credit_card_id preenchido)
  transaction_id       uuid      REFERENCES public.transactions(id) ON DELETE SET NULL,
  -- Valor total da compra em cêntimos
  total_cents          bigint    NOT NULL CHECK (total_cents > 0),
  -- Número de parcelas
  num_installments     smallint  NOT NULL CHECK (num_installments BETWEEN 2 AND 72),
  -- Parcela atual (começa em 1)
  current_installment  smallint  NOT NULL DEFAULT 1 CHECK (current_installment >= 1),
  -- Valor mensal de cada parcela em cêntimos (arredondado; última parcela absorve diferença)
  monthly_cents        bigint    NOT NULL CHECK (monthly_cents > 0),
  -- Data de início do parcelamento (primeiro mês)
  started_at           date      NOT NULL DEFAULT current_date,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_installments_card ON public.credit_card_installments(credit_card_id);
CREATE INDEX idx_cc_installments_tx   ON public.credit_card_installments(transaction_id);

ALTER TABLE public.credit_card_installments ENABLE ROW LEVEL SECURITY;

-- SELECT: quem tem acesso ao cartão tem acesso às suas parcelas
CREATE POLICY sel_cc_installments ON public.credit_card_installments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_installments.credit_card_id
        AND cc.deleted_at IS NULL
        AND (
          cc.user_id = auth.uid()
          OR (
            cc.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = cc.family_id AND fm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- INSERT/UPDATE/DELETE: apenas o dono do cartão via RPC (simplificado: user_id join)
CREATE POLICY ins_cc_installments ON public.credit_card_installments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_installments.credit_card_id
        AND cc.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_installments TO authenticated;

-- Extratos mensais de cartão (gerados no closing_day — lógica em Unit 9)
CREATE TABLE public.credit_card_statements (
  id                uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id    uuid      NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  -- statement_group para cartões consolidados (family-card na mesma fatura)
  parent_statement_id uuid    REFERENCES public.credit_card_statements(id) ON DELETE SET NULL,
  -- Data de fecho do extrato
  closing_date      date      NOT NULL,
  -- Data limite de pagamento
  due_date          date      NOT NULL,
  -- Total do extrato em cêntimos (soma das transações do ciclo)
  total_cents       bigint    NOT NULL DEFAULT 0,
  -- Total pago em cêntimos
  paid_cents        bigint    NOT NULL DEFAULT 0,
  -- Status: open | closed | paid | overdue
  status            text      NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','closed','paid','overdue')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, closing_date)
);

CREATE INDEX idx_cc_statements_card   ON public.credit_card_statements(credit_card_id);
CREATE INDEX idx_cc_statements_status ON public.credit_card_statements(status);

CREATE TRIGGER trg_cc_statements_updated_at
  BEFORE UPDATE ON public.credit_card_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_cc_statements ON public.credit_card_statements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_statements.credit_card_id
        AND cc.deleted_at IS NULL
        AND (
          cc.user_id = auth.uid()
          OR (
            cc.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = cc.family_id AND fm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY ins_cc_statements ON public.credit_card_statements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_statements.credit_card_id
        AND cc.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.credit_card_statements TO authenticated;

COMMIT;
```

- [ ] **Step 3.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 3.3: Commit**

```bash
git add supabase/migrations/20260421120000_unit05_credit_card_installments.sql
git commit -m "feat(db): unit05 task3 — create credit_card_installments + credit_card_statements tables"
```

---

## Task 4: Migration — transactions.credit_card_id + CHECK XOR + migração de dados

**Ficheiros:**
- Criar: `supabase/migrations/20260421130000_unit05_transactions_xor.sql`

- [ ] **Step 4.1: Escrever a migração**

```sql
-- supabase/migrations/20260421130000_unit05_transactions_xor.sql
-- Unit 5 / Task 4:
--   1. Adicionar credit_card_id a transactions
--   2. Criar CHECK XOR (account_id IS NULL) <> (credit_card_id IS NULL)
--   3. Migrar linhas onde account_id aponta para conta tipo='cartão de crédito'
--      → mover cartões para credit_cards, atualizar transactions.credit_card_id
--   4. Remover billing_cycle_day de accounts (já migrado para credit_cards.closing_day)

set local search_path = public;

BEGIN;

-- 1. Adicionar FK credit_card_id em transactions (nullable)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transactions_credit_card_id
  ON public.transactions(credit_card_id)
  WHERE credit_card_id IS NOT NULL;

-- 2. Migrar contas tipo='cartão de crédito' para tabela credit_cards
-- Inserir uma linha em credit_cards por cada conta legacy de cartão
INSERT INTO public.credit_cards (
  id,            -- reusar o mesmo id para facilitar migração de FKs
  user_id,
  family_id,
  nome,
  credit_limit_cents,
  current_balance_cents,
  closing_day,
  currency,
  order_index,
  created_at,
  updated_at
)
SELECT
  a.id,
  a.user_id,
  a.family_id,
  a.nome,
  0,             -- credit_limit_cents: desconhecido (legacy hardcoded 0)
  0,             -- current_balance_cents: recalculado abaixo
  a.billing_cycle_day::smallint,
  COALESCE(a.currency, 'EUR'),
  a.order_index,
  COALESCE(a.created_at::timestamptz, now()),
  COALESCE(a.updated_at::timestamptz, now())
FROM public.accounts a
WHERE a.tipo = 'cartão de crédito'
  AND a.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Atualizar current_balance_cents dos cartões migrados com base nas transações
UPDATE public.credit_cards cc
SET current_balance_cents = COALESCE((
  SELECT SUM(
    CASE
      WHEN t.tipo = 'despesa' THEN t.amount_cents
      WHEN t.tipo = 'receita' THEN -t.amount_cents
      ELSE 0
    END
  )
  FROM public.transactions t
  WHERE t.account_id = cc.id
), 0)
WHERE EXISTS (
  SELECT 1 FROM public.accounts a
  WHERE a.id = cc.id AND a.tipo = 'cartão de crédito'
);

-- 4. Atualizar transactions: para linhas onde account_id = cartão, mover para credit_card_id
UPDATE public.transactions t
SET
  credit_card_id = t.account_id,
  account_id     = NULL
FROM public.accounts a
WHERE a.id = t.account_id
  AND a.tipo = 'cartão de crédito';

-- 5. Agora que as transações foram migradas, verificar que todas as linhas têm exatamente um preenchido
-- (account_id IS NULL) <> (credit_card_id IS NULL) ≡ exatamente um não-nulo
-- Antes de adicionar a constraint, verificar que não há violações:
DO $$
DECLARE
  v_violations int;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM public.transactions
  WHERE NOT ((account_id IS NULL) <> (credit_card_id IS NULL));

  IF v_violations > 0 THEN
    RAISE EXCEPTION 'Existem % linhas em transactions que violam o CHECK XOR (account_id, credit_card_id). Investigar antes de aplicar constraint.', v_violations;
  END IF;
END $$;

-- 6. Adicionar CHECK constraint XOR
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transactions_instrument_xor
  CHECK ((account_id IS NULL) <> (credit_card_id IS NULL));

-- 7. Soft-delete das contas legacy de cartão em accounts
-- (não hard-delete para preservar histórico e possível rollback)
UPDATE public.accounts
SET deleted_at = now()
WHERE tipo = 'cartão de crédito'
  AND deleted_at IS NULL;

-- 8. Remover billing_cycle_day de accounts (dados já em credit_cards.closing_day)
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS billing_cycle_day;

COMMIT;
```

- [ ] **Step 4.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros. Se o DO $$ bloco ativar exceção, investigar com:

```sql
SELECT id, account_id, credit_card_id FROM transactions
WHERE NOT ((account_id IS NULL) <> (credit_card_id IS NULL))
LIMIT 20;
```

- [ ] **Step 4.3: Verificar migração de dados**

```sql
-- Confirmar que credit_cards tem as linhas migradas
SELECT id, nome, closing_day, current_balance_cents FROM credit_cards LIMIT 10;

-- Confirmar que transactions migradas têm credit_card_id preenchido e account_id = NULL
SELECT COUNT(*) FROM transactions WHERE credit_card_id IS NOT NULL AND account_id IS NULL;

-- Confirmar que não há linhas com ambos nulos ou ambos preenchidos
SELECT COUNT(*) FROM transactions
WHERE NOT ((account_id IS NULL) <> (credit_card_id IS NULL));
-- Esperado: 0

-- Confirmar que contas legacy de cartão têm deleted_at
SELECT COUNT(*) FROM accounts WHERE tipo = 'cartão de crédito' AND deleted_at IS NOT NULL;
```

- [ ] **Step 4.4: Commit**

```bash
git add supabase/migrations/20260421130000_unit05_transactions_xor.sql
git commit -m "feat(db): unit05 task4 — add credit_card_id to transactions + XOR CHECK + migrate credit card data"
```

---

## Task 5: Migration — RPCs scope-aware

**Ficheiros:**
- Criar: `supabase/migrations/20260421140000_unit05_rpcs.sql`

- [ ] **Step 5.1: Escrever a migração**

```sql
-- supabase/migrations/20260421140000_unit05_rpcs.sql
-- Unit 5 / Task 5: RPCs scope-aware para contas e cartões

set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_user_accounts: contas (não-cartões) visíveis pelo user (personal + family)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_accounts(
  p_user_id  uuid DEFAULT auth.uid(),
  p_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  account_id   uuid,
  nome         text,
  tipo         text,
  currency     text,
  order_index  int,
  family_id    uuid,
  amount_cents bigint,
  saldo_atual  numeric,    -- compatibilidade com UI existente (euros)
  saldo_disponivel numeric -- saldo - total reservado para goals
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id                                               AS account_id,
    a.nome,
    a.tipo,
    a.currency,
    a.order_index,
    a.family_id,
    a.amount_cents,
    (a.amount_cents::numeric / 100.0)                 AS saldo_atual,
    -- saldo_disponivel = saldo_atual - reservado em goals ativos
    (a.amount_cents::numeric / 100.0)
      - COALESCE((
          SELECT SUM(gl.amount_cents * gl.signed)::numeric / 100.0
          FROM public.goal_ledger gl
          JOIN public.goals g ON g.id = gl.goal_id
          WHERE gl.account_id = a.id
            AND g.status IS DISTINCT FROM 'completed'
        ), 0)                                         AS saldo_disponivel
  FROM public.accounts a
  WHERE a.deleted_at IS NULL
    AND a.tipo != 'cartão de crédito'
    AND (
      a.user_id = p_user_id
      OR (
        p_family_id IS NOT NULL
        AND a.family_id = p_family_id
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = p_family_id AND fm.user_id = p_user_id
        )
      )
    )
  ORDER BY a.order_index ASC NULLS LAST, a.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_accounts(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_user_credit_cards: cartões de crédito visíveis pelo user
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_credit_cards(
  p_user_id   uuid DEFAULT auth.uid(),
  p_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  card_id               uuid,
  nome                  text,
  credit_limit_cents    bigint,
  current_balance_cents bigint,
  available_cents       bigint,   -- credit_limit_cents - current_balance_cents
  utilization_pct       numeric,  -- current_balance_cents / credit_limit_cents * 100
  closing_day           smallint,
  payment_day           smallint,
  apr                   numeric,
  annual_fee_cents      bigint,
  currency              text,
  order_index           int,
  family_id             uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    cc.id                                                  AS card_id,
    cc.nome,
    cc.credit_limit_cents,
    cc.current_balance_cents,
    GREATEST(0, cc.credit_limit_cents - cc.current_balance_cents) AS available_cents,
    CASE
      WHEN cc.credit_limit_cents = 0 THEN 0
      ELSE ROUND((cc.current_balance_cents::numeric / cc.credit_limit_cents::numeric) * 100, 2)
    END                                                    AS utilization_pct,
    cc.closing_day,
    cc.payment_day,
    cc.apr,
    cc.annual_fee_cents,
    cc.currency,
    cc.order_index,
    cc.family_id
  FROM public.credit_cards cc
  WHERE cc.deleted_at IS NULL
    AND (
      cc.user_id = p_user_id
      OR (
        p_family_id IS NOT NULL
        AND cc.family_id = p_family_id
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = p_family_id AND fm.user_id = p_user_id
        )
      )
    )
  ORDER BY cc.order_index ASC NULLS LAST, cc.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_credit_cards(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- soft_delete_account
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_account(
  p_account_id uuid,
  p_user_id    uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verificar que é o dono
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta não encontrada ou sem permissão (id: %)', p_account_id;
  END IF;

  -- Verificar se há transações na conta (aviso, não bloqueia)
  -- A conta pode ser archivada mesmo com histórico

  UPDATE public.accounts
  SET deleted_at = now()
  WHERE id = p_account_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'account_id', p_account_id);
END;$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- soft_delete_credit_card
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_credit_card(
  p_card_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.credit_cards
    WHERE id = p_card_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cartão não encontrado ou sem permissão (id: %)', p_card_id;
  END IF;

  UPDATE public.credit_cards
  SET deleted_at = now()
  WHERE id = p_card_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'card_id', p_card_id);
END;$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_credit_card(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- reorder_accounts: atualiza order_index em batch
-- Input: array de jsonb [{id, order_index}]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_accounts(
  p_user_id uuid,
  p_items   jsonb  -- [{"id": "uuid", "order_index": N}, ...]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.accounts
    SET order_index = (v_item->>'order_index')::int
    WHERE id = (v_item->>'id')::uuid
      AND user_id = p_user_id
      AND deleted_at IS NULL;
  END LOOP;
END;$$;

GRANT EXECUTE ON FUNCTION public.reorder_accounts(uuid, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- reorder_credit_cards: atualiza order_index em batch para cartões
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_credit_cards(
  p_user_id uuid,
  p_items   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.credit_cards
    SET order_index = (v_item->>'order_index')::int
    WHERE id = (v_item->>'id')::uuid
      AND user_id = p_user_id
      AND deleted_at IS NULL;
  END LOOP;
END;$$;

GRANT EXECUTE ON FUNCTION public.reorder_credit_cards(uuid, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- pay_credit_card: pagar extrato de cartão a partir de conta bancária
-- Cria transação de saída na conta + atualiza current_balance_cents no cartão
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pay_credit_card(
  p_user_id        uuid,
  p_card_id        uuid,
  p_from_account_id uuid,
  p_amount_cents   bigint,
  p_date           date DEFAULT current_date,
  p_description    text DEFAULT 'Pagamento de cartão de crédito',
  p_operation_id   uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_id uuid;
  v_categoria_id uuid;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Montante de pagamento deve ser positivo';
  END IF;

  -- Verificar que o cartão pertence ao user
  IF NOT EXISTS (
    SELECT 1 FROM public.credit_cards
    WHERE id = p_card_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cartão não encontrado ou sem permissão';
  END IF;

  -- Verificar que a conta origem pertence ao user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_from_account_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta origem não encontrada ou sem permissão';
  END IF;

  -- Obter ou criar categoria 'Pagamento Cartão'
  SELECT id INTO v_categoria_id
  FROM public.categories
  WHERE nome = 'Pagamento Cartão' AND user_id = p_user_id
  LIMIT 1;

  IF v_categoria_id IS NULL THEN
    INSERT INTO public.categories (nome, user_id, cor)
    VALUES ('Pagamento Cartão', p_user_id, '#6366F1')
    RETURNING id INTO v_categoria_id;
  END IF;

  -- Criar transação de saída na conta bancária
  INSERT INTO public.transactions (
    account_id, categoria_id, user_id, amount_cents,
    tipo, data, descricao, operation_id
  )
  VALUES (
    p_from_account_id, v_categoria_id, p_user_id, p_amount_cents,
    'despesa', p_date, p_description, p_operation_id
  )
  RETURNING id INTO v_tx_id;

  -- Reduzir current_balance_cents do cartão
  UPDATE public.credit_cards
  SET current_balance_cents = GREATEST(0, current_balance_cents - p_amount_cents)
  WHERE id = p_card_id;

  RETURN jsonb_build_object(
    'success',      true,
    'transaction_id', v_tx_id,
    'card_id',      p_card_id,
    'amount_cents', p_amount_cents
  );
END;$$;

GRANT EXECUTE ON FUNCTION public.pay_credit_card(uuid, uuid, uuid, bigint, date, text, uuid) TO authenticated;
```

- [ ] **Step 5.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 5.3: Testar RPC no SQL Editor**

```sql
-- get_user_accounts (substituir pelo user_id real)
SELECT * FROM get_user_accounts(auth.uid()) LIMIT 5;

-- get_user_credit_cards
SELECT * FROM get_user_credit_cards(auth.uid()) LIMIT 5;
```

- [ ] **Step 5.4: Commit**

```bash
git add supabase/migrations/20260421140000_unit05_rpcs.sql
git commit -m "feat(db): unit05 task5 — scope-aware RPCs: get_user_accounts, get_user_credit_cards, soft_delete_*, reorder_*, pay_credit_card"
```

---

## Task 6: Regenerar tipos TypeScript + atualizar interfaces

**Ficheiros:**
- Modificar: `src/integrations/supabase/types.ts` (via `npm run types:gen`)
- Modificar: `src/shared/types/accounts.ts`

- [ ] **Step 6.1: Regenerar tipos**

```bash
npm run types:gen
```

Esperado: `src/integrations/supabase/types.ts` atualizado com `credit_cards`, `credit_card_installments`, `credit_card_statements` e os novos campos em `accounts`.

- [ ] **Step 6.2: Verificar compilação antes de editar tipos manuais**

```bash
npx tsc --noEmit
```

Anotar todos os erros para corrigir nos passos seguintes.

- [ ] **Step 6.3: Atualizar src/shared/types/accounts.ts**

Substituir o conteúdo por:

```typescript
// src/shared/types/accounts.ts
import type { Account, AccountWithBalances } from '../../integrations/supabase/types';

export type AccountDomain = {
  id: string;
  name: string;
  type: string;
  currency: string;
  orderIndex: number | null;
  deletedAt: string | null;
  createdAt?: string | null;
};

export type AccountWithBalancesDomain = {
  accountId: string;
  name: string;
  type?: string | null;
  familyId?: string | null;
  currency: string;
  orderIndex: number | null;
  currentBalanceCents: number;
  currentBalance: number;       // euros, para display
  availableBalance: number;
  reservedTotal: number;
  isInDebt?: boolean | null;
};

// credit_cards
export type CreditCardDomain = {
  id: string;
  name: string;
  currency: string;
  orderIndex: number | null;
  familyId: string | null;
  creditLimitCents: number;
  currentBalanceCents: number;
  availableCents: number;
  utilizationPct: number;
  closingDay: number | null;
  paymentDay: number | null;
  apr: number;
  annualFeeCents: number;
};

export function mapAccountRowToDomain(row: Account): AccountDomain {
  return {
    id: row.id,
    name: row.nome,
    type: row.tipo,
    currency: (row as any).currency ?? 'EUR',
    orderIndex: (row as any).order_index ?? null,
    deletedAt: (row as any).deleted_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function mapAccountWithBalancesToDomain(row: AccountWithBalances): AccountWithBalancesDomain {
  const amountCents: number = (row as any).amount_cents ?? Math.round((row.saldo_atual ?? 0) * 100);
  return {
    accountId: row.account_id,
    name: row.nome,
    type: row.tipo ?? null,
    familyId: (row as any).family_id ?? null,
    currency: (row as any).currency ?? 'EUR',
    orderIndex: (row as any).order_index ?? null,
    currentBalanceCents: amountCents,
    currentBalance: row.saldo_atual,
    availableBalance: row.saldo_disponivel ?? row.saldo_atual,
    reservedTotal: row.total_reservado ?? 0,
    isInDebt: null,
  };
}

export function mapCreditCardRpcToDomain(row: {
  card_id: string;
  nome: string;
  credit_limit_cents: number;
  current_balance_cents: number;
  available_cents: number;
  utilization_pct: number;
  closing_day: number | null;
  payment_day: number | null;
  apr: number;
  annual_fee_cents: number;
  currency: string;
  order_index: number | null;
  family_id: string | null;
}): CreditCardDomain {
  return {
    id: row.card_id,
    name: row.nome,
    currency: row.currency,
    orderIndex: row.order_index,
    familyId: row.family_id,
    creditLimitCents: row.credit_limit_cents,
    currentBalanceCents: row.current_balance_cents,
    availableCents: row.available_cents,
    utilizationPct: row.utilization_pct,
    closingDay: row.closing_day,
    paymentDay: row.payment_day,
    apr: row.apr,
    annualFeeCents: row.annual_fee_cents,
  };
}
```

- [ ] **Step 6.4: Verificar compilação após editar tipos**

```bash
npx tsc --noEmit
```

Corrigir quaisquer erros de tipo resultantes das mudanças em `AccountDomain`.

- [ ] **Step 6.5: Commit**

```bash
git add src/integrations/supabase/types.ts src/shared/types/accounts.ts
git commit -m "feat(types): unit05 task6 — regenerate DB types, update AccountDomain, add CreditCardDomain"
```

---

## Task 7: Atualizar accounts service (soft-delete, reorder, currency)

**Ficheiros:**
- Modificar: `src/services/accounts.ts`
- Criar: `src/services/__tests__/accounts.unit05.test.ts`

- [ ] **Step 7.1: Escrever o teste primeiro (TDD)**

Criar `src/services/__tests__/accounts.unit05.test.ts`:

```typescript
// src/services/__tests__/accounts.unit05.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { softDeleteAccount, reorderAccounts, getAccountsScoped } from '../accounts';

describe('accounts service — Unit 5', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('softDeleteAccount', () => {
    it('chama RPC soft_delete_account com account_id e user_id', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, account_id: 'acc-1' },
        error: null,
      });

      const result = await softDeleteAccount('acc-1', 'user-1');
      expect(supabase.rpc).toHaveBeenCalledWith('soft_delete_account', {
        p_account_id: 'acc-1',
        p_user_id: 'user-1',
      });
      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });

    it('devolve error quando RPC falha', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'Conta não encontrada' },
      });

      const result = await softDeleteAccount('acc-missing', 'user-1');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('reorderAccounts', () => {
    it('chama RPC reorder_accounts com items JSON', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: null });

      const items = [
        { id: 'acc-1', order_index: 0 },
        { id: 'acc-2', order_index: 1 },
      ];
      await reorderAccounts('user-1', items);

      expect(supabase.rpc).toHaveBeenCalledWith('reorder_accounts', {
        p_user_id: 'user-1',
        p_items: items,
      });
    });
  });

  describe('getAccountsScoped', () => {
    it('chama RPC get_user_accounts com user_id', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{ account_id: 'acc-1', nome: 'Conta', tipo: 'corrente', currency: 'EUR', saldo_atual: 1000 }],
        error: null,
      });

      const result = await getAccountsScoped({ userId: 'user-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_accounts', {
        p_user_id: 'user-1',
        p_family_id: null,
      });
      expect(result.data).toHaveLength(1);
    });

    it('inclui family_id quando scope é family', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({ data: [], error: null });

      await getAccountsScoped({ userId: 'user-1', familyId: 'fam-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_accounts', {
        p_user_id: 'user-1',
        p_family_id: 'fam-1',
      });
    });
  });
});
```

- [ ] **Step 7.2: Correr teste — verificar que falha**

```bash
npx vitest run src/services/__tests__/accounts.unit05.test.ts
```

Esperado: FAIL — `softDeleteAccount is not a function`, `reorderAccounts is not a function`, `getAccountsScoped is not a function`.

- [ ] **Step 7.3: Implementar as novas funções em src/services/accounts.ts**

Ler o ficheiro atual (já lido no contexto desta sessão). Adicionar as seguintes funções ao final do ficheiro **sem remover as existentes** (compatibilidade durante transição):

```typescript
// src/services/accounts.ts — ADICIONAR ao final do ficheiro existente

// ── Unit 5: scope-aware accounts ────────────────────────────────────────────

export const getAccountsScoped = async (
  options: { userId: string; familyId?: string | null }
): Promise<{ data: import('../integrations/supabase/types').AccountWithBalances[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_accounts', {
      p_user_id: options.userId,
      p_family_id: options.familyId ?? null,
    });
    if (error) return { data: null, error };
    return { data: (data || []) as import('../integrations/supabase/types').AccountWithBalances[], error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const softDeleteAccount = async (
  accountId: string,
  userId?: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return { data: null, error: { message: 'Utilizador não autenticado' } };

    const { data, error } = await supabase.rpc('soft_delete_account', {
      p_account_id: accountId,
      p_user_id: resolvedUserId,
    });
    if (error) return { data: null, error };
    return { data: (data as { success?: boolean } | null)?.success ? true : null, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const reorderAccounts = async (
  userId: string,
  items: Array<{ id: string; order_index: number }>
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.rpc('reorder_accounts', {
      p_user_id: userId,
      p_items: items,
    });
    return { error };
  } catch (error) {
    return { error };
  }
};
```

- [ ] **Step 7.4: Correr teste — verificar que passa**

```bash
npx vitest run src/services/__tests__/accounts.unit05.test.ts
```

Esperado: PASS (3 suites, todos os it passam).

- [ ] **Step 7.5: Correr todos os testes existentes de accounts**

```bash
npx vitest run tests/unit/services/accounts.test.ts
```

Esperado: PASS (testes existentes não devem quebrar).

- [ ] **Step 7.6: Commit**

```bash
git add src/services/accounts.ts src/services/__tests__/accounts.unit05.test.ts
git commit -m "feat(service): unit05 task7 — add getAccountsScoped, softDeleteAccount, reorderAccounts to accounts service"
```

---

## Task 8: Criar serviço credit cards

**Ficheiros:**
- Criar: `src/services/creditCards.ts`
- Criar: `src/services/__tests__/creditCards.test.ts`

- [ ] **Step 8.1: Escrever o teste primeiro (TDD)**

```typescript
// src/services/__tests__/creditCards.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import {
  getCreditCardsScoped,
  createCreditCard,
  updateCreditCard,
  softDeleteCreditCard,
  payCreditCard,
} from '../creditCards';

describe('creditCards service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getCreditCardsScoped', () => {
    it('chama RPC get_user_credit_cards com user_id', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{ card_id: 'card-1', nome: 'Cartão Visa', currency: 'EUR' }],
        error: null,
      });

      const result = await getCreditCardsScoped({ userId: 'user-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_credit_cards', {
        p_user_id: 'user-1',
        p_family_id: null,
      });
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('inclui family_id quando scope é family', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({ data: [], error: null });

      await getCreditCardsScoped({ userId: 'user-1', familyId: 'fam-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_credit_cards', {
        p_user_id: 'user-1',
        p_family_id: 'fam-1',
      });
    });
  });

  describe('createCreditCard', () => {
    it('insere na tabela credit_cards e devolve a linha criada', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockCard = { id: 'card-new', nome: 'Cartão MB', user_id: 'user-1' };
      (supabase.from as any).mockReturnThis();
      (supabase.insert as any).mockReturnThis();
      (supabase.select as any).mockReturnThis();
      (supabase.single as any).mockResolvedValueOnce({ data: mockCard, error: null });

      const result = await createCreditCard({
        user_id: 'user-1',
        nome: 'Cartão MB',
        credit_limit_cents: 500000,
        currency: 'EUR',
      });

      expect(supabase.from).toHaveBeenCalledWith('credit_cards');
      expect(result.data).toEqual(mockCard);
    });
  });

  describe('softDeleteCreditCard', () => {
    it('chama RPC soft_delete_credit_card', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, card_id: 'card-1' },
        error: null,
      });

      const result = await softDeleteCreditCard('card-1', 'user-1');
      expect(supabase.rpc).toHaveBeenCalledWith('soft_delete_credit_card', {
        p_card_id: 'card-1',
        p_user_id: 'user-1',
      });
      expect(result.data).toBe(true);
    });
  });

  describe('payCreditCard', () => {
    it('chama RPC pay_credit_card com todos os parâmetros', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, transaction_id: 'tx-1', card_id: 'card-1', amount_cents: 10000 },
        error: null,
      });

      const result = await payCreditCard({
        userId: 'user-1',
        cardId: 'card-1',
        fromAccountId: 'acc-1',
        amountCents: 10000,
        date: '2026-04-21',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('pay_credit_card', expect.objectContaining({
        p_user_id: 'user-1',
        p_card_id: 'card-1',
        p_from_account_id: 'acc-1',
        p_amount_cents: 10000,
      }));
      expect(result.data?.success).toBe(true);
    });
  });
});
```

- [ ] **Step 8.2: Correr teste — verificar que falha**

```bash
npx vitest run src/services/__tests__/creditCards.test.ts
```

Esperado: FAIL — `Cannot find module '../creditCards'`.

- [ ] **Step 8.3: Implementar src/services/creditCards.ts**

```typescript
// src/services/creditCards.ts
// Unit 5: serviço de cartões de crédito
import { supabase } from '../lib/supabaseClient';
import { logger } from '../shared/lib/logger';
import type { CreditCardDomain, mapCreditCardRpcToDomain } from '../shared/types/accounts';

export type CreditCardInsertData = {
  user_id: string;
  family_id?: string | null;
  nome: string;
  credit_limit_cents: number;
  current_balance_cents?: number;
  closing_day?: number | null;
  payment_day?: number | null;
  apr?: number;
  annual_fee_cents?: number;
  currency?: string;
  order_index?: number | null;
};

export type CreditCardUpdateData = Partial<CreditCardInsertData>;

// ── Leitura ──────────────────────────────────────────────────────────────────

export const getCreditCardsScoped = async (
  options: { userId: string; familyId?: string | null }
): Promise<{ data: Record<string, unknown>[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_credit_cards', {
      p_user_id: options.userId,
      p_family_id: options.familyId ?? null,
    });
    if (error) return { data: null, error };
    return { data: (data || []) as Record<string, unknown>[], error: null };
  } catch (error) {
    logger.error('[creditCards] getCreditCardsScoped', error);
    return { data: null, error };
  }
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const createCreditCard = async (
  cardData: CreditCardInsertData
): Promise<{ data: Record<string, unknown> | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('credit_cards')
      .insert([{
        user_id:              cardData.user_id,
        family_id:            cardData.family_id ?? null,
        nome:                 cardData.nome,
        credit_limit_cents:   cardData.credit_limit_cents,
        current_balance_cents: cardData.current_balance_cents ?? 0,
        closing_day:          cardData.closing_day ?? null,
        payment_day:          cardData.payment_day ?? null,
        apr:                  cardData.apr ?? 0,
        annual_fee_cents:     cardData.annual_fee_cents ?? 0,
        currency:             cardData.currency ?? 'EUR',
        order_index:          cardData.order_index ?? null,
      }])
      .select()
      .single();
    return { data: data as Record<string, unknown> | null, error };
  } catch (error) {
    logger.error('[creditCards] createCreditCard', error);
    return { data: null, error };
  }
};

export const updateCreditCard = async (
  cardId: string,
  updates: CreditCardUpdateData,
  userId?: string
): Promise<{ data: Record<string, unknown> | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return { data: null, error: { message: 'Utilizador não autenticado' } };

    const { data, error } = await supabase
      .from('credit_cards')
      .update(updates as Record<string, unknown>)
      .eq('id', cardId)
      .eq('user_id', resolvedUserId)
      .select()
      .single();
    return { data: data as Record<string, unknown> | null, error };
  } catch (error) {
    logger.error('[creditCards] updateCreditCard', error);
    return { data: null, error };
  }
};

export const softDeleteCreditCard = async (
  cardId: string,
  userId?: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return { data: null, error: { message: 'Utilizador não autenticado' } };

    const { data, error } = await supabase.rpc('soft_delete_credit_card', {
      p_card_id: cardId,
      p_user_id: resolvedUserId,
    });
    if (error) return { data: null, error };
    return { data: (data as { success?: boolean } | null)?.success ? true : null, error: null };
  } catch (error) {
    logger.error('[creditCards] softDeleteCreditCard', error);
    return { data: null, error };
  }
};

// ── Pagamento ─────────────────────────────────────────────────────────────────

export type PayCreditCardParams = {
  userId: string;
  cardId: string;
  fromAccountId: string;
  amountCents: number;
  date?: string;
  description?: string;
};

export const payCreditCard = async (
  params: PayCreditCardParams
): Promise<{ data: { success: boolean; transaction_id: string; card_id: string; amount_cents: number } | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('pay_credit_card', {
      p_user_id:          params.userId,
      p_card_id:          params.cardId,
      p_from_account_id:  params.fromAccountId,
      p_amount_cents:     params.amountCents,
      p_date:             params.date ?? new Date().toISOString().split('T')[0],
      p_description:      params.description ?? 'Pagamento de cartão de crédito',
      p_operation_id:     crypto.randomUUID(),
    });
    if (error) return { data: null, error };
    return { data: data as { success: boolean; transaction_id: string; card_id: string; amount_cents: number } | null, error: null };
  } catch (error) {
    logger.error('[creditCards] payCreditCard', error);
    return { data: null, error };
  }
};

// ── Reordenação ───────────────────────────────────────────────────────────────

export const reorderCreditCards = async (
  userId: string,
  items: Array<{ id: string; order_index: number }>
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.rpc('reorder_credit_cards', {
      p_user_id: userId,
      p_items: items,
    });
    return { error };
  } catch (error) {
    return { error };
  }
};
```

- [ ] **Step 8.4: Correr teste — verificar que passa**

```bash
npx vitest run src/services/__tests__/creditCards.test.ts
```

Esperado: PASS (4 suites, todos os it passam).

- [ ] **Step 8.5: Commit**

```bash
git add src/services/creditCards.ts src/services/__tests__/creditCards.test.ts
git commit -m "feat(service): unit05 task8 — create creditCards service with TDD (CRUD, softDelete, pay, reorder)"
```

---

## Task 9: Atualizar AccountList + eliminar useAccounts.ts legacy

**Ficheiros:**
- Modificar: `src/components/AccountList.tsx`
- Eliminar: `src/hooks/useAccounts.ts`
- Modificar: `src/validation/accountSchema.ts`
- Modificar: `src/hooks/useAccountsQuery.ts`

- [ ] **Step 9.1: Verificar que useAccounts.ts não tem consumers ativos**

```bash
grep -r "useAccounts\b" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas `src/hooks/useAccounts.ts` e possivelmente `src/hooks/useAccountsQuery.ts` (re-export). Se houver outros, migrar para `useAccountsQuery` antes de eliminar.

- [ ] **Step 9.2: Eliminar o ficheiro legacy**

```bash
git rm src/hooks/useAccounts.ts
```

- [ ] **Step 9.3: Atualizar accountSchema.ts — remover 'cartão de crédito' do tipo**

Ler o ficheiro. Substituir conteúdo por:

```typescript
// src/validation/accountSchema.ts
import { z } from 'zod';

// Schema para contas bancárias (não inclui cartões de crédito — têm schema próprio)
export const accountSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório (mínimo 2 caracteres)'),
  tipo: z.enum(['corrente', 'poupança', 'investimento', 'outro'], { message: 'Tipo inválido' }),
  currency: z.string().default('EUR'),
  saldoAtual: z.number().optional(),
  ajusteSaldo: z.number().optional(),
});

export type AccountSchema = z.infer<typeof accountSchema>;

// Schema para cartões de crédito
export const creditCardSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório (mínimo 2 caracteres)'),
  credit_limit_cents: z
    .number({ required_error: 'Limite obrigatório' })
    .int('O limite deve ser em cêntimos (inteiro)')
    .nonnegative('O limite não pode ser negativo'),
  closing_day: z
    .number()
    .int()
    .min(1)
    .max(28, 'Dia de fecho deve ser entre 1 e 28')
    .nullable()
    .optional(),
  payment_day: z
    .number()
    .int()
    .min(1)
    .max(28, 'Dia de pagamento deve ser entre 1 e 28')
    .nullable()
    .optional(),
  apr: z.number().min(0).max(1, 'APR deve ser entre 0 e 1 (ex: 0.1999 = 19.99%)').default(0),
  annual_fee_cents: z.number().int().nonnegative().default(0),
  currency: z.string().default('EUR'),
});

export type CreditCardSchema = z.infer<typeof creditCardSchema>;
```

- [ ] **Step 9.4: Adicionar hooks para credit cards em useAccountsQuery.ts**

Ler o ficheiro atual. Adicionar ao final:

```typescript
// useAccountsQuery.ts — ADICIONAR (não substituir o existente)
import { getCreditCardsScoped, softDeleteCreditCard, createCreditCard, updateCreditCard } from '../services/creditCards';

export const useCreditCards = (options: { userId?: string; familyId?: string | null }) => {
  return useQuery({
    queryKey: ['credit_cards', options.userId, options.familyId ?? null],
    queryFn: () => getCreditCardsScoped({ userId: options.userId!, familyId: options.familyId }),
    enabled: !!options.userId,
  });
};

export const useSoftDeleteCreditCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, userId }: { cardId: string; userId?: string }) =>
      softDeleteCreditCard(cardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
    },
  });
};

export const useCreateCreditCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCreditCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
    },
  });
};

export const useUpdateCreditCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, updates, userId }: { cardId: string; updates: import('../services/creditCards').CreditCardUpdateData; userId?: string }) =>
      updateCreditCard(cardId, updates, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_cards'] });
    },
  });
};
```

- [ ] **Step 9.5: Atualizar AccountList.tsx — usar softDelete em vez de hard-delete**

Ler o ficheiro `src/components/AccountList.tsx`. Localizar o handler de delete e substituir a chamada a `deleteAccount` por `softDeleteAccount`:

```typescript
// Antes (AccountList.tsx):
// const result = await deleteAccount(accountId, userId);

// Depois:
import { softDeleteAccount } from '../services/accounts';
// ...
const result = await softDeleteAccount(accountId, userId);
```

Confirmar que o confirm dialog continua a funcionar e que o texto diz "Arquivar" em vez de "Eliminar" onde aplicável.

- [ ] **Step 9.6: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 9.7: Correr todos os testes**

```bash
npm test
```

- [ ] **Step 9.8: Commit**

```bash
git add src/validation/accountSchema.ts \
        src/hooks/useAccountsQuery.ts \
        src/components/AccountList.tsx
git commit -m "feat(frontend): unit05 task9 — update accountSchema (remove cartão de crédito), add credit card hooks, soft-delete in AccountList"
```

---

## Task 10: Criar CreditCardFormNew.tsx

**Ficheiros:**
- Criar: `src/components/CreditCardFormNew.tsx`

- [ ] **Step 10.1: Escrever o teste do componente**

Criar `src/components/__tests__/CreditCardFormNew.test.tsx`:

```typescript
// src/components/__tests__/CreditCardFormNew.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../hooks/useAccountsQuery', () => ({
  useCreateCreditCard: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'card-new' }, error: null }),
    isPending: false,
  }),
  useUpdateCreditCard: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ data: { id: 'card-1' }, error: null }),
    isPending: false,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import CreditCardFormNew from '../CreditCardFormNew';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('CreditCardFormNew', () => {
  it('renderiza campos obrigatórios', () => {
    render(
      <CreditCardFormNew onSuccess={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByLabelText(/nome do cartão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/limite de crédito/i)).toBeInTheDocument();
  });

  it('mostra erro de validação quando nome é vazio', async () => {
    render(
      <CreditCardFormNew onSuccess={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    );
    fireEvent.click(screen.getByRole('button', { name: /guardar|criar/i }));
    await waitFor(() => {
      expect(screen.getByText(/nome obrigatório/i)).toBeInTheDocument();
    });
  });

  it('chama onSuccess após submissão bem-sucedida', async () => {
    const onSuccess = vi.fn();
    render(
      <CreditCardFormNew onSuccess={onSuccess} onCancel={vi.fn()} />,
      { wrapper }
    );
    fireEvent.change(screen.getByLabelText(/nome do cartão/i), { target: { value: 'Visa Platinum' } });
    fireEvent.change(screen.getByLabelText(/limite de crédito/i), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|criar/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
```

- [ ] **Step 10.2: Correr teste — verificar que falha**

```bash
npx vitest run src/components/__tests__/CreditCardFormNew.test.tsx
```

Esperado: FAIL — `Cannot find module '../CreditCardFormNew'`.

- [ ] **Step 10.3: Implementar CreditCardFormNew.tsx**

```typescript
// src/components/CreditCardFormNew.tsx
// Unit 5: form de criação/edição de cartão de crédito
// Substitui CreditCardForm.tsx (que misturava conta e cartão na mesma tabela accounts)
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditCardSchema, CreditCardSchema } from '../validation/accountSchema';
import { useAuth } from '../contexts/AuthContext';
import { useCreateCreditCard, useUpdateCreditCard } from '../hooks/useAccountsQuery';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { FormSubmitButton } from './ui/loading-button';
import { euroToCents, centsToEuro } from '../lib/money';

interface CreditCardFormNewProps {
  initialData?: {
    id?: string;
    nome?: string;
    credit_limit_cents?: number;
    closing_day?: number | null;
    payment_day?: number | null;
    apr?: number;
    annual_fee_cents?: number;
    currency?: string;
  };
  familyId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreditCardFormNew: React.FC<CreditCardFormNewProps> = ({
  initialData,
  familyId,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(initialData?.id);

  const createMutation = useCreateCreditCard();
  const updateMutation = useUpdateCreditCard();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreditCardSchema>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      nome: initialData?.nome ?? '',
      credit_limit_cents: initialData?.credit_limit_cents ?? 0,
      closing_day: initialData?.closing_day ?? null,
      payment_day: initialData?.payment_day ?? null,
      apr: initialData?.apr ?? 0,
      annual_fee_cents: initialData?.annual_fee_cents ?? 0,
      currency: initialData?.currency ?? 'EUR',
    },
  });

  const onSubmit = async (values: CreditCardSchema) => {
    if (!user?.id) return;
    setSubmitError(null);
    try {
      if (isEditing && initialData?.id) {
        const { error } = await updateMutation.mutateAsync({
          cardId: initialData.id,
          updates: values,
          userId: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await createMutation.mutateAsync({
          user_id: user.id,
          family_id: familyId ?? null,
          ...values,
        });
        if (error) throw error;
      }
      onSuccess?.();
    } catch (err: unknown) {
      setSubmitError((err as { message?: string })?.message ?? 'Erro ao guardar cartão');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="nome">Nome do cartão</Label>
        <Input id="nome" {...register('nome')} placeholder="ex: Visa Platinum CGD" />
        {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="credit_limit_cents">Limite de crédito (€)</Label>
        <Input
          id="credit_limit_cents"
          type="number"
          step="0.01"
          min="0"
          {...register('credit_limit_cents', {
            setValueAs: (v) => Math.round(parseFloat(v) * 100) || 0,
          })}
          placeholder="ex: 5000"
        />
        {errors.credit_limit_cents && (
          <p className="text-sm text-destructive">{errors.credit_limit_cents.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="closing_day">Dia de fecho</Label>
          <Input
            id="closing_day"
            type="number"
            min="1"
            max="28"
            {...register('closing_day', { setValueAs: (v) => (v === '' ? null : parseInt(v)) })}
            placeholder="ex: 25"
          />
          {errors.closing_day && (
            <p className="text-sm text-destructive">{errors.closing_day.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="payment_day">Dia de pagamento</Label>
          <Input
            id="payment_day"
            type="number"
            min="1"
            max="28"
            {...register('payment_day', { setValueAs: (v) => (v === '' ? null : parseInt(v)) })}
            placeholder="ex: 5"
          />
          {errors.payment_day && (
            <p className="text-sm text-destructive">{errors.payment_day.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="apr">Taxa de juro anual (APR)</Label>
          <Input
            id="apr"
            type="number"
            step="0.0001"
            min="0"
            max="1"
            {...register('apr', { setValueAs: (v) => parseFloat(v) || 0 })}
            placeholder="ex: 0.1999"
          />
          <p className="text-xs text-muted-foreground">0.1999 = 19.99%</p>
          {errors.apr && <p className="text-sm text-destructive">{errors.apr.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="annual_fee_cents">Anuidade (€)</Label>
          <Input
            id="annual_fee_cents"
            type="number"
            step="0.01"
            min="0"
            {...register('annual_fee_cents', {
              setValueAs: (v) => Math.round(parseFloat(v) * 100) || 0,
            })}
            placeholder="ex: 24.99"
          />
          {errors.annual_fee_cents && (
            <p className="text-sm text-destructive">{errors.annual_fee_cents.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <FormSubmitButton isLoading={isSubmitting}>
          {isEditing ? 'Guardar alterações' : 'Criar cartão'}
        </FormSubmitButton>
      </div>
    </form>
  );
};

export default CreditCardFormNew;
```

- [ ] **Step 10.4: Correr teste — verificar que passa**

```bash
npx vitest run src/components/__tests__/CreditCardFormNew.test.tsx
```

Esperado: PASS (3 testes).

- [ ] **Step 10.5: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 10.6: Commit**

```bash
git add src/components/CreditCardFormNew.tsx \
        src/components/__tests__/CreditCardFormNew.test.tsx
git commit -m "feat(ui): unit05 task10 — create CreditCardFormNew component with validation + TDD"
```

---

## Task 11: Criar ContasPage.tsx — página unificada scope-aware

**Ficheiros:**
- Criar: `src/pages/ContasPage.tsx`

- [ ] **Step 11.1: Escrever o teste do componente**

Criar `src/pages/__tests__/ContasPage.test.tsx`:

```typescript
// src/pages/__tests__/ContasPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../features/scope/useScope', () => ({
  useScope: () => ({ type: 'personal', userId: 'user-1', familyId: null }),
}));

vi.mock('../../hooks/useAccountsQuery', () => ({
  useAccountsScoped: () => ({
    data: {
      data: [{ account_id: 'acc-1', nome: 'Conta Corrente', tipo: 'corrente', saldo_atual: 1500, currency: 'EUR' }],
    },
    isLoading: false,
  }),
  useCreditCards: () => ({
    data: {
      data: [{ card_id: 'card-1', nome: 'Visa Platinum', credit_limit_cents: 500000, current_balance_cents: 150000, utilization_pct: 30 }],
    },
    isLoading: false,
  }),
  useSoftDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSoftDeleteCreditCard: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import ContasPage from '../ContasPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('ContasPage', () => {
  it('renderiza secção de contas bancárias', () => {
    render(<ContasPage />, { wrapper });
    expect(screen.getByText(/contas bancárias/i)).toBeInTheDocument();
    expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
  });

  it('renderiza secção de cartões de crédito', () => {
    render(<ContasPage />, { wrapper });
    expect(screen.getByText(/cartões de crédito/i)).toBeInTheDocument();
    expect(screen.getByText('Visa Platinum')).toBeInTheDocument();
  });

  it('mostra utilização do cartão em percentagem', () => {
    render(<ContasPage />, { wrapper });
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 11.2: Correr teste — verificar que falha**

```bash
npx vitest run src/pages/__tests__/ContasPage.test.tsx
```

Esperado: FAIL — `Cannot find module '../ContasPage'`.

- [ ] **Step 11.3: Implementar src/pages/ContasPage.tsx**

```typescript
// src/pages/ContasPage.tsx
// Unit 5: página unificada de contas + cartões, scope-aware via useScope()
import React, { useState } from 'react';
import { useScope } from '../features/scope/useScope';
import { useAuth } from '../contexts/AuthContext';
import { useAccountsScoped, useCreditCards, useSoftDeleteAccount, useSoftDeleteCreditCard } from '../hooks/useAccountsQuery';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Wallet, Plus, CreditCard, Edit, Trash2, MoreVertical } from 'lucide-react';
import { formatMoney } from '../lib/money';
import CreditCardFormNew from '../components/CreditCardFormNew';
import AccountForm from '../components/AccountForm';
import { useToast } from '../hooks/use-toast';

const ContasPage: React.FC = () => {
  const scope = useScope();
  const { user } = useAuth();
  const { toast } = useToast();

  const userId = user?.id ?? '';
  const familyId = scope.type === 'family' ? (scope as { familyId?: string | null }).familyId ?? null : null;

  const { data: accountsResult, isLoading: accountsLoading } = useAccountsScoped({ userId, familyId });
  const { data: cardsResult, isLoading: cardsLoading } = useCreditCards({ userId, familyId });
  const softDeleteAccountMutation = useSoftDeleteAccount();
  const softDeleteCardMutation = useSoftDeleteCreditCard();

  const accounts = (accountsResult as { data?: unknown[] } | null)?.data ?? [];
  const cards = (cardsResult as { data?: unknown[] } | null)?.data ?? [];

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string; type: 'account' | 'card' } | null>(null);

  const isLoading = accountsLoading || cardsLoading;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user?.id) return;
    try {
      if (deleteTarget.type === 'account') {
        await softDeleteAccountMutation.mutateAsync({ accountId: deleteTarget.id, userId: user.id });
        toast({ title: 'Conta arquivada com sucesso' });
      } else {
        await softDeleteCardMutation.mutateAsync({ cardId: deleteTarget.id, userId: user.id });
        toast({ title: 'Cartão arquivado com sucesso' });
      }
    } catch {
      toast({ title: 'Erro ao arquivar', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-24 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* ── Contas Bancárias ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Contas Bancárias
          </h2>
          <Button size="sm" onClick={() => setShowAccountForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        </div>

        {accounts.length === 0 ? (
          <Alert>
            <AlertDescription>
              Ainda não tens contas bancárias. Clica em &ldquo;Nova conta&rdquo; para adicionar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(accounts as Array<Record<string, unknown>>).map((account) => (
              <Card key={account.account_id as string}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{account.nome as string}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteTarget({
                          id: account.account_id as string,
                          nome: account.nome as string,
                          type: 'account',
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit text-xs capitalize">
                    {account.tipo as string}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatMoney(Math.round((account.saldo_atual as number) * 100))}
                  </p>
                  {(account.saldo_disponivel as number) < (account.saldo_atual as number) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Disponível: {formatMoney(Math.round((account.saldo_disponivel as number) * 100))}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Cartões de Crédito ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Cartões de Crédito
          </h2>
          <Button size="sm" onClick={() => setShowCardForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo cartão
          </Button>
        </div>

        {cards.length === 0 ? (
          <Alert>
            <AlertDescription>
              Ainda não tens cartões de crédito. Clica em &ldquo;Novo cartão&rdquo; para adicionar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(cards as Array<Record<string, unknown>>).map((card) => {
              const limitCents = card.credit_limit_cents as number;
              const balanceCents = card.current_balance_cents as number;
              const utilizationPct = card.utilization_pct as number;
              const isHighUtilization = utilizationPct >= 80;

              return (
                <Card key={card.card_id as string}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{card.nome as string}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteTarget({
                          id: card.card_id as string,
                          nome: card.nome as string,
                          type: 'card',
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Utilizado</p>
                      <p className="text-2xl font-bold">{formatMoney(balanceCents)}</p>
                    </div>
                    {/* Barra de utilização */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isHighUtilization ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {utilizationPct.toFixed(0)}% utilizado
                        </span>
                        <span className="text-muted-foreground">
                          Limite: {formatMoney(limitCents)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isHighUtilization ? 'bg-destructive' : utilizationPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, utilizationPct)}%` }}
                        />
                      </div>
                    </div>
                    {(card.closing_day as number | null) && (
                      <p className="text-xs text-muted-foreground">
                        Fecho: dia {card.closing_day as number}
                        {(card.payment_day as number | null) ? ` · Pagamento: dia ${card.payment_day as number}` : ''}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Modais ── */}

      {/* Modal de nova conta bancária */}
      <Dialog open={showAccountForm} onOpenChange={setShowAccountForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta bancária</DialogTitle>
          </DialogHeader>
          <AccountForm
            initialData={{ id: '', nome: '', tipo: 'corrente', saldoAtual: 0 }}
            onSuccess={() => { setShowAccountForm(false); }}
            onCancel={() => setShowAccountForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de novo cartão de crédito */}
      <Dialog open={showCardForm} onOpenChange={setShowCardForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cartão de crédito</DialogTitle>
          </DialogHeader>
          <CreditCardFormNew
            familyId={familyId}
            onSuccess={() => { setShowCardForm(false); }}
            onCancel={() => setShowCardForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de arquivo */}
      {deleteTarget && (
        <ConfirmationDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title={`Arquivar ${deleteTarget.type === 'account' ? 'conta' : 'cartão'}?`}
          description={`"${deleteTarget.nome}" será arquivado(a). O histórico de transações é preservado. Podes restaurar mais tarde nas Definições.`}
          confirmLabel="Arquivar"
          onConfirm={handleDeleteConfirm}
          isLoading={softDeleteAccountMutation.isPending || softDeleteCardMutation.isPending}
        />
      )}
    </div>
  );
};

export default ContasPage;
```

- [ ] **Step 11.4: Adicionar hook useAccountsScoped + useSoftDeleteAccount ao useAccountsQuery.ts**

Ler o ficheiro e adicionar (se não existe ainda):

```typescript
// useAccountsQuery.ts — ADICIONAR
import { getAccountsScoped, softDeleteAccount } from '../services/accounts';

export const useAccountsScoped = (options: { userId?: string; familyId?: string | null }) => {
  return useQuery({
    queryKey: ['accounts_scoped', options.userId, options.familyId ?? null],
    queryFn: () => getAccountsScoped({ userId: options.userId!, familyId: options.familyId }),
    enabled: !!options.userId,
  });
};

export const useSoftDeleteAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, userId }: { accountId: string; userId?: string }) =>
      softDeleteAccount(accountId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts_scoped'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
};
```

- [ ] **Step 11.5: Correr teste — verificar que passa**

```bash
npx vitest run src/pages/__tests__/ContasPage.test.tsx
```

Esperado: PASS (3 testes).

- [ ] **Step 11.6: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 11.7: Correr todos os testes**

```bash
npm test
```

Esperado: todos os testes PASS.

- [ ] **Step 11.8: Commit**

```bash
git add src/pages/ContasPage.tsx \
        src/pages/__tests__/ContasPage.test.tsx \
        src/hooks/useAccountsQuery.ts
git commit -m "feat(ui): unit05 task11 — create ContasPage (unified accounts + credit cards, scope-aware)"
```

---

## Task 12: Ligar ContasPage à rota + atualizar PersonalAccounts / FamilyAccounts

**Ficheiros:**
- Modificar: ficheiro de rotas (verificar nome exato com `find src -name "*.tsx" | xargs grep -l "PersonalAccounts" -l "routes"`)
- Modificar: `src/features/personal/PersonalAccounts.tsx` — delegar para ContasPage
- Modificar: `src/features/family/FamilyAccounts.tsx` — delegar para ContasPage

- [ ] **Step 12.1: Localizar o ficheiro de rotas**

```bash
grep -r "PersonalAccounts\|/app/contas\|accounts" src/ --include="*.tsx" --include="*.ts" -l | grep -v test | grep -v __tests__
```

Identificar o ficheiro onde as rotas são definidas (provavelmente `src/App.tsx` ou `src/router.tsx`).

- [ ] **Step 12.2: Adicionar rota /app/contas**

Ler o ficheiro de rotas. Adicionar (ou substituir rota existente de accounts):

```typescript
// Em App.tsx ou router.tsx — ajustar conforme estrutura existente
import ContasPage from './pages/ContasPage';

// Dentro da definição de rotas:
{ path: '/app/contas', element: <ContasPage /> }
```

- [ ] **Step 12.3: Atualizar PersonalAccounts.tsx para redirecionar**

Ler `src/features/personal/PersonalAccounts.tsx`. Se a página é renderizada diretamente (sem routing), substituir o conteúdo por um redirect ou por `<ContasPage />`:

```typescript
// src/features/personal/PersonalAccounts.tsx
// Unit 5: delegado para ContasPage unificada
import React from 'react';
import ContasPage from '../../pages/ContasPage';

const PersonalAccounts: React.FC = () => <ContasPage />;
export default PersonalAccounts;
```

- [ ] **Step 12.4: Atualizar FamilyAccounts.tsx de forma análoga**

Ler `src/features/family/FamilyAccounts.tsx`. Substituir por:

```typescript
// src/features/family/FamilyAccounts.tsx
// Unit 5: delegado para ContasPage unificada (scope já é family via ScopeProvider)
import React from 'react';
import ContasPage from '../../pages/ContasPage';

const FamilyAccounts: React.FC = () => <ContasPage />;
export default FamilyAccounts;
```

**Nota:** Antes de substituir, verificar se `FamilyAccounts.tsx` tem features únicas (`InlineReserveEditor`, `AccountAuditList`) que não estão ainda em `ContasPage`. Se sim, preservar esses componentes como imports em `ContasPage` e adicionar a secção "Reserva" à página. Consultar o componente atual antes de substituir.

- [ ] **Step 12.5: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 12.6: Correr todos os testes**

```bash
npm test
```

- [ ] **Step 12.7: Commit**

```bash
git add src/features/personal/PersonalAccounts.tsx \
        src/features/family/FamilyAccounts.tsx
# adicionar ficheiro de rotas se modificado
git commit -m "feat(routing): unit05 task12 — delegate PersonalAccounts + FamilyAccounts to unified ContasPage"
```

---

## Verificação Final

Após todas as tasks:

```bash
# 1. Compilação TypeScript sem erros
npx tsc --noEmit

# 2. Todos os testes passam
npm test

# 3. Grep para referências obsoletas
grep -r "billing_cycle_day\|tipo.*cartão de crédito\|useAccounts\b" \
     src/ --include="*.ts" --include="*.tsx" -l

# 4. Confirmar que credit_cards table existe e tem RLS
# (correr no Supabase SQL Editor)

# 5. Confirmar CHECK constraint XOR em transactions
# SELECT conname FROM pg_constraint WHERE conname = 'chk_transactions_instrument_xor';

# 6. Confirmar que contas legacy de cartão foram soft-deleted
# SELECT COUNT(*) FROM accounts WHERE tipo = 'cartão de crédito' AND deleted_at IS NOT NULL;
# SELECT COUNT(*) FROM accounts WHERE tipo = 'cartão de crédito' AND deleted_at IS NULL;
# -- Esperado: 0 na segunda query
```

---

## Rollback de Emergência

Se a migração da Task 4 (XOR constraint) falhar em produção, reverter com:

```sql
-- Reverter: remover constraint + credit_card_id + restaurar transações
BEGIN;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS chk_transactions_instrument_xor;

-- Restaurar account_id nas linhas migradas (via credit_cards que têm o mesmo id que o account original)
UPDATE public.transactions t
SET account_id = t.credit_card_id,
    credit_card_id = NULL
WHERE t.credit_card_id IS NOT NULL;

ALTER TABLE public.transactions DROP COLUMN IF EXISTS credit_card_id;

-- Restaurar contas de cartão (remover soft-delete)
UPDATE public.accounts
SET deleted_at = NULL
WHERE tipo = 'cartão de crédito';
COMMIT;
```

**Nota:** este rollback apaga os dados inseridos em `credit_cards` via Task 2. Fazer antes de aplicar Task 4 se houver dúvidas.
