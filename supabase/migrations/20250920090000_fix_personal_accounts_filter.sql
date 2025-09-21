-- Corrigir RPC get_user_accounts_with_balances para excluir contas familiares da listagem pessoal
-- Segurança: SECURITY DEFINER + validação de auth.uid()
-- Reversível: pode voltar ao estado anterior recriando versão anterior da função

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_user_accounts_with_balances'
  ) THEN
    DROP FUNCTION IF EXISTS public.get_user_accounts_with_balances(uuid);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_user_accounts_with_balances(
  p_user_id uuid
) RETURNS TABLE (
  account_id uuid,
  user_id uuid,
  family_id uuid,
  nome text,
  tipo text,
  saldo_atual numeric,
  total_reservado numeric,
  saldo_disponivel numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Autorização: apenas o próprio utilizador pode consultar
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH a AS (
    SELECT id, user_id, family_id, nome, tipo
    FROM public.accounts
    WHERE user_id = p_user_id
      AND family_id IS NULL -- filtro essencial para separar contas pessoais
  ), tx AS (
    SELECT account_id,
           COALESCE(SUM(CASE WHEN t.tipo = 'receita' THEN t.valor
                              WHEN t.tipo = 'despesa' THEN -t.valor
                              ELSE 0 END), 0) AS saldo
    FROM public.transactions t
    WHERE t.user_id = p_user_id
    GROUP BY account_id
  )
  SELECT a.id AS account_id,
         a.user_id,
         a.family_id,
         a.nome,
         a.tipo,
         COALESCE(tx.saldo, 0) AS saldo_atual,
         0::numeric AS total_reservado,
         COALESCE(tx.saldo, 0) AS saldo_disponivel
  FROM a
  LEFT JOIN tx ON tx.account_id = a.id
  ORDER BY a.nome;
END; $$;

REVOKE ALL ON FUNCTION public.get_user_accounts_with_balances(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_accounts_with_balances(uuid) TO authenticated, service_role;