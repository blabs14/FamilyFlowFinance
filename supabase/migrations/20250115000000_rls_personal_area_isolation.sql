-- RLS Personal Area Isolation - Complete user isolation for personal area (family_id IS NULL)
-- This migration ensures that in the personal area, each user can only access their own data
-- Family-based access is only allowed in the family area (family_id IS NOT NULL)

-- Helper function to check if we're in personal context (family_id IS NULL)
CREATE OR REPLACE FUNCTION public._is_personal_context(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_family_id IS NULL;
$$;

-- Helper function to check if we're in family context (family_id IS NOT NULL)
CREATE OR REPLACE FUNCTION public._is_family_context(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_family_id IS NOT NULL;
$$;

-- Drop existing policies that mix personal and family access
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.transactions', 'transactions_delete_non_viewer_or_owner');

SELECT public._drop_policy_if_exists('public.categories', 'categories_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.categories', 'categories_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.categories', 'categories_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.categories', 'categories_delete_non_viewer_or_owner');

SELECT public._drop_policy_if_exists('public.accounts', 'accounts_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.accounts', 'accounts_delete_non_viewer_or_owner');

SELECT public._drop_policy_if_exists('public.budgets', 'budgets_select_personal_or_family');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_insert_personal_or_family_non_viewer');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_update_non_viewer_or_owner');
SELECT public._drop_policy_if_exists('public.budgets', 'budgets_delete_non_viewer_or_owner');

-- TRANSACTIONS - Personal Area (Complete User Isolation)
-- Personal transactions: only the owner can access
CREATE POLICY transactions_personal_select
ON public.transactions
FOR SELECT
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY transactions_personal_insert
ON public.transactions
FOR INSERT
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id 
      AND a.family_id IS NULL 
      AND a.user_id = auth.uid()
  )
);

CREATE POLICY transactions_personal_update
ON public.transactions
FOR UPDATE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id 
      AND a.family_id IS NULL 
      AND a.user_id = auth.uid()
  )
);

CREATE POLICY transactions_personal_delete
ON public.transactions
FOR DELETE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

-- TRANSACTIONS - Family Area (Family-based Access)
-- Family transactions: accessible by family members based on roles
CREATE POLICY transactions_family_select
ON public.transactions
FOR SELECT
USING (
  family_id IS NOT NULL 
  AND EXISTS (
    SELECT 1
    FROM public.accounts a
    JOIN public.family_members fm ON fm.family_id = a.family_id AND fm.user_id = auth.uid()
    WHERE a.id = public.transactions.account_id
  )
);

CREATE POLICY transactions_family_insert
ON public.transactions
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL 
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id
      AND a.family_id = family_id
      AND public.is_family_non_viewer(a.family_id)
  )
);

CREATE POLICY transactions_family_update
ON public.transactions
FOR UPDATE
USING (
  family_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    JOIN public.family_members fm ON fm.family_id = a.family_id AND fm.user_id = auth.uid()
    WHERE a.id = public.transactions.account_id AND fm.role <> 'viewer'
  )
)
WITH CHECK (
  family_id IS NOT NULL 
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id
      AND a.family_id = family_id
      AND public.is_family_non_viewer(a.family_id)
  )
);

CREATE POLICY transactions_family_delete
ON public.transactions
FOR DELETE
USING (
  family_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    JOIN public.family_members fm ON fm.family_id = a.family_id AND fm.user_id = auth.uid()
    WHERE a.id = public.transactions.account_id AND fm.role <> 'viewer'
  )
);

-- CATEGORIES - Personal Area (Complete User Isolation)
CREATE POLICY categories_personal_select
ON public.categories
FOR SELECT
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY categories_personal_insert
ON public.categories
FOR INSERT
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY categories_personal_update
ON public.categories
FOR UPDATE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY categories_personal_delete
ON public.categories
FOR DELETE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

-- CATEGORIES - Family Area (Family-based Access)
CREATE POLICY categories_family_select
ON public.categories
FOR SELECT
USING (
  family_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.family_id = public.categories.family_id
      AND fm.user_id = auth.uid()
  )
);

CREATE POLICY categories_family_insert
ON public.categories
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

CREATE POLICY categories_family_update
ON public.categories
FOR UPDATE
USING (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
)
WITH CHECK (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

CREATE POLICY categories_family_delete
ON public.categories
FOR DELETE
USING (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

-- ACCOUNTS - Personal Area (Complete User Isolation)
CREATE POLICY accounts_personal_select
ON public.accounts
FOR SELECT
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY accounts_personal_insert
ON public.accounts
FOR INSERT
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY accounts_personal_update
ON public.accounts
FOR UPDATE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY accounts_personal_delete
ON public.accounts
FOR DELETE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

-- ACCOUNTS - Family Area (Family-based Access)
CREATE POLICY accounts_family_select
ON public.accounts
FOR SELECT
USING (
  family_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.family_id = public.accounts.family_id
      AND fm.user_id = auth.uid()
  )
);

CREATE POLICY accounts_family_insert
ON public.accounts
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

CREATE POLICY accounts_family_update
ON public.accounts
FOR UPDATE
USING (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
)
WITH CHECK (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

CREATE POLICY accounts_family_delete
ON public.accounts
FOR DELETE
USING (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

-- BUDGETS - Personal Area (Complete User Isolation)
CREATE POLICY budgets_personal_select
ON public.budgets
FOR SELECT
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY budgets_personal_insert
ON public.budgets
FOR INSERT
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY budgets_personal_update
ON public.budgets
FOR UPDATE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
)
WITH CHECK (
  family_id IS NULL 
  AND user_id = auth.uid()
);

CREATE POLICY budgets_personal_delete
ON public.budgets
FOR DELETE
USING (
  family_id IS NULL 
  AND user_id = auth.uid()
);

-- BUDGETS - Family Area (Family-based Access)
CREATE POLICY budgets_family_select
ON public.budgets
FOR SELECT
USING (
  family_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.family_id = public.budgets.family_id
      AND fm.user_id = auth.uid()
  )
);

CREATE POLICY budgets_family_insert
ON public.budgets
FOR INSERT
WITH CHECK (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

CREATE POLICY budgets_family_update
ON public.budgets
FOR UPDATE
USING (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
)
WITH CHECK (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

CREATE POLICY budgets_family_delete
ON public.budgets
FOR DELETE
USING (
  family_id IS NOT NULL 
  AND public.is_family_non_viewer(family_id)
);

-- CATEGORY_CUSTOMIZATIONS - Always personal (user-specific customizations)
-- Drop existing policy if exists
SELECT public._drop_policy_if_exists('public.category_customizations', 'category_customizations_user_access');

CREATE POLICY category_customizations_personal_only
ON public.category_customizations
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add helpful comments
COMMENT ON POLICY transactions_personal_select ON public.transactions IS 'Personal area: complete user isolation - only owner can access';
COMMENT ON POLICY transactions_family_select ON public.transactions IS 'Family area: family-based access - all family members can view';
COMMENT ON POLICY categories_personal_select ON public.categories IS 'Personal area: complete user isolation - only owner can access';
COMMENT ON POLICY categories_family_select ON public.categories IS 'Family area: family-based access - all family members can view';
COMMENT ON POLICY accounts_personal_select ON public.accounts IS 'Personal area: complete user isolation - only owner can access';
COMMENT ON POLICY accounts_family_select ON public.accounts IS 'Family area: family-based access - all family members can view';
COMMENT ON POLICY budgets_personal_select ON public.budgets IS 'Personal area: complete user isolation - only owner can access';
COMMENT ON POLICY budgets_family_select ON public.budgets IS 'Family area: family-based access - all family members can view';
COMMENT ON POLICY category_customizations_personal_only ON public.category_customizations IS 'Category customizations are always personal and user-specific';