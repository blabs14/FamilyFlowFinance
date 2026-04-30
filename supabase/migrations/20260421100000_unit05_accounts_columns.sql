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
