-- Fix family_invites RLS policies
-- The table has GRANT permissions but missing RLS policies for INSERT, UPDATE, DELETE
-- This causes the invite_family_member_by_email RPC to fail and potentially cause auth issues

-- Enable RLS on family_invites if not already enabled
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if they exist to avoid conflicts
DO $$
BEGIN
  -- Drop INSERT policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='family_invites' AND policyname='family_invites_insert_authenticated'
  ) THEN
    EXECUTE 'DROP POLICY "family_invites_insert_authenticated" ON public.family_invites';
  END IF;
  
  -- Drop UPDATE policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='family_invites' AND policyname='family_invites_update_authenticated'
  ) THEN
    EXECUTE 'DROP POLICY "family_invites_update_authenticated" ON public.family_invites';
  END IF;
  
  -- Drop DELETE policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='family_invites' AND policyname='family_invites_delete_authenticated'
  ) THEN
    EXECUTE 'DROP POLICY "family_invites_delete_authenticated" ON public.family_invites';
  END IF;
END$$;

-- CREATE INSERT policy: Allow authenticated users to insert invites for families they admin
CREATE POLICY "family_invites_insert_authenticated"
  ON public.family_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = family_invites.family_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('owner', 'admin')
    )
  );

-- CREATE UPDATE policy: Allow authenticated users to update invites for families they admin
CREATE POLICY "family_invites_update_authenticated"
  ON public.family_invites
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = family_invites.family_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = family_invites.family_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('owner', 'admin')
    )
  );

-- CREATE DELETE policy: Allow authenticated users to delete invites for families they admin
CREATE POLICY "family_invites_delete_authenticated"
  ON public.family_invites
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = family_invites.family_id
        AND fm.user_id = auth.uid()
        AND fm.role IN ('owner', 'admin')
    )
  );

-- Grant necessary permissions to service_role for RPC functions
GRANT ALL ON public.family_invites TO service_role;

-- Verify the policies were created
DO $$
BEGIN
  -- Check if all policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='family_invites' AND policyname='family_invites_insert_authenticated'
  ) THEN
    RAISE EXCEPTION 'INSERT policy was not created successfully';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='family_invites' AND policyname='family_invites_update_authenticated'
  ) THEN
    RAISE EXCEPTION 'UPDATE policy was not created successfully';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='family_invites' AND policyname='family_invites_delete_authenticated'
  ) THEN
    RAISE EXCEPTION 'DELETE policy was not created successfully';
  END IF;
  
  RAISE NOTICE 'All family_invites RLS policies created successfully';
END$$;