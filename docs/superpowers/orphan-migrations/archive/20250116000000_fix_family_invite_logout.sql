-- Fix family invite logout issue
-- This migration addresses the unexpected logout that occurs during family invitations

-- First, let's create a safer version of the invite_family_member_by_email function
-- The issue seems to be related to session invalidation during RPC execution

CREATE OR REPLACE FUNCTION public.invite_family_member_by_email_safe(p_family_id uuid, p_email text, p_role text DEFAULT 'member'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_user_role text;
  v_invite_id uuid;
  v_existing_user_id uuid;
BEGIN
  -- Set search path to avoid any potential issues
  SET search_path = public, pg_temp;
  
  -- Get authenticated user ID with explicit check
  v_user_id := auth.uid();
  
  -- Early return if not authenticated to prevent session issues
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'Utilizador não autenticado'
    );
  END IF;

  -- Validate email format
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_EMAIL',
      'message', 'Email inválido'
    );
  END IF;

  -- Validate role
  IF p_role NOT IN ('member', 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_ROLE',
      'message', 'Role inválido. Deve ser "member" ou "admin"'
    );
  END IF;

  -- Check if user is member of the family with proper role
  SELECT role INTO v_user_role
  FROM family_members 
  WHERE family_id = p_family_id AND user_id = v_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'ACCESS_DENIED',
      'message', 'Acesso negado: utilizador não é membro desta família'
    );
  END IF;
  
  IF v_user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INSUFFICIENT_PERMISSIONS',
      'message', 'Acesso negado: apenas administradores podem convidar membros'
    );
  END IF;

  -- Check if there's already a pending invite for this email
  IF EXISTS (
    SELECT 1 FROM family_invites 
    WHERE family_id = p_family_id 
      AND email = p_email 
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVITE_EXISTS',
      'message', 'Já existe um convite pendente para este email'
    );
  END IF;

  -- Check if user is already a member of the family
  SELECT au.id INTO v_existing_user_id
  FROM auth.users au
  JOIN family_members fm ON fm.user_id = au.id
  WHERE fm.family_id = p_family_id AND au.email = p_email;
  
  IF v_existing_user_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'USER_ALREADY_MEMBER',
      'message', 'Utilizador já é membro desta família'
    );
  END IF;

  -- Create the invite
  INSERT INTO family_invites (family_id, email, role, status, invited_by, expires_at)
  VALUES (p_family_id, p_email, p_role, 'pending', v_user_id, NOW() + INTERVAL '7 days')
  RETURNING id INTO v_invite_id;

  -- Return success response
  RETURN json_build_object(
    'success', true, 
    'message', 'Convite enviado com sucesso',
    'invite_id', v_invite_id,
    'email', p_email,
    'role', p_role,
    'expires_at', (NOW() + INTERVAL '7 days')::text
  );
  
EXCEPTION 
  WHEN OTHERS THEN
    -- Log error without exposing sensitive information
    RAISE LOG 'Erro em invite_family_member_by_email_safe: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    
    -- Return structured error response instead of raising exception
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'message', 'Erro interno do servidor. Tente novamente.'
    );
END;
$function$;

-- Create a wrapper function that maintains backward compatibility
-- but uses the safer implementation
CREATE OR REPLACE FUNCTION public.invite_family_member_by_email(p_family_id uuid, p_email text, p_role text DEFAULT 'member'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result json;
BEGIN
  -- Use the safer implementation
  SELECT invite_family_member_by_email_safe(p_family_id, p_email, p_role) INTO v_result;
  
  -- If the result indicates an error, we can choose to either:
  -- 1. Return the structured error (recommended)
  -- 2. Raise an exception for backward compatibility
  
  -- For now, let's return structured errors to prevent session issues
  RETURN v_result;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.invite_family_member_by_email_safe(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_family_member_by_email(uuid, text, text) TO authenticated;

-- Add a comment explaining the fix
COMMENT ON FUNCTION public.invite_family_member_by_email_safe IS 'Safe version of family invite function that prevents session invalidation by returning structured errors instead of raising exceptions';
COMMENT ON FUNCTION public.invite_family_member_by_email IS 'Backward compatible wrapper for family invite function that uses safer implementation';

-- Create an index to improve performance of invite lookups
CREATE INDEX IF NOT EXISTS idx_family_invites_email_status_expires 
ON family_invites(email, status, expires_at) 
WHERE status = 'pending';

-- Create an index for family member role lookups
CREATE INDEX IF NOT EXISTS idx_family_members_family_user_role 
ON family_members(family_id, user_id, role);