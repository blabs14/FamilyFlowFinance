-- Atualizar view goal_progress para usar transações do cofre como fonte de verdade
-- Esta versão corrige o problema da divergência entre goal_allocations e saldo real

-- Primeiro, criar uma função helper para obter o account_id da conta "Objetivos"
CREATE OR REPLACE FUNCTION public.get_goals_account_id(user_id_param uuid, family_id_param uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  SELECT id INTO v_account_id
  FROM accounts 
  WHERE user_id = user_id_param 
    AND family_id = family_id_param 
    AND nome = 'Objetivos'
  LIMIT 1;
  
  RETURN v_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_goals_account_id TO authenticated;

-- Recriar a view goal_progress usando transações como fonte de verdade
DROP VIEW IF EXISTS "public"."goal_progress";

CREATE OR REPLACE VIEW "public"."goal_progress" AS 
SELECT 
    g.id,
    g.nome,
    g.valor_objetivo,
    g.user_id,
    g.family_id,
    -- FONTE DE VERDADE: Somar transações na conta Objetivos para este goal_id
    COALESCE(
      (SELECT SUM(t.valor) 
       FROM transactions t
       WHERE t.goal_id = g.id 
         AND t.account_id = get_goals_account_id(g.user_id, g.family_id)
         AND t.user_id = g.user_id
      ), 0
    ) AS total_alocado_real,
    
    -- Manter o total das allocations para comparação/debug (opcional)
    COALESCE(
      (SELECT SUM(ga.valor) 
       FROM goal_allocations ga 
       WHERE ga.goal_id = g.id
      ), 0
    ) AS total_alocado_historico,
    
    -- Progresso baseado no saldo real das transações
    ROUND(
      (COALESCE(
        (SELECT SUM(t.valor) 
         FROM transactions t
         WHERE t.goal_id = g.id 
           AND t.account_id = get_goals_account_id(g.user_id, g.family_id)
           AND t.user_id = g.user_id
        ), 0
      ) / NULLIF(g.valor_objetivo, 0)) * 100, 2
    ) AS progresso_percentual,
    
    -- Status do objetivo baseado no progresso real
    CASE 
      WHEN g.valor_objetivo <= 0 THEN 'indefinido'
      WHEN COALESCE(
        (SELECT SUM(t.valor) 
         FROM transactions t
         WHERE t.goal_id = g.id 
           AND t.account_id = get_goals_account_id(g.user_id, g.family_id)
           AND t.user_id = g.user_id
        ), 0
      ) >= g.valor_objetivo THEN 'completo'
      WHEN COALESCE(
        (SELECT SUM(t.valor) 
         FROM transactions t
         WHERE t.goal_id = g.id 
           AND t.account_id = get_goals_account_id(g.user_id, g.family_id)
           AND t.user_id = g.user_id
        ), 0
      ) > 0 THEN 'em_progresso'
      ELSE 'nao_iniciado'
    END AS status_objetivo
    
FROM goals g
WHERE g.ativo = true;  -- Apenas objetivos ativos

-- Grant permissions
GRANT SELECT ON "public"."goal_progress" TO authenticated;
GRANT SELECT ON "public"."goal_progress" TO service_role;

-- Comentário explicativo
COMMENT ON VIEW "public"."goal_progress" IS 'View que calcula progresso dos objetivos usando transações na conta Objetivos como fonte de verdade, não goal_allocations';

-- Atualizar também a função get_user_goal_progress para usar a nova view
CREATE OR REPLACE FUNCTION public.get_user_goal_progress(user_id_param uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  nome text,
  valor_objetivo numeric,
  total_alocado_real numeric,
  total_alocado_historico numeric,
  progresso_percentual numeric,
  status_objetivo text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Usar o parâmetro fornecido ou auth.uid() como fallback
  v_user_id := COALESCE(user_id_param, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID não pode ser nulo';
  END IF;
  
  RETURN QUERY
  SELECT 
    gp.id,
    gp.nome,
    gp.valor_objetivo,
    gp.total_alocado_real,
    gp.total_alocado_historico,
    gp.progresso_percentual,
    gp.status_objetivo
  FROM goal_progress gp
  WHERE gp.user_id = v_user_id
  ORDER BY gp.progresso_percentual DESC, gp.nome ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_goal_progress TO authenticated;

-- Comentário explicativo
COMMENT ON FUNCTION public.get_user_goal_progress IS 'Retorna progresso dos objetivos usando transações como fonte de verdade. Aceita user_id opcional, usa auth.uid() por defeito para compatibilidade.';