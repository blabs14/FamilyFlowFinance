-- RLS helpers: define is_family_non_viewer and _drop_policy_if_exists before policies that reference them
-- Idempotent: uses CREATE OR REPLACE and checks existing policies via pg_policies

-- Helper to drop a policy if it exists (used by later migrations safely)
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

-- Helper to check if current user is a non-viewer in a family
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