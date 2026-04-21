-- Fix categories RLS policies to allow access to default categories (user_id IS NULL)
-- This ensures that default categories are visible to all authenticated users in personal area

-- Drop existing policies
DROP POLICY IF EXISTS categories_select_personal_or_family ON public.categories;
DROP POLICY IF EXISTS categories_insert_personal_or_family_non_viewer ON public.categories;
DROP POLICY IF EXISTS categories_update_non_viewer_or_owner ON public.categories;
DROP POLICY IF EXISTS categories_delete_non_viewer_or_owner ON public.categories;

-- CATEGORIES SELECT: Allow access to default categories (user_id IS NULL) + personal + family
CREATE POLICY categories_select_default_personal_or_family
ON public.categories
FOR SELECT
USING (
  -- Default categories (visible to all authenticated users)
  (user_id IS NULL)
  OR
  -- Personal categories (owner only)
  (family_id IS NULL AND user_id = auth.uid())
  OR
  -- Family categories (any family member)
  (family_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.family_members fm
     WHERE fm.family_id = public.categories.family_id
       AND fm.user_id = auth.uid()
  ))
);

-- CATEGORIES INSERT: Personal by owner; family by non-viewer member (default categories cannot be inserted by users)
CREATE POLICY categories_insert_personal_or_family_non_viewer
ON public.categories
FOR INSERT
WITH CHECK (
  -- Personal categories (owner only)
  (family_id IS NULL AND user_id = auth.uid())
  OR
  -- Family categories (non-viewer members only)
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- CATEGORIES UPDATE: Personal by owner; family by non-viewer member (default categories cannot be updated by users)
CREATE POLICY categories_update_personal_or_family_non_viewer
ON public.categories
FOR UPDATE
USING (
  -- Personal categories (owner only)
  (family_id IS NULL AND user_id = auth.uid())
  OR
  -- Family categories (non-viewer members only)
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
)
WITH CHECK (
  -- Personal categories (owner only)
  (family_id IS NULL AND user_id = auth.uid())
  OR
  -- Family categories (non-viewer members only)
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);

-- CATEGORIES DELETE: Personal by owner; family by non-viewer member (default categories cannot be deleted by users)
CREATE POLICY categories_delete_personal_or_family_non_viewer
ON public.categories
FOR DELETE
USING (
  -- Personal categories (owner only)
  (family_id IS NULL AND user_id = auth.uid())
  OR
  -- Family categories (non-viewer members only)
  (family_id IS NOT NULL AND public.is_family_non_viewer(family_id))
);