-- RLS hardening for accounts and budgets (personal vs family, viewers read-only)
-- Idempotent migration

-- Helpers ------------------------------------------------------------------
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

-- Optional helper to check non-viewer membership (owner/admin/member)
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

-- Ensure RLS is enabled -----------------------------------------------------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets  ENABLE ROW LEVEL SECURITY;

-- Recommended indexes (idempotent) -----------------------------------------
CREATE INDEX IF NOT EXISTS idx_accounts_family_id ON public.accounts(family_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id   ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_family_id  ON public.budgets(family_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id    ON public.budgets(user_id);

-- Drop legacy/conflicting policies (best-effort) ----------------------------
-- accounts
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_select_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_select_own');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_insert_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_insert_own');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_update_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_update_own');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_delete_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_delete_own');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_mutate_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_mutate_own');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_delete_non_viewer_or_owner');

-- budgets
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_select_family');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_select_own');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_mutate_family');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_mutate_own');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_delete_non_viewer_or_owner');

-- New unified policies ------------------------------------------------------
-- ACCOUNTS
-- Read: personal (user_id = auth.uid() and family_id IS NULL) OR any family member when family_id is present
CREATE POLICY accounts_select_personal_or_family
ON public.accounts
FOR SELECT
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.family_members fm
     WHERE fm.family_id = public.accounts.family_id
       AND fm.user_id = auth.uid()
  ))
);

-- Insert: personal by owner; family by non-viewer member (owner/admin/member)
CREATE POLICY accounts_insert_personal_or_family_non_viewer
ON public.accounts
FOR INSERT
WITH CHECK (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- Update: personal by owner; family by non-viewer member
CREATE POLICY accounts_update_non_viewer_or_owner
ON public.accounts
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
CREATE POLICY accounts_delete_non_viewer_or_owner
ON public.accounts
FOR DELETE
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- BUDGETS
-- Read: personal (user_id = auth.uid() and family_id IS NULL) OR any family member when family_id is present
CREATE POLICY budgets_select_personal_or_family
ON public.budgets
FOR SELECT
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.family_members fm
     WHERE fm.family_id = public.budgets.family_id
       AND fm.user_id = auth.uid()
  ))
);

-- Insert: personal by owner; family by non-viewer member
CREATE POLICY budgets_insert_personal_or_family_non_viewer
ON public.budgets
FOR INSERT
WITH CHECK (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- Update: personal by owner; family by non-viewer member
CREATE POLICY budgets_update_non_viewer_or_owner
ON public.budgets
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
CREATE POLICY budgets_delete_non_viewer_or_owner
ON public.budgets
FOR DELETE
USING (
  (family_id IS NULL AND user_id = auth.uid())
  OR
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);