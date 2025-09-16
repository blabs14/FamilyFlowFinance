-- RLS hardening for transactions and categories (personal vs family, viewers read-only for family)
-- Idempotent migration

-- Helpers (reused safely) ---------------------------------------------------
CREATE OR REPLACE FUNCTION public._drop_policy_if_exists(p_table regclass, p_policy text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = split_part(p_table::text, '.', 1)
      AND tablename = split_part(p_table::text, '.', 2)
      AND policyname = p_policy
  ) THEN
    EXECUTE format('DROP POLICY %I ON %s', p_policy, p_table);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_family_non_viewer(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    WHERE fm.family_id = p_family_id
      AND fm.user_id = auth.uid()
      AND fm.role <> 'viewer'
  );
$$;

-- Ensure RLS enabled --------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories   ENABLE ROW LEVEL SECURITY;

-- Recommended indexes -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_family_id  ON public.transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id      ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_family_id    ON public.categories(family_id);

-- Drop legacy/conflicting policies -----------------------------------------
-- transactions
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_select_simple');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_insert_simple');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_update_simple');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_delete_simple');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_delete_non_viewer_or_owner');

-- categories
SELECT public._drop_policy_if_exists('public.categories', 'categories_select_family');
SELECT public._drop_policy_if_exists('public.categories', 'categories_select_own');
SELECT public._drop_policy_if_exists('public.categories', 'categories_mutate_family');
SELECT public._drop_policy_if_exists('public.categories', 'categories_mutate_own');
SELECT public._drop_policy_if_exists('public.categories', 'categories_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.categories', 'categories_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.categories', 'categories_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.categories', 'categories_delete_non_viewer_or_owner');

-- New unified policies ------------------------------------------------------
-- TRANSACTIONS
-- Read: personal (user scoped) OR family (any family member of the account's family)
CREATE POLICY transactions_select_personal_or_family
ON public.transactions
FOR SELECT
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1
     FROM public.accounts a
     JOIN public.family_members fm ON fm.family_id = a.family_id AND fm.user_id = auth.uid()
     WHERE a.id = public.transactions.account_id
  ))
);

-- Insert: owner for personal (account belongs to user and no family); family by non-viewer member
CREATE POLICY transactions_insert_personal_or_family_non_viewer
ON public.transactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    (family_id IS NULL AND EXISTS (
       SELECT 1 FROM public.accounts a
       WHERE a.id = account_id AND a.family_id IS NULL AND a.user_id = auth.uid()
    ))
    OR
    (family_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.accounts a
       WHERE a.id = account_id
         AND a.family_id = family_id
         AND public.is_family_non_viewer(a.family_id)
    ))
  )
);

-- Update: same conditions as insert; for existing row, also require access rights
CREATE POLICY transactions_update_non_viewer_or_owner
ON public.transactions
FOR UPDATE
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.accounts a
     JOIN public.family_members fm ON fm.family_id = a.family_id AND fm.user_id = auth.uid()
     WHERE a.id = public.transactions.account_id AND fm.role <> 'viewer'
  ))
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    (family_id IS NULL AND EXISTS (
       SELECT 1 FROM public.accounts a
       WHERE a.id = account_id AND a.family_id IS NULL AND a.user_id = auth.uid()
    ))
    OR
    (family_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.accounts a
       WHERE a.id = account_id
         AND a.family_id = family_id
         AND public.is_family_non_viewer(a.family_id)
    ))
  )
);

-- Delete: owner for personal; family by non-viewer member
CREATE POLICY transactions_delete_non_viewer_or_owner
ON public.transactions
FOR DELETE
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.accounts a
     JOIN public.family_members fm ON fm.family_id = a.family_id AND fm.user_id = auth.uid()
     WHERE a.id = public.transactions.account_id AND fm.role <> 'viewer'
  ))
);

-- CATEGORIES
-- Read: personal (owner) OR family (any family member)
CREATE POLICY categories_select_personal_or_family
ON public.categories
FOR SELECT
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.family_members fm
     WHERE fm.family_id = public.categories.family_id
       AND fm.user_id = auth.uid()
  ))
);

-- Insert: personal by owner; family by non-viewer member
CREATE POLICY categories_insert_personal_or_family_non_viewer
ON public.categories
FOR INSERT
WITH CHECK (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- Update: personal by owner; family by non-viewer member
CREATE POLICY categories_update_non_viewer_or_owner
ON public.categories
FOR UPDATE
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
)
WITH CHECK (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- Delete: personal by owner; family by non-viewer member
CREATE POLICY categories_delete_non_viewer_or_owner
ON public.categories
FOR DELETE
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);