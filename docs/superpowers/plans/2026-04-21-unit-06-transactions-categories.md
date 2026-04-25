# Unit 6: Transactions & Categories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `transfers` table (with trigger that auto-creates 2 transaction rows), `transaction_splits` (splits por categoria), `transaction_attachments` (recibos em Storage), 1-nível de hierarquia em `categories`, e fazer `transactions.operation_id` obrigatório com `reversal_of` para reversões universais — tudo com validação de data ≤ hoje.

**Architecture:** O modelo hibridiza uma tabela `transfers` (fonte única da verdade para transferências) com 2 rows materializadas em `transactions` via trigger AFTER INSERT/UPDATE/DELETE, mantendo o extrato de conta completo sem duplicação de lógica de negócio. Splits e anexos são tabelas satélite ligadas a `transactions` com RLS própria. O frontend adiciona um formulário de transferência separado e um modo split no formulário de transação existente.

**Tech Stack:** Supabase PostgreSQL migrations (`npx supabase db push`), PLPGSQL triggers, RLS por `user_id`/`family_id`, Supabase Storage bucket `receipts`, React Query v5 mutations, TypeScript, Vitest, `npm run types:gen`.

---

## Deviações e notas contextuais

- `transfer_group_id` existe em `transactions` com 0 rows em produção — será dropado nesta unit e substituído por `transfers.id` como identificador do par.
- `transactions.goal_id` já foi dropado em Unit 2 (Phase 2b).
- `attachments.ts` e bucket `attachments` existem mas ligados genericamente; esta unit cria `transaction_attachments` como FK e reutiliza o bucket `receipts` (mencionado no spec como bucket para OCR). Confirmar nome do bucket no Supabase antes de Task 10.
- `operation_id` existe na tabela `transactions` mas pode ser nullable — Task 6 faz `NOT NULL` com `DEFAULT gen_random_uuid()`.
- Validação de data ≤ hoje: feita em dois lugares — CHECK constraint no DB (Task 6) + schema Zod no frontend (Task 7).
- RPC `reverse_transaction` cria transação contrária; não apaga — preserva histórico.

---

## Estrutura de Ficheiros

### Criar (migrações)
- `supabase/migrations/20260421100000_unit06_transfers_table.sql`
- `supabase/migrations/20260421110000_unit06_transfer_trigger.sql`
- `supabase/migrations/20260421120000_unit06_transaction_splits.sql`
- `supabase/migrations/20260421130000_unit06_transaction_attachments.sql`
- `supabase/migrations/20260421140000_unit06_categories_parent_id.sql`
- `supabase/migrations/20260421150000_unit06_transactions_operation_id_reversal.sql`

### Criar (serviços e testes)
- `src/services/transfers.ts`
- `src/services/splits.ts`
- `src/services/__tests__/transfers.test.ts`
- `src/services/__tests__/splits.test.ts`
- `src/services/__tests__/attachments.test.ts`
- `src/services/__tests__/categories.test.ts` (estender com getSystemCategories + getCategoriesTree)
- `src/services/__tests__/transactions.test.ts` (novo — validação de data futura + operation_id)
- `src/validation/__tests__/transactionSchema.test.ts` (estender com data futura)

### Criar (UI)
- `src/components/TransferForm.tsx`
- `src/components/TransactionSplitModal.tsx`
- `src/components/TransactionAttachments.tsx`

### Modificar
- `src/services/attachments.ts` — adicionar `listTransactionAttachments`, `uploadTransactionAttachment`, `deleteTransactionAttachment`
- `src/services/categories.ts` — adicionar `getSystemCategories`, `getCategoriesTree`, bloquear edição de `is_system = true`
- `src/services/transactions.ts` — adicionar `operation_id` auto-gerado, validação data ≤ hoje, `reverseTransaction`
- `src/validation/transactionSchema.ts` — adicionar `.refine` data ≤ hoje
- `src/components/TransactionForm.tsx` — adicionar modo transferência, botão split, botão anexar recibo
- `src/components/CategoryForm.tsx` — adicionar `parent_id` select, bloquear campos se `is_system = true`
- `src/integrations/supabase/types.ts` — regenerar após cada migração

---

## Task 1: Migração — tabela `transfers`

**Ficheiros:**
- Criar: `supabase/migrations/20260421100000_unit06_transfers_table.sql`

- [ ] **Step 1.1: Escrever a migração**

```sql
-- supabase/migrations/20260421100000_unit06_transfers_table.sql
-- Unit 6 Task 1: criar tabela transfers (fonte de verdade para transferências entre contas/cartões)

set local search_path = public;

CREATE TABLE public.transfers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id           uuid        REFERENCES public.families(id) ON DELETE SET NULL,
  -- Origem: conta bancária XOR cartão de crédito
  from_account_id     uuid        REFERENCES public.accounts(id) ON DELETE RESTRICT,
  from_credit_card_id uuid        REFERENCES public.credit_cards(id) ON DELETE RESTRICT,
  -- Destino: conta bancária XOR cartão de crédito
  to_account_id       uuid        REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_credit_card_id   uuid        REFERENCES public.credit_cards(id) ON DELETE RESTRICT,
  amount_cents        bigint      NOT NULL CHECK (amount_cents > 0),
  currency            text        NOT NULL DEFAULT 'EUR',
  date                date        NOT NULL CHECK (date <= current_date),
  description         text,
  operation_id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_time          timestamptz NOT NULL DEFAULT now(),
  reversal_of         uuid        REFERENCES public.transfers(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Garantir que origem tem exatamente uma fonte preenchida
  CONSTRAINT chk_transfers_from_xor CHECK (
    (from_account_id IS NOT NULL)::int + (from_credit_card_id IS NOT NULL)::int = 1
  ),
  -- Garantir que destino tem exatamente uma fonte preenchida
  CONSTRAINT chk_transfers_to_xor CHECK (
    (to_account_id IS NOT NULL)::int + (to_credit_card_id IS NOT NULL)::int = 1
  ),
  -- Não permitir transferência para a mesma conta/cartão
  CONSTRAINT chk_transfers_not_self CHECK (
    NOT (from_account_id IS NOT NULL AND from_account_id = to_account_id)
    AND NOT (from_credit_card_id IS NOT NULL AND from_credit_card_id = to_credit_card_id)
  )
);

-- Índices
CREATE INDEX idx_transfers_user_id      ON public.transfers(user_id);
CREATE INDEX idx_transfers_family_id    ON public.transfers(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_transfers_from_account ON public.transfers(from_account_id) WHERE from_account_id IS NOT NULL;
CREATE INDEX idx_transfers_to_account   ON public.transfers(to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX idx_transfers_date         ON public.transfers(date DESC);
CREATE INDEX idx_transfers_operation_id ON public.transfers(operation_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_transfers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_transfers_updated_at();

-- RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Leitura: próprio user ou membro da família
CREATE POLICY sel_transfers ON public.transfers
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      family_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = transfers.family_id
          AND fm.user_id = auth.uid()
          AND fm.status = 'active'
      )
    )
  );

-- Insert: apenas o próprio user
CREATE POLICY ins_transfers ON public.transfers
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Update: apenas o próprio user
CREATE POLICY upd_transfers ON public.transfers
  FOR UPDATE USING (user_id = auth.uid());

-- Delete: apenas o próprio user
CREATE POLICY del_transfers ON public.transfers
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
```

- [ ] **Step 1.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros. Se `credit_cards` não existir ainda (Unit 5 não completa), substituir temporariamente `REFERENCES public.credit_cards(id)` por comentário e adicionar depois.

- [ ] **Step 1.3: Verificar estrutura**

```bash
npx supabase db push --dry-run
```

Confirmar que tabela `transfers` aparece com todos os CHECK constraints.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260421100000_unit06_transfers_table.sql
git commit -m "feat(db): unit6 task1 — create transfers table with XOR checks and RLS"
```

---

## Task 2: Migração — trigger `create_transfer_transactions()`

**Ficheiros:**
- Criar: `supabase/migrations/20260421110000_unit06_transfer_trigger.sql`

O trigger materializa 2 rows em `transactions` quando uma `transfer` é inserida:
- Débito (`tipo = 'despesa'`) na conta/cartão de origem
- Crédito (`tipo = 'receita'`) na conta/cartão de destino

Em UPDATE e DELETE, apaga/recria as rows correspondentes via `operation_id`.

- [ ] **Step 2.1: Escrever a migração**

```sql
-- supabase/migrations/20260421110000_unit06_transfer_trigger.sql
-- Unit 6 Task 2: trigger que materializa 2 rows em transactions para cada transfer

set local search_path = public;

-- ---------------------------------------------------------------
-- Função principal do trigger
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_transfer_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_debit_account_id  uuid;
  v_credit_account_id uuid;
  v_description       text;
BEGIN
  -- Determinar account_id para débito (origem)
  -- Para cartões de crédito, usamos NULL em account_id e preenchemos credit_card_id
  -- (assumindo que transactions tem account_id nullable para suporte a cartões)
  IF TG_OP = 'DELETE' THEN
    -- Apagar as 2 rows materializadas ligadas a este transfer
    DELETE FROM public.transactions
    WHERE transfer_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Para UPDATE: apagar as rows antigas e recriar
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.transactions
    WHERE transfer_id = NEW.id;
  END IF;

  -- INSERT ou UPDATE (recria)
  v_description := COALESCE(
    NEW.description,
    'Transferência ' || to_char(NEW.date, 'DD/MM/YYYY')
  );

  -- Row 1: Débito na conta/cartão de origem
  INSERT INTO public.transactions (
    user_id,
    family_id,
    account_id,
    credit_card_id,
    amount_cents,
    currency,
    tipo,
    data,
    descricao,
    operation_id,
    transfer_id,
    event_time,
    created_by
  ) VALUES (
    NEW.user_id,
    NEW.family_id,
    NEW.from_account_id,
    NEW.from_credit_card_id,
    NEW.amount_cents,
    NEW.currency,
    'despesa',
    NEW.date,
    v_description,
    NEW.operation_id,
    NEW.id,
    NEW.event_time,
    NEW.user_id
  );

  -- Row 2: Crédito na conta/cartão de destino
  INSERT INTO public.transactions (
    user_id,
    family_id,
    account_id,
    credit_card_id,
    amount_cents,
    currency,
    tipo,
    data,
    descricao,
    operation_id,
    transfer_id,
    event_time,
    created_by
  ) VALUES (
    NEW.user_id,
    NEW.family_id,
    NEW.to_account_id,
    NEW.to_credit_card_id,
    NEW.amount_cents,
    NEW.currency,
    'receita',
    NEW.date,
    v_description,
    NEW.operation_id,
    NEW.id,
    NEW.event_time,
    NEW.user_id
  );

  RETURN NEW;
END;$$;

-- ---------------------------------------------------------------
-- Trigger: dispara AFTER INSERT OR UPDATE OR DELETE em transfers
-- ---------------------------------------------------------------
CREATE TRIGGER trigger_transfer_materialize
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.create_transfer_transactions();

-- ---------------------------------------------------------------
-- Adicionar coluna transfer_id a transactions (se não existir)
-- Permite ligar as rows materializadas à sua transfer origem
-- ---------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES public.transfers(id) ON DELETE CASCADE;

-- Adicionar coluna credit_card_id a transactions (se não existir — Unit 5 pode já tê-la)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE SET NULL;

-- Adicionar coluna created_by a transactions (se não existir)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Remover coluna transfer_group_id (substituída por transfer_id — 0 rows em produção)
ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS transfer_group_id;

-- Índice para lookup por transfer_id
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id
  ON public.transactions(transfer_id)
  WHERE transfer_id IS NOT NULL;
```

- [ ] **Step 2.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 2.3: Testar trigger manualmente (Supabase SQL Editor)**

```sql
-- Confirmar que inserir uma transfer cria 2 rows em transactions
WITH inserted AS (
  INSERT INTO public.transfers (user_id, from_account_id, to_account_id, amount_cents, date)
  SELECT
    auth.uid(),
    (SELECT id FROM accounts WHERE user_id = auth.uid() LIMIT 1),
    (SELECT id FROM accounts WHERE user_id = auth.uid() OFFSET 1 LIMIT 1),
    5000,
    current_date
  RETURNING id, operation_id
)
SELECT t.tipo, t.amount_cents, t.transfer_id
FROM public.transactions t
JOIN inserted i ON t.transfer_id = i.id;
-- Esperado: 2 rows — uma 'despesa' e uma 'receita', ambas com amount_cents = 5000
```

Limpar o teste:
```sql
DELETE FROM public.transfers WHERE date = current_date AND amount_cents = 5000 AND user_id = auth.uid();
-- (o CASCADE apaga as 2 transactions)
```

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/20260421110000_unit06_transfer_trigger.sql
git commit -m "feat(db): unit6 task2 — trigger create_transfer_transactions materializes 2 tx rows"
```

---

## Task 3: Migração — tabela `transaction_splits`

**Ficheiros:**
- Criar: `supabase/migrations/20260421120000_unit06_transaction_splits.sql`

- [ ] **Step 3.1: Escrever a migração**

```sql
-- supabase/migrations/20260421120000_unit06_transaction_splits.sql
-- Unit 6 Task 3: transaction_splits — repartição de uma transação por múltiplas categorias

set local search_path = public;

CREATE TABLE public.transaction_splits (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid    NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  categoria_id   uuid    NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount_cents   bigint  NOT NULL CHECK (amount_cents > 0),
  description    text,
  order_index    smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tx_splits_transaction ON public.transaction_splits(transaction_id);
CREATE INDEX idx_tx_splits_categoria   ON public.transaction_splits(categoria_id);

-- Trigger: validar que SUM(splits.amount_cents) = transactions.amount_cents
-- Deferrable para permitir insert atómico de múltiplos splits
CREATE OR REPLACE FUNCTION public.validate_transaction_splits_sum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_amount  bigint;
  v_split_sum  bigint;
BEGIN
  SELECT amount_cents INTO v_tx_amount
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_split_sum
  FROM public.transaction_splits
  WHERE transaction_id = NEW.transaction_id;

  IF v_split_sum > v_tx_amount THEN
    RAISE EXCEPTION
      'Soma dos splits (%) excede o valor da transação (%)',
      v_split_sum, v_tx_amount;
  END IF;

  RETURN NEW;
END;$$;

CREATE CONSTRAINT TRIGGER trg_validate_splits_sum
  AFTER INSERT OR UPDATE ON public.transaction_splits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_splits_sum();

-- RLS
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- Leitura: ver splits se puder ver a transação
CREATE POLICY sel_tx_splits ON public.transaction_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND (
          t.user_id = auth.uid()
          OR (
            t.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = t.family_id
                AND fm.user_id = auth.uid()
                AND fm.status = 'active'
            )
          )
        )
    )
  );

-- Insert/Update/Delete: apenas owner da transação
CREATE POLICY ins_tx_splits ON public.transaction_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY upd_tx_splits ON public.transaction_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY del_tx_splits ON public.transaction_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_splits TO authenticated;
```

- [ ] **Step 3.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 3.3: Commit**

```bash
git add supabase/migrations/20260421120000_unit06_transaction_splits.sql
git commit -m "feat(db): unit6 task3 — create transaction_splits with deferred sum-check trigger"
```

---

## Task 4: Migração — tabela `transaction_attachments`

**Ficheiros:**
- Criar: `supabase/migrations/20260421130000_unit06_transaction_attachments.sql`

- [ ] **Step 4.1: Escrever a migração**

```sql
-- supabase/migrations/20260421130000_unit06_transaction_attachments.sql
-- Unit 6 Task 4: transaction_attachments — recibos/faturas ligadas a transações

set local search_path = public;

CREATE TABLE public.transaction_attachments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  storage_path      text        NOT NULL,          -- path no bucket receipts
  original_filename text,
  mime_type         text,
  size_bytes        bigint      CHECK (size_bytes > 0),
  uploaded_by       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tx_attachments_transaction ON public.transaction_attachments(transaction_id);
CREATE INDEX idx_tx_attachments_uploader    ON public.transaction_attachments(uploaded_by);

-- RLS
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

-- Leitura: ver anexo se puder ver a transação
CREATE POLICY sel_tx_attachments ON public.transaction_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_attachments.transaction_id
        AND (
          t.user_id = auth.uid()
          OR (
            t.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = t.family_id
                AND fm.user_id = auth.uid()
                AND fm.status = 'active'
            )
          )
        )
    )
  );

-- Insert: uploader deve ser o próprio auth.uid()
CREATE POLICY ins_tx_attachments ON public.transaction_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Delete: apenas quem fez upload
CREATE POLICY del_tx_attachments ON public.transaction_attachments
  FOR DELETE USING (uploaded_by = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.transaction_attachments TO authenticated;
```

- [ ] **Step 4.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 4.3: Commit**

```bash
git add supabase/migrations/20260421130000_unit06_transaction_attachments.sql
git commit -m "feat(db): unit6 task4 — create transaction_attachments with RLS"
```

---

## Task 5: Migração — `categories.parent_id` (hierarquia 1-nível)

**Ficheiros:**
- Criar: `supabase/migrations/20260421140000_unit06_categories_parent_id.sql`

- [ ] **Step 5.1: Escrever a migração**

```sql
-- supabase/migrations/20260421140000_unit06_categories_parent_id.sql
-- Unit 6 Task 5: adicionar parent_id a categories + check de profundidade máxima 1

set local search_path = public;

-- Adicionar parent_id como FK auto-referencial
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

-- Garantir que is_system existe (Unit 2 Phase 4 devia tê-lo adicionado; defensivo)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Índice para hierarquia
CREATE INDEX IF NOT EXISTS idx_categories_parent_id
  ON public.categories(parent_id)
  WHERE parent_id IS NOT NULL;

-- Índice parcial para categorias de sistema
CREATE INDEX IF NOT EXISTS idx_categories_is_system
  ON public.categories(is_system)
  WHERE is_system = true;

-- Trigger: impedir profundidade > 1 (pai não pode ter pai)
CREATE OR REPLACE FUNCTION public.check_category_depth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grandparent_id uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se o pai tem pai (profundidade > 1 não permitida)
  SELECT parent_id INTO v_grandparent_id
  FROM public.categories
  WHERE id = NEW.parent_id;

  IF v_grandparent_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Hierarquia de categorias limitada a 1 nível. A categoria pai (%) já tem um pai.',
      NEW.parent_id;
  END IF;

  -- Evitar auto-referência
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Uma categoria não pode ser pai de si própria.';
  END IF;

  RETURN NEW;
END;$$;

CREATE TRIGGER trg_check_category_depth
  BEFORE INSERT OR UPDATE OF parent_id ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.check_category_depth();

-- Trigger: impedir que uma categoria pai seja apagada enquanto tiver filhos
-- (ON DELETE RESTRICT já faz isto via FK, mas mensagem de erro mais clara)
-- Não é necessário trigger adicional — o RESTRICT já basta.

-- Marcar categorias de sistema existentes (padrão anterior: user_id IS NULL AND family_id IS NULL)
UPDATE public.categories
SET is_system = true
WHERE user_id IS NULL
  AND (family_id IS NULL OR family_id IS NULL)
  AND is_system = false;
```

- [ ] **Step 5.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 5.3: Commit**

```bash
git add supabase/migrations/20260421140000_unit06_categories_parent_id.sql
git commit -m "feat(db): unit6 task5 — add categories.parent_id + depth-1 trigger"
```

---

## Task 6: Migração — `transactions.operation_id NOT NULL` + `reversal_of` + CHECK data ≤ hoje

**Ficheiros:**
- Criar: `supabase/migrations/20260421150000_unit06_transactions_operation_id_reversal.sql`

- [ ] **Step 6.1: Escrever a migração**

```sql
-- supabase/migrations/20260421150000_unit06_transactions_operation_id_reversal.sql
-- Unit 6 Task 6: operation_id NOT NULL com DEFAULT, reversal_of FK, CHECK data <= current_date

set local search_path = public;

BEGIN;

-- 1. Popular operation_id onde NULL (registos históricos)
UPDATE public.transactions
SET operation_id = gen_random_uuid()
WHERE operation_id IS NULL;

-- 2. Tornar operation_id NOT NULL com DEFAULT
ALTER TABLE public.transactions
  ALTER COLUMN operation_id SET NOT NULL,
  ALTER COLUMN operation_id SET DEFAULT gen_random_uuid();

-- 3. Adicionar reversal_of (FK auto-referencial)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 4. CHECK: sem datas futuras
-- Nota: usamos uma função para que o check passe em contextos SECURITY DEFINER
-- (como o trigger do transfer que pode inserir com date = NEW.date validado no transfers table)
-- Para transações inseridas diretamente via UI, o check aplica-se.
-- Rows geradas pelo trigger de transfers já têm date validado em transfers.date.
-- Aplicamos o constraint apenas em transações SEM transfer_id.
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transactions_no_future_date
  CHECK (
    transfer_id IS NOT NULL  -- rows de transfers já validadas pela tabela transfers
    OR data <= current_date
  );

-- 5. Adicionar event_time se não existir
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS event_time timestamptz NOT NULL DEFAULT now();

-- 6. Índice em operation_id (idempotência em retries)
CREATE INDEX IF NOT EXISTS idx_transactions_operation_id
  ON public.transactions(operation_id);

-- 7. Índice em reversal_of
CREATE INDEX IF NOT EXISTS idx_transactions_reversal_of
  ON public.transactions(reversal_of)
  WHERE reversal_of IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------
-- RPC: reverse_transaction(tx_id uuid)
-- Cria transação contrária e liga via reversal_of
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_transaction(p_tx_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx          record;
  v_new_id      uuid;
  v_new_op_id   uuid := gen_random_uuid();
  v_new_tipo    text;
BEGIN
  -- Carregar transação original
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação % não encontrada.', p_tx_id;
  END IF;

  -- Verificar que o caller é o owner ou membro da família
  IF v_tx.user_id != auth.uid() THEN
    IF v_tx.family_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = v_tx.family_id
        AND fm.user_id = auth.uid()
        AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Sem permissão para reverter esta transação.';
    END IF;
  END IF;

  -- Verificar que não foi já revertida
  IF EXISTS (
    SELECT 1 FROM public.transactions WHERE reversal_of = p_tx_id
  ) THEN
    RAISE EXCEPTION 'Esta transação já foi revertida.';
  END IF;

  -- Verificar que não é ela própria uma reversão (evitar reversão de reversão)
  IF v_tx.reversal_of IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível reverter uma transação que já é uma reversão.';
  END IF;

  -- Determinar tipo contrário
  v_new_tipo := CASE v_tx.tipo
    WHEN 'receita'  THEN 'despesa'
    WHEN 'despesa'  THEN 'receita'
    ELSE v_tx.tipo -- transferencia: não deveria chegar aqui
  END;

  -- Inserir transação inversa
  INSERT INTO public.transactions (
    user_id, family_id, account_id, credit_card_id,
    amount_cents, currency, tipo, data, descricao,
    categoria_id, operation_id, reversal_of, event_time, created_by
  ) VALUES (
    v_tx.user_id, v_tx.family_id, v_tx.account_id, v_tx.credit_card_id,
    v_tx.amount_cents, v_tx.currency, v_new_tipo, current_date,
    '[Reversão] ' || COALESCE(v_tx.descricao, ''),
    v_tx.categoria_id, v_new_op_id, p_tx_id, now(), auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'reversal_id', v_new_id,
    'original_id', p_tx_id,
    'operation_id', v_new_op_id
  );
END;$$;

REVOKE EXECUTE ON FUNCTION public.reverse_transaction FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_transaction TO authenticated;
```

- [ ] **Step 6.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 6.3: Verificar**

```sql
-- Confirmar que operation_id é NOT NULL em todas as rows
SELECT COUNT(*) FROM public.transactions WHERE operation_id IS NULL;
-- Esperado: 0

-- Confirmar que o CHECK rejeita datas futuras
INSERT INTO public.transactions (user_id, account_id, amount_cents, tipo, data, operation_id)
VALUES (auth.uid(), '<valid_account_id>', 100, 'despesa', current_date + 1, gen_random_uuid());
-- Esperado: ERROR — chk_transactions_no_future_date
```

- [ ] **Step 6.4: Commit**

```bash
git add supabase/migrations/20260421150000_unit06_transactions_operation_id_reversal.sql
git commit -m "feat(db): unit6 task6 — operation_id NOT NULL, reversal_of FK, no-future-date check, reverse_transaction RPC"
```

---

## Task 7: Regenerar tipos + atualizar `transactions.ts` e schema Zod

**Ficheiros:**
- Modificar: `src/integrations/supabase/types.ts` (regenerar)
- Modificar: `src/services/transactions.ts`
- Modificar: `src/validation/transactionSchema.ts`
- Criar: `src/services/__tests__/transactions.test.ts`
- Modificar: `src/validation/__tests__/transactionSchema.test.ts` (estender)

- [ ] **Step 7.1: Escrever o teste de validação de data futura**

Ler `src/validation/__tests__/transactionSchema.test.ts` se existir, senão criar:

```typescript
// src/validation/__tests__/transactionSchema.test.ts
import { describe, it, expect } from 'vitest';
import { transactionSchema } from '../transactionSchema';

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const validBase = {
  account_id: 'acc-uuid-1234',
  amount_cents: 1000,
  categoria_id: 'cat-uuid-1234',
  data: today,
  tipo: 'despesa' as const,
};

describe('transactionSchema', () => {
  it('aceita transação com data de hoje', () => {
    expect(transactionSchema.safeParse(validBase).success).toBe(true);
  });

  it('aceita transação com data passada', () => {
    expect(transactionSchema.safeParse({ ...validBase, data: yesterday }).success).toBe(true);
  });

  it('rejeita transação com data futura', () => {
    const result = transactionSchema.safeParse({ ...validBase, data: tomorrow });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message);
      expect(msgs.some(m => m.includes('futura') || m.includes('future') || m.includes('hoje'))).toBe(true);
    }
  });

  it('rejeita amount_cents zero', () => {
    expect(transactionSchema.safeParse({ ...validBase, amount_cents: 0 }).success).toBe(false);
  });

  it('rejeita amount_cents negativo', () => {
    expect(transactionSchema.safeParse({ ...validBase, amount_cents: -1 }).success).toBe(false);
  });

  it('aceita descricao opcional ausente', () => {
    expect(transactionSchema.safeParse(validBase).success).toBe(true);
  });
});
```

- [ ] **Step 7.2: Correr teste — confirmar FAIL**

```bash
npx vitest run src/validation/__tests__/transactionSchema.test.ts
```

Esperado: FAIL nos testes de data futura e amount_cents (schema atual usa `valor` não `amount_cents`).

- [ ] **Step 7.3: Regenerar tipos TypeScript**

```bash
npm run types:gen
```

- [ ] **Step 7.4: Atualizar `transactionSchema.ts`**

Substituir o conteúdo de `src/validation/transactionSchema.ts`:

```typescript
// src/validation/transactionSchema.ts
import { z } from 'zod';

const today = () => new Date().toISOString().slice(0, 10);

export const transactionSchema = z.object({
  account_id:   z.string().trim().min(1, 'Conta obrigatória'),
  // amount_cents: valor em cêntimos (inteiro positivo)
  amount_cents: z.number({ invalid_type_error: 'Valor inválido' })
                 .int('Valor deve ser número inteiro de cêntimos')
                 .min(1, 'Valor obrigatório'),
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória').nullable().optional(),
  data: z.string()
         .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)')
         .refine(
           (d) => d <= today(),
           'Não é possível registar transações com data futura'
         ),
  descricao:    z.string().trim().max(255, 'Descrição demasiado longa').optional().nullable(),
  tipo:         z.enum(['receita', 'despesa']),
  // Campos opcionais (operações de cartão e splits)
  credit_card_id: z.string().uuid().optional().nullable(),
  operation_id:   z.string().uuid().optional().nullable(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
```

- [ ] **Step 7.5: Escrever teste do serviço `transactions.ts`**

Criar `src/services/__tests__/transactions.test.ts`:

```typescript
// src/services/__tests__/transactions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
  }
}));

import { createTransaction, reverseTransaction } from '../transactions';

describe('transactions service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createTransaction inclui operation_id gerado lado cliente', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.single as any).mockResolvedValue({ data: null, error: null });
    (supabase.insert as any).mockReturnThis();
    (supabase.select as any).mockReturnThis();
    (supabase.single as any).mockResolvedValue({
      data: { id: 'tx-1', operation_id: 'op-uuid', amount_cents: 1000 },
      error: null,
    });

    const result = await createTransaction(
      { account_id: 'acc-1', amount_cents: 1000, tipo: 'despesa', data: '2026-04-21' },
      'user-1'
    );

    // Verificar que o payload inserido contém operation_id
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ operation_id: expect.any(String) })
      ])
    );
    expect(result.data).not.toBeNull();
  });

  it('reverseTransaction chama RPC reverse_transaction', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.rpc as any).mockResolvedValue({
      data: { reversal_id: 'tx-2', original_id: 'tx-1', operation_id: 'op-2' },
      error: null,
    });

    const result = await reverseTransaction('tx-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reverse_transaction', { p_tx_id: 'tx-1' });
    expect(result.data?.reversal_id).toBe('tx-2');
  });
});
```

- [ ] **Step 7.6: Correr testes — confirmar FAIL**

```bash
npx vitest run src/services/__tests__/transactions.test.ts
```

Esperado: FAIL — `reverseTransaction is not a function`, e `operation_id` não está no payload.

- [ ] **Step 7.7: Atualizar `src/services/transactions.ts`**

Ler o ficheiro completo antes de editar. Fazer as seguintes alterações:

1. Importar `crypto.randomUUID` ou usar `crypto.randomUUID()` para gerar `operation_id` lado cliente.
2. Em `createTransaction`, sempre incluir `operation_id: crypto.randomUUID()` no payload do insert, e remover referências a `valor` (substituído por `amount_cents`).
3. Adicionar função `reverseTransaction`:

```typescript
// Adicionar a src/services/transactions.ts
import { v4 as uuidv4 } from 'uuid'; // ou usar crypto.randomUUID()

export const reverseTransaction = async (
  txId: string
): Promise<{ data: { reversal_id: string; original_id: string; operation_id: string } | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('reverse_transaction', { p_tx_id: txId });
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};
```

E em `createTransaction`, adicionar `operation_id` ao payload:

```typescript
// Em createTransaction, no insert direto:
const payload = {
  account_id: transactionData.account_id,
  user_id: userId,
  categoria_id: transactionData.categoria_id || null,
  amount_cents: transactionData.amount_cents,
  tipo: transactionData.tipo,
  data: transactionData.data,
  descricao: transactionData.descricao || null,
  operation_id: transactionData.operation_id ?? (typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : uuidv4()),
};
```

- [ ] **Step 7.8: Correr todos os testes — confirmar PASS**

```bash
npx vitest run src/validation/__tests__/transactionSchema.test.ts src/services/__tests__/transactions.test.ts
```

Esperado: todos PASS.

- [ ] **Step 7.9: Verificar compilação**

```bash
npx tsc --noEmit
```

Corrigir erros de tipo relacionados com `valor` → `amount_cents` em componentes que chamem `createTransaction`.

- [ ] **Step 7.10: Correr suite completa**

```bash
npm test
```

- [ ] **Step 7.11: Commit**

```bash
git add src/integrations/supabase/types.ts \
        src/services/transactions.ts \
        src/validation/transactionSchema.ts \
        src/services/__tests__/transactions.test.ts \
        src/validation/__tests__/transactionSchema.test.ts
git commit -m "feat: unit6 task7 — amount_cents schema, operation_id auto-gen, reverseTransaction"
```

---

## Task 8: Serviço `transfers.ts` + testes

**Ficheiros:**
- Criar: `src/services/transfers.ts`
- Criar: `src/services/__tests__/transfers.test.ts`

- [ ] **Step 8.1: Escrever o teste**

```typescript
// src/services/__tests__/transfers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    limit: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
      ...mockChain,
    }
  };
});

import { createTransfer, listTransfers } from '../transfers';

describe('transfers service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createTransfer insere na tabela transfers com operation_id', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from('transfers').single as any).mockResolvedValue({
      data: { id: 'tr-1', amount_cents: 5000, operation_id: 'op-1' },
      error: null,
    });

    const result = await createTransfer({
      user_id: 'user-1',
      from_account_id: 'acc-1',
      to_account_id: 'acc-2',
      amount_cents: 5000,
      date: '2026-04-21',
    });

    expect(supabase.from).toHaveBeenCalledWith('transfers');
    expect(supabase.from('transfers').insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          amount_cents: 5000,
          operation_id: expect.any(String),
        })
      ])
    );
    expect(result.data?.id).toBe('tr-1');
  });

  it('listTransfers ordena por date DESC', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from('transfers').order as any).mockResolvedValue({
      data: [],
      error: null,
    });

    await listTransfers('user-1');

    expect(supabase.from('transfers').order).toHaveBeenCalledWith('date', { ascending: false });
  });
});
```

- [ ] **Step 8.2: Correr teste — confirmar FAIL**

```bash
npx vitest run src/services/__tests__/transfers.test.ts
```

Esperado: FAIL — `Cannot find module '../transfers'`.

- [ ] **Step 8.3: Implementar `src/services/transfers.ts`**

```typescript
// src/services/transfers.ts
import { supabase } from '@/lib/supabaseClient';

export interface TransferInsert {
  user_id: string;
  family_id?: string | null;
  from_account_id?: string | null;
  from_credit_card_id?: string | null;
  to_account_id?: string | null;
  to_credit_card_id?: string | null;
  amount_cents: number;
  currency?: string;
  date: string;       // YYYY-MM-DD
  description?: string | null;
  operation_id?: string;
}

export interface Transfer extends TransferInsert {
  id: string;
  reversal_of?: string | null;
  created_at: string;
  updated_at: string;
}

export const createTransfer = async (
  payload: TransferInsert
): Promise<{ data: Transfer | null; error: unknown }> => {
  try {
    const op_id = payload.operation_id
      ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : '');

    const { data, error } = await supabase
      .from('transfers')
      .insert([{ ...payload, operation_id: op_id }])
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const listTransfers = async (
  userId: string,
  familyId?: string | null
): Promise<{ data: Transfer[] | null; error: unknown }> => {
  try {
    let query = supabase
      .from('transfers')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (familyId) {
      query = supabase
        .from('transfers')
        .select('*')
        .eq('family_id', familyId)
        .order('date', { ascending: false });
    }

    const { data, error } = await query;
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getTransfer = async (
  id: string
): Promise<{ data: Transfer | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transfers')
      .select('*')
      .eq('id', id)
      .single();
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteTransfer = async (
  id: string
): Promise<{ error: unknown }> => {
  try {
    // O trigger trg_transfer_materialize com DELETE apaga as 2 transactions
    const { error } = await supabase
      .from('transfers')
      .delete()
      .eq('id', id);
    return { error };
  } catch (error) {
    return { error };
  }
};
```

- [ ] **Step 8.4: Correr testes — confirmar PASS**

```bash
npx vitest run src/services/__tests__/transfers.test.ts
```

Esperado: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/services/transfers.ts src/services/__tests__/transfers.test.ts
git commit -m "feat: unit6 task8 — transfers service (createTransfer, listTransfers, deleteTransfer)"
```

---

## Task 9: Serviço `splits.ts` + testes

**Ficheiros:**
- Criar: `src/services/splits.ts`
- Criar: `src/services/__tests__/splits.test.ts`

A operação central é `updateTransactionSplits` que substitui atomicamente todos os splits de uma transação.

- [ ] **Step 9.1: Escrever o teste**

```typescript
// src/services/__tests__/splits.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
      rpc: vi.fn(),
      ...mockChain,
    }
  };
});

import { updateTransactionSplits, getTransactionSplits } from '../splits';

describe('splits service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updateTransactionSplits deleta splits antigos e insere novos', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from('transaction_splits').eq as any).mockResolvedValue({ error: null });
    (supabase.from('transaction_splits').insert as any).mockResolvedValue({
      data: [
        { id: 's-1', transaction_id: 'tx-1', categoria_id: 'cat-1', amount_cents: 700 },
        { id: 's-2', transaction_id: 'tx-1', categoria_id: 'cat-2', amount_cents: 300 },
      ],
      error: null,
    });

    const result = await updateTransactionSplits('tx-1', [
      { categoria_id: 'cat-1', amount_cents: 700 },
      { categoria_id: 'cat-2', amount_cents: 300 },
    ]);

    expect(supabase.from).toHaveBeenCalledWith('transaction_splits');
    expect(supabase.from('transaction_splits').delete).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it('getTransactionSplits ordena por order_index', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from('transaction_splits').order as any).mockResolvedValue({ data: [], error: null });

    await getTransactionSplits('tx-1');

    expect(supabase.from('transaction_splits').order).toHaveBeenCalledWith(
      'order_index', { ascending: true }
    );
  });
});
```

- [ ] **Step 9.2: Correr teste — confirmar FAIL**

```bash
npx vitest run src/services/__tests__/splits.test.ts
```

Esperado: FAIL — `Cannot find module '../splits'`.

- [ ] **Step 9.3: Implementar `src/services/splits.ts`**

```typescript
// src/services/splits.ts
import { supabase } from '@/lib/supabaseClient';

export interface SplitInput {
  categoria_id: string;
  amount_cents: number;
  description?: string | null;
  order_index?: number;
}

export interface TransactionSplit extends SplitInput {
  id: string;
  transaction_id: string;
  created_at: string;
}

/**
 * Substitui atomicamente todos os splits de uma transação.
 * Apaga os splits existentes e insere os novos numa única operação.
 * O trigger deferrable valida que SUM(splits) <= transactions.amount_cents.
 */
export const updateTransactionSplits = async (
  transactionId: string,
  splits: SplitInput[]
): Promise<{ data: TransactionSplit[] | null; error: unknown }> => {
  try {
    // 1. Apagar splits existentes
    const { error: deleteError } = await supabase
      .from('transaction_splits')
      .delete()
      .eq('transaction_id', transactionId);

    if (deleteError) return { data: null, error: deleteError };

    // 2. Se sem splits, terminar (transação volta a ter categoria única)
    if (!splits.length) return { data: [], error: null };

    // 3. Inserir novos splits com order_index sequencial
    const rows = splits.map((s, i) => ({
      transaction_id: transactionId,
      categoria_id: s.categoria_id,
      amount_cents: s.amount_cents,
      description: s.description ?? null,
      order_index: s.order_index ?? i,
    }));

    const { data, error } = await supabase
      .from('transaction_splits')
      .insert(rows)
      .select();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getTransactionSplits = async (
  transactionId: string
): Promise<{ data: TransactionSplit[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transaction_splits')
      .select('*, categories(nome, cor)')
      .eq('transaction_id', transactionId)
      .order('order_index', { ascending: true });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};
```

- [ ] **Step 9.4: Correr testes — confirmar PASS**

```bash
npx vitest run src/services/__tests__/splits.test.ts
```

Esperado: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/services/splits.ts src/services/__tests__/splits.test.ts
git commit -m "feat: unit6 task9 — splits service (updateTransactionSplits, getTransactionSplits)"
```

---

## Task 10: Serviço de anexos `attachments.ts` (transaction-aware) + testes

**Ficheiros:**
- Modificar: `src/services/attachments.ts`
- Criar: `src/services/__tests__/attachments.test.ts`

O bucket usado é `receipts` (confirmado no spec como bucket para OCR na Unit 14). Se o bucket existir como `attachments`, manter constante configurável.

- [ ] **Step 10.1: Escrever o teste**

```typescript
// src/services/__tests__/attachments.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  const mockStorage = {
    upload: vi.fn(),
    remove: vi.fn(),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://bucket/receipts/path.pdf' } })),
  };
  const mockFrom = vi.fn(() => mockStorage);
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return {
    supabase: {
      storage: { from: mockFrom },
      from: vi.fn(() => mockChain),
      ...mockChain,
    }
  };
});

import {
  uploadTransactionAttachment,
  listTransactionAttachments,
  deleteTransactionAttachment,
} from '../attachments';

describe('attachments service — transaction-aware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploadTransactionAttachment faz upload e regista row em transaction_attachments', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.storage.from as any)().upload.mockResolvedValue({ error: null });
    (supabase.from('transaction_attachments').single as any).mockResolvedValue({
      data: { id: 'att-1', transaction_id: 'tx-1', storage_path: 'tx-1/receipt.pdf' },
      error: null,
    });

    const file = new File(['test'], 'receipt.pdf', { type: 'application/pdf' });
    const result = await uploadTransactionAttachment('tx-1', 'user-1', file);

    expect(supabase.storage.from).toHaveBeenCalledWith('receipts');
    expect(supabase.from).toHaveBeenCalledWith('transaction_attachments');
    expect(result.data?.transaction_id).toBe('tx-1');
  });

  it('listTransactionAttachments ordena por uploaded_at DESC', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from('transaction_attachments').order as any).mockResolvedValue({ data: [], error: null });

    await listTransactionAttachments('tx-1');

    expect(supabase.from('transaction_attachments').order).toHaveBeenCalledWith(
      'uploaded_at', { ascending: false }
    );
  });

  it('deleteTransactionAttachment remove do Storage e da tabela', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from('transaction_attachments').single as any).mockResolvedValue({
      data: { storage_path: 'tx-1/receipt.pdf' }, error: null,
    });
    (supabase.from('transaction_attachments').eq as any).mockResolvedValue({ error: null });
    (supabase.storage.from as any)().remove.mockResolvedValue({ error: null });

    const result = await deleteTransactionAttachment('att-1');
    expect(result.error).toBeNull();
  });
});
```

- [ ] **Step 10.2: Correr teste — confirmar FAIL**

```bash
npx vitest run src/services/__tests__/attachments.test.ts
```

Esperado: FAIL — funções não existem ainda.

- [ ] **Step 10.3: Atualizar `src/services/attachments.ts`**

Ler o ficheiro atual e adicionar as três novas funções (preservar as existentes):

```typescript
// Adicionar a src/services/attachments.ts — preservar funções existentes

const RECEIPTS_BUCKET = 'receipts';

export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

export const uploadTransactionAttachment = async (
  transactionId: string,
  userId: string,
  file: File
): Promise<{ data: TransactionAttachment | null; error: unknown }> => {
  try {
    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${transactionId}/${Date.now()}.${ext}`;

    // 1. Upload para Storage
    const { error: storageError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(storagePath, file, { upsert: false });

    if (storageError) return { data: null, error: storageError };

    // 2. Registar metadados na tabela
    const { data, error } = await supabase
      .from('transaction_attachments')
      .insert([{
        transaction_id: transactionId,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      }])
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const listTransactionAttachments = async (
  transactionId: string
): Promise<{ data: TransactionAttachment[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transaction_attachments')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('uploaded_at', { ascending: false });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteTransactionAttachment = async (
  attachmentId: string
): Promise<{ error: unknown }> => {
  try {
    // 1. Obter storage_path antes de apagar o registo
    const { data: att, error: fetchError } = await supabase
      .from('transaction_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !att) return { error: fetchError ?? new Error('Anexo não encontrado') };

    // 2. Apagar do Storage
    const { error: storageError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .remove([att.storage_path]);

    if (storageError) return { error: storageError };

    // 3. Apagar registo da tabela (ON DELETE CASCADE apagaria por si, mas mais explícito)
    const { error: dbError } = await supabase
      .from('transaction_attachments')
      .delete()
      .eq('id', attachmentId);

    return { error: dbError };
  } catch (error) {
    return { error };
  }
};

export const getAttachmentPublicUrl = (storagePath: string): string => {
  return supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
};
```

- [ ] **Step 10.4: Correr testes — confirmar PASS**

```bash
npx vitest run src/services/__tests__/attachments.test.ts
```

Esperado: PASS.

- [ ] **Step 10.5: Commit**

```bash
git add src/services/attachments.ts src/services/__tests__/attachments.test.ts
git commit -m "feat: unit6 task10 — transaction-aware attachment upload/list/delete + receipts bucket"
```

---

## Task 11: Atualizar `categories.ts` — `getSystemCategories`, `getCategoriesTree`, bloquear `is_system`

**Ficheiros:**
- Modificar: `src/services/categories.ts`
- Criar: `src/services/__tests__/categories.test.ts`

- [ ] **Step 11.1: Escrever o teste**

```typescript
// src/services/__tests__/categories.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
      ...mockChain,
    }
  };
});

import {
  getSystemCategories,
  getCategoriesTree,
  updateCategory,
} from '../categories';

describe('categories service (Unit 6 extensions)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSystemCategories filtra por is_system = true', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    await getSystemCategories();
    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(supabase.from('categories').eq).toHaveBeenCalledWith('is_system', true);
  });

  it('getCategoriesTree carrega todas as categorias e agrupa pai/filho', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    // Simular dados planos: 1 pai + 2 filhos
    (supabase.from('categories').order as any).mockResolvedValue({
      data: [
        { id: 'p-1', nome: 'Alimentação', parent_id: null, is_system: true },
        { id: 'c-1', nome: 'Supermercado', parent_id: 'p-1', is_system: false },
        { id: 'c-2', nome: 'Restaurante',  parent_id: 'p-1', is_system: false },
      ],
      error: null,
    });

    const result = await getCategoriesTree();

    expect(result.data).toHaveLength(1); // 1 pai
    expect(result.data![0].children).toHaveLength(2); // 2 filhos
  });

  it('updateCategory rejeita edição de categoria is_system', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    // Simular getCategory retornando categoria de sistema
    (supabase.from('categories').single as any).mockResolvedValue({
      data: { id: 'cat-1', nome: 'Alimentação', is_system: true },
      error: null,
    });

    const result = await updateCategory('cat-1', { nome: 'Comida' });

    expect(result.error).toBeTruthy();
    expect((result.error as Error).message).toMatch(/sistema|system/i);
  });
});
```

- [ ] **Step 11.2: Correr teste — confirmar FAIL**

```bash
npx vitest run src/services/__tests__/categories.test.ts
```

Esperado: FAIL — `getSystemCategories`, `getCategoriesTree` não existem; `updateCategory` não bloqueia is_system.

- [ ] **Step 11.3: Atualizar `src/services/categories.ts`**

Ler o ficheiro completo e adicionar/modificar:

```typescript
// Adicionar a src/services/categories.ts

export interface CategoryWithChildren {
  id: string;
  nome: string;
  cor?: string | null;
  icone?: string | null;
  parent_id?: string | null;
  is_system: boolean;
  user_id?: string | null;
  family_id?: string | null;
  children: CategoryWithChildren[];
}

export const getSystemCategories = async (): Promise<{ data: any[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_system', true)
      .order('nome');
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getCategoriesTree = async (
  userId?: string
): Promise<{ data: CategoryWithChildren[] | null; error: unknown }> => {
  try {
    // Carregar todas as categorias (sistema + do user) num só query
    let query = supabase.from('categories').select('*').order('nome');
    // Sem filtro de user_id para incluir categorias de sistema (is_system=true)
    // RLS garante que só o user vê as suas categorias e as de sistema

    const { data, error } = await query;
    if (error || !data) return { data: null, error };

    // Construir árvore em memória
    const byId = new Map(data.map(c => [c.id, { ...c, children: [] as CategoryWithChildren[] }]));
    const roots: CategoryWithChildren[] = [];

    for (const cat of byId.values()) {
      if (cat.parent_id && byId.has(cat.parent_id)) {
        byId.get(cat.parent_id)!.children.push(cat as CategoryWithChildren);
      } else {
        roots.push(cat as CategoryWithChildren);
      }
    }

    return { data: roots, error: null };
  } catch (error) {
    return { data: null, error };
  }
};
```

E modificar `updateCategory` para verificar `is_system` antes de atualizar:

```typescript
// Em updateCategory — adicionar guard no início:
// 1. Obter categoria atual para verificar is_system
const { data: current, error: currentError } = await getCategory(id);
if (currentError) return { data: null, error: currentError };
if (current?.is_system) {
  return {
    data: null,
    error: new Error('Categorias de sistema não podem ser editadas. Use personalizações (category_customizations).'),
  };
}
```

- [ ] **Step 11.4: Correr testes — confirmar PASS**

```bash
npx vitest run src/services/__tests__/categories.test.ts
```

Esperado: PASS.

- [ ] **Step 11.5: Correr suite completa**

```bash
npm test
```

- [ ] **Step 11.6: Commit**

```bash
git add src/services/categories.ts src/services/__tests__/categories.test.ts
git commit -m "feat: unit6 task11 — categories: getSystemCategories, getCategoriesTree, block is_system edit"
```

---

## Task 12: UI — formulário de transferência (`TransferForm.tsx`)

**Ficheiros:**
- Criar: `src/components/TransferForm.tsx`
- Modificar: `src/components/TransactionForm.tsx` (adicionar botão "Nova Transferência")

- [ ] **Step 12.1: Criar `src/components/TransferForm.tsx`**

```typescript
// src/components/TransferForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { createTransfer } from '../services/transfers';
import { useReferenceData } from '../hooks/useCache';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { euroToCents } from '../lib/money';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from './ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from './ui/form';

const today = () => new Date().toISOString().slice(0, 10);

const transferSchema = z.object({
  from_account_id:     z.string().min(1, 'Conta de origem obrigatória'),
  to_account_id:       z.string().min(1, 'Conta de destino obrigatória'),
  amount:              z.coerce.number().positive('Valor deve ser positivo'),
  date:                z.string()
                        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
                        .refine(d => d <= today(), 'Não é possível usar data futura'),
  description:         z.string().max(255).optional(),
}).refine(d => d.from_account_id !== d.to_account_id, {
  message: 'Conta de origem e destino devem ser diferentes',
  path: ['to_account_id'],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface TransferFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TransferForm = ({ onSuccess, onCancel }: TransferFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { accounts } = useReferenceData();

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      amount: undefined,
      date: today(),
      description: '',
    },
  });

  const onSubmit = async (values: TransferFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await createTransfer({
        user_id: user.id,
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        amount_cents: euroToCents(values.amount),
        date: values.date,
        description: values.description || null,
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['transfers'] });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });

      toast({ title: 'Transferência registada com sucesso' });
      form.reset();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registar transferência';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bankAccounts = (accounts ?? []).filter(
    (a: { tipo?: string }) => a.tipo !== 'cartão de crédito'
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="from_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta de origem</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankAccounts.map((acc: { id: string; nome: string }) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="to_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta de destino</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankAccounts.map((acc: { id: string; nome: string }) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (€)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" placeholder="0,00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data</FormLabel>
              <FormControl>
                <Input type="date" max={today()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Poupanças de Abril" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <FormSubmitButton isSubmitting={isSubmitting}>
            Registar transferência
          </FormSubmitButton>
        </div>
      </form>
    </Form>
  );
};

export default TransferForm;
```

- [ ] **Step 12.2: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Corrigir quaisquer erros de tipo. Se `useReferenceData` não expuser `accounts`, adaptar para o hook correto (e.g., `useAccountsQuery`).

- [ ] **Step 12.3: Adicionar botão "Nova Transferência" em `TransactionForm.tsx`**

Ler `src/components/TransactionForm.tsx` e adicionar, perto do título/CTA principal, um botão ou tab que abre `TransferForm` em modal. Exemplo de integração mínima:

```typescript
// Em TransactionForm.tsx — adicionar import e estado
import { TransferForm } from './TransferForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// No JSX, antes do form:
const [showTransferForm, setShowTransferForm] = useState(false);

// Botão que abre o modal de transferência
<Button
  type="button"
  variant="outline"
  onClick={() => setShowTransferForm(true)}
  className="mb-4 w-full"
>
  Nova transferência entre contas
</Button>

<Dialog open={showTransferForm} onOpenChange={setShowTransferForm}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Nova transferência</DialogTitle>
    </DialogHeader>
    <TransferForm
      onSuccess={() => setShowTransferForm(false)}
      onCancel={() => setShowTransferForm(false)}
    />
  </DialogContent>
</Dialog>
```

- [ ] **Step 12.4: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 12.5: Correr suite completa**

```bash
npm test
```

- [ ] **Step 12.6: Commit**

```bash
git add src/components/TransferForm.tsx src/components/TransactionForm.tsx
git commit -m "feat(ui): unit6 task12 — TransferForm component + modal trigger in TransactionForm"
```

---

## Task 13: UI — modal de splits (`TransactionSplitModal.tsx`) + botão em TransactionForm

**Ficheiros:**
- Criar: `src/components/TransactionSplitModal.tsx`
- Modificar: `src/components/TransactionForm.tsx`

- [ ] **Step 13.1: Criar `src/components/TransactionSplitModal.tsx`**

```typescript
// src/components/TransactionSplitModal.tsx
import { useState } from 'react';
import { updateTransactionSplits, SplitInput } from '../services/splits';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { useToast } from '../hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { centsToEuro, euroToCents } from '../lib/money';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from './ui/select';

interface SplitRow extends SplitInput {
  _key: string; // react key
}

interface TransactionSplitModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transactionId: string;
  totalCents: number;
}

export const TransactionSplitModal = ({
  open, onOpenChange, transactionId, totalCents,
}: TransactionSplitModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useCategoriesDomain();
  const [rows, setRows] = useState<SplitRow[]>([
    { _key: crypto.randomUUID(), categoria_id: '', amount_cents: totalCents },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const sumCents = rows.reduce((acc, r) => acc + (r.amount_cents || 0), 0);
  const isBalanced = sumCents === totalCents;

  const addRow = () =>
    setRows(prev => [
      ...prev,
      { _key: crypto.randomUUID(), categoria_id: '', amount_cents: 0 },
    ]);

  const removeRow = (key: string) =>
    setRows(prev => prev.filter(r => r._key !== key));

  const updateRow = (key: string, patch: Partial<SplitRow>) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));

  const handleSave = async () => {
    if (!isBalanced) return;
    setIsSaving(true);
    try {
      const splits: SplitInput[] = rows.map(({ _key: _k, ...rest }) => rest);
      const { error } = await updateTransactionSplits(transactionId, splits);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Splits guardados com sucesso' });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao guardar splits';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dividir por categorias</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map(row => (
            <div key={row._key} className="flex gap-2 items-center">
              <Select
                value={row.categoria_id}
                onValueChange={v => updateRow(row._key, { categoria_id: v })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="w-28"
                value={centsToEuro(row.amount_cents)}
                onChange={e =>
                  updateRow(row._key, { amount_cents: euroToCents(parseFloat(e.target.value) || 0) })
                }
              />
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row._key)}
                >
                  &times;
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between text-sm mt-2">
          <button type="button" onClick={addRow} className="text-blue-600 hover:underline">
            + Adicionar linha
          </button>
          <span className={isBalanced ? 'text-green-600' : 'text-red-600'}>
            {isBalanced
              ? 'Soma correcta'
              : `Soma: ${centsToEuro(sumCents).toFixed(2)}€ (faltam ${centsToEuro(totalCents - sumCents).toFixed(2)}€)`}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isBalanced || isSaving}>
            {isSaving ? 'A guardar...' : 'Guardar splits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionSplitModal;
```

- [ ] **Step 13.2: Adicionar botão "Dividir" a `TransactionForm.tsx`**

Ler o ficheiro e, após gravar uma transação com sucesso, mostrar o botão "Dividir por categorias" que abre `TransactionSplitModal`. O modal recebe `transactionId` (do resultado do create) e `totalCents`.

Padrão de integração:

```typescript
// Em TransactionForm.tsx
import { TransactionSplitModal } from './TransactionSplitModal';

// Estado:
const [splitModal, setSplitModal] = useState<{ txId: string; totalCents: number } | null>(null);

// Após criar transação com sucesso, antes do toast final:
if (createdTx?.id && createdTx?.amount_cents) {
  setSplitModal({ txId: createdTx.id, totalCents: createdTx.amount_cents });
}

// No JSX:
{splitModal && (
  <TransactionSplitModal
    open={!!splitModal}
    onOpenChange={(o) => !o && setSplitModal(null)}
    transactionId={splitModal.txId}
    totalCents={splitModal.totalCents}
  />
)}
```

- [ ] **Step 13.3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 13.4: Correr suite completa**

```bash
npm test
```

- [ ] **Step 13.5: Commit**

```bash
git add src/components/TransactionSplitModal.tsx src/components/TransactionForm.tsx
git commit -m "feat(ui): unit6 task13 — TransactionSplitModal + split button in TransactionForm"
```

---

## Task 14: UI — componente de anexos (`TransactionAttachments.tsx`) + botão em TransactionForm

**Ficheiros:**
- Criar: `src/components/TransactionAttachments.tsx`
- Modificar: `src/components/TransactionForm.tsx`

- [ ] **Step 14.1: Criar `src/components/TransactionAttachments.tsx`**

```typescript
// src/components/TransactionAttachments.tsx
import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  listTransactionAttachments,
  uploadTransactionAttachment,
  deleteTransactionAttachment,
  getAttachmentPublicUrl,
  TransactionAttachment,
} from '../services/attachments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { Button } from './ui/button';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface TransactionAttachmentsProps {
  transactionId: string;
}

export const TransactionAttachments = ({ transactionId }: TransactionAttachmentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments', transactionId],
    queryFn: async () => {
      const { data, error } = await listTransactionAttachments(transactionId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransactionAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', transactionId] });
      toast({ title: 'Anexo removido' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao remover anexo';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ title: 'Ficheiro demasiado grande (máximo 10 MB)', variant: 'destructive' });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({ title: 'Tipo de ficheiro não suportado (use JPG, PNG, WebP ou PDF)', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const { error } = await uploadTransactionAttachment(transactionId, user.id, file);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['attachments', transactionId] });
      toast({ title: 'Anexo carregado com sucesso' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar anexo';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (isLoading) return <div className="text-sm text-gray-400">A carregar anexos...</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Recibos/Faturas</span>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'A carregar...' : '+ Anexar'}
        </Button>
      </div>

      {attachments && attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((att: TransactionAttachment) => (
            <li key={att.id} className="flex items-center gap-2 text-sm">
              <a
                href={getAttachmentPublicUrl(att.storage_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate max-w-xs"
              >
                {att.original_filename ?? att.storage_path}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 h-6 px-1"
                onClick={() => deleteMutation.mutate(att.id)}
              >
                &times;
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TransactionAttachments;
```

- [ ] **Step 14.2: Adicionar `TransactionAttachments` a `TransactionForm.tsx`**

Após criar uma transação com sucesso, mostrar o componente de anexos passando o `transactionId`. Ou expor numa vista de detalhe de transação. Integração mínima no form:

```typescript
// Em TransactionForm.tsx — após transação criada:
import { TransactionAttachments } from './TransactionAttachments';

// Estado:
const [createdTxId, setCreatedTxId] = useState<string | null>(null);

// Após createTransaction com sucesso:
if (created?.id) setCreatedTxId(created.id);

// No JSX (após o form, quando transação foi criada):
{createdTxId && (
  <div className="mt-4 border-t pt-4">
    <TransactionAttachments transactionId={createdTxId} />
  </div>
)}
```

- [ ] **Step 14.3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 14.4: Correr suite completa**

```bash
npm test
```

- [ ] **Step 14.5: Commit**

```bash
git add src/components/TransactionAttachments.tsx src/components/TransactionForm.tsx
git commit -m "feat(ui): unit6 task14 — TransactionAttachments component with upload/delete"
```

---

## Task 15: UI — hierarquia em `CategoryForm.tsx` + categorias de sistema read-only

**Ficheiros:**
- Modificar: `src/components/CategoryForm.tsx`

- [ ] **Step 15.1: Ler `src/components/CategoryForm.tsx` completo**

Identificar onde o formulário é renderizado e quais os campos atuais.

- [ ] **Step 15.2: Adicionar campo `parent_id` e lógica `is_system`**

Atualizar `CategoryForm.tsx` com as seguintes mudanças:

1. Importar `getCategoriesTree` e carregar categorias pai disponíveis (excluir `is_system`, excluir a própria categoria se em edição).
2. Adicionar campo `parent_id` — Select de categorias pai (apenas raiz, sem `parent_id`).
3. Se `initialData?.is_system === true`, renderizar todos os campos como `disabled` e mostrar aviso "Esta é uma categoria de sistema. Use personalizações para alterar cor e ícone.".

```typescript
// Dentro de CategoryForm.tsx — adicionar:
import { useQuery } from '@tanstack/react-query';
import { getCategoriesTree } from '../services/categories';

// No componente:
const { data: categoriesTree } = useQuery({
  queryKey: ['categories-tree'],
  queryFn: () => getCategoriesTree(),
  select: (result) => result.data ?? [],
});

const isSystemCategory = !!(initialData as any)?.is_system;

// No defaultValues do useForm:
// parent_id: (initialData as any)?.parent_id ?? null,

// No JSX — antes do submit button:
{isSystemCategory && (
  <div className="rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
    Esta categoria é de sistema e não pode ser editada diretamente.
    Para personalizar cor ou ícone, use "Personalizações de categoria".
  </div>
)}

// Campo parent_id (apenas para categorias não-sistema):
{!isSystemCategory && (
  <div>
    <label className="text-sm font-medium">Categoria pai (opcional)</label>
    <select
      {...register('parent_id')}
      className="mt-1 block w-full rounded border border-gray-300 p-2 text-sm"
    >
      <option value="">— Nenhuma (categoria raiz) —</option>
      {(categoriesTree ?? [])
        .filter(c => !c.is_system && c.id !== initialData?.id)
        .map(c => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))
      }
    </select>
  </div>
)}

// Desabilitar campos se is_system:
// Adicionar fieldset disabled={isSystemCategory} em volta do form content
```

- [ ] **Step 15.3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 15.4: Correr suite completa**

```bash
npm test
```

- [ ] **Step 15.5: Commit**

```bash
git add src/components/CategoryForm.tsx
git commit -m "feat(ui): unit6 task15 — CategoryForm: parent_id field + is_system read-only guard"
```

---

## Verificação Final

Após todas as tasks completadas:

- [ ] **Compilação limpa**

```bash
npx tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Suite completa de testes**

```bash
npm test
```

Esperado: todos os testes PASS. Atenção especial a:
- `src/validation/__tests__/transactionSchema.test.ts` — data futura rejeitada
- `src/services/__tests__/transactions.test.ts` — operation_id gerado, reverseTransaction
- `src/services/__tests__/transfers.test.ts` — createTransfer, listTransfers
- `src/services/__tests__/splits.test.ts` — updateTransactionSplits, getTransactionSplits
- `src/services/__tests__/attachments.test.ts` — upload, list, delete
- `src/services/__tests__/categories.test.ts` — getSystemCategories, getCategoriesTree, is_system guard

- [ ] **Verificar que trigger funciona em produção (Supabase SQL Editor)**

```sql
-- 1. Confirmar que INSERT em transfers cria 2 rows em transactions
SELECT COUNT(*) FROM transfers;
SELECT COUNT(*) FROM transactions WHERE transfer_id IS NOT NULL;
-- Ratio deve ser 2:1

-- 2. Confirmar operation_id NOT NULL em transactions
SELECT COUNT(*) FROM transactions WHERE operation_id IS NULL;
-- Esperado: 0

-- 3. Confirmar que categories.parent_id existe e trigger de profundidade funciona
SELECT column_name FROM information_schema.columns
WHERE table_name = 'categories' AND column_name = 'parent_id';
-- Esperado: 1 row

-- 4. Confirmar tabelas novas existem
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('transfers', 'transaction_splits', 'transaction_attachments');
-- Esperado: 3 rows
```

- [ ] **Verificar RLS (nenhum dado cross-user visível)**

```sql
-- Testar com um user sem dados que não veja transfers de outros
SELECT COUNT(*) FROM transfers; -- deve retornar apenas transfers do auth.uid()
SELECT COUNT(*) FROM transaction_splits; -- idem, filtrado por user das transactions
SELECT COUNT(*) FROM transaction_attachments; -- idem
```

- [ ] **Regenerar tipos TypeScript final**

```bash
npm run types:gen
npx tsc --noEmit
```

- [ ] **Commit final de tipos regenerados**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore: unit6 — regenerate TypeScript types after all migrations"
```
