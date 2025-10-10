-- Migração: Marcação robusta de contas Objetivos e atualização da view account_reserved
-- Data: 2025-10-02

-- 1) Marcar contas de Objetivos com coluna explícita
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_goals boolean NOT NULL DEFAULT false;

-- Atualizar contas existentes que são Objetivos
UPDATE public.accounts a
SET is_goals = true, updated_at = NOW()
WHERE is_goals = false AND (
  LOWER(a.nome) LIKE '%objetivo%' OR LOWER(a.tipo) LIKE '%objetivo%'
);

-- Padronizar nomes das contas de Objetivos
UPDATE public.accounts
SET nome = 'Objetivos Pessoais', updated_at = NOW()
WHERE is_goals = true AND family_id IS NULL AND nome <> 'Objetivos Pessoais';

UPDATE public.accounts
SET nome = 'Objetivos Familiares', updated_at = NOW()
WHERE is_goals = true AND family_id IS NOT NULL AND nome <> 'Objetivos Familiares';

-- 2) Atualizar ensure_goals_account para usar is_goals
CREATE OR REPLACE FUNCTION public.ensure_goals_account(p_user_id UUID DEFAULT NULL, p_family_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_account_name TEXT;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilizador não autenticado'; END IF;

  IF p_family_id IS NULL THEN
    v_account_name := 'Objetivos Pessoais';
  ELSE
    v_account_name := 'Objetivos Familiares';
  END IF;

  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE user_id = v_user_id
    AND family_id IS NOT DISTINCT FROM p_family_id
    AND is_goals = true
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (id, user_id, family_id, nome, tipo, saldo, created_at, updated_at, is_goals)
    VALUES (gen_random_uuid(), v_user_id, p_family_id, v_account_name, 'poupança', 0, NOW(), NOW(), true)
    RETURNING id INTO v_account_id;
  ELSE
    UPDATE public.accounts
    SET nome = v_account_name, updated_at = NOW()
    WHERE id = v_account_id AND nome <> v_account_name;
  END IF;

  RETURN v_account_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_goals_account(UUID, UUID) IS 'Garante conta Objetivos (is_goals=true) pessoal/familiar.';
GRANT EXECUTE ON FUNCTION public.ensure_goals_account(UUID, UUID) TO authenticated;

-- 3) Atualizar view account_reserved (robusta, sem dupla contagem)
DROP VIEW IF EXISTS public.account_reserved;

CREATE OR REPLACE VIEW public.account_reserved AS
WITH ga_filtered AS (
  SELECT ga.account_id, ga.goal_id, ga.valor
  FROM public.goal_allocations ga
  JOIN public.goals g ON g.id = ga.goal_id
  WHERE g.status <> 'completed'
),
per_account_reserved AS (
  SELECT a.id AS account_id,
         COALESCE(SUM(ga.valor), 0)::numeric(15,2) AS reservado_origem
  FROM public.accounts a
  LEFT JOIN ga_filtered ga ON ga.account_id = a.id
  WHERE a.is_goals = false
  GROUP BY a.id
),
goals_account_reserved AS (
  SELECT a.id AS account_id,
         (
           SELECT COALESCE(SUM(ga.valor), 0)::numeric(15,2)
           FROM ga_filtered ga
           JOIN public.accounts a2 ON a2.id = ga.account_id
           WHERE CASE 
             WHEN a.family_id IS NULL THEN (a2.user_id = a.user_id AND a2.family_id IS NULL)
             ELSE a2.family_id = a.family_id
           END
         ) AS reservado_objetivos
  FROM public.accounts a
  WHERE a.is_goals = true
)
SELECT account_id, reservado_origem AS total_reservado
FROM per_account_reserved
UNION ALL
SELECT account_id, reservado_objetivos AS total_reservado
FROM goals_account_reserved;

GRANT SELECT ON public.account_reserved TO authenticated;

-- 4) Índices para performance
CREATE INDEX IF NOT EXISTS idx_goal_allocations_account_goal ON public.goal_allocations(account_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_goal_user_date ON public.goal_allocations(goal_id, user_id, data_alocacao DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_is_goals_user_family ON public.accounts(is_goals, user_id, family_id);

-- 5) Nova RPC com escopo e origin-only para evitar dupla contagem em agregações
DROP FUNCTION IF EXISTS public.get_user_account_reserved_scoped(boolean, boolean);

CREATE OR REPLACE FUNCTION public.get_user_account_reserved_scoped(p_include_family boolean DEFAULT true, p_origin_only boolean DEFAULT false)
RETURNS TABLE(account_id uuid, total_reservado numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    -- Contas pessoais
    SELECT ar.account_id, ar.total_reservado
    FROM public.account_reserved ar
    JOIN public.accounts a ON a.id = ar.account_id
    WHERE a.user_id = auth.uid()
      AND a.family_id IS NULL
      AND (p_origin_only IS FALSE OR a.is_goals = FALSE)
    UNION ALL
    -- Contas familiares onde o utilizador é membro
    SELECT ar.account_id, ar.total_reservado
    FROM public.account_reserved ar
    JOIN public.accounts a ON a.id = ar.account_id
    WHERE p_include_family IS TRUE
      AND a.family_id IS NOT NULL
      AND (p_origin_only IS FALSE OR a.is_goals = FALSE)
      AND EXISTS (
        SELECT 1 FROM public.family_members fm 
        WHERE fm.family_id = a.family_id AND fm.user_id = auth.uid()
      )
  )
  SELECT account_id, total_reservado FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_account_reserved_scoped(boolean, boolean) TO authenticated;