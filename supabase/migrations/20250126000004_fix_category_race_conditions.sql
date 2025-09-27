-- Corrigir race conditions em funções que criam categorias

-- 1. Corrigir função normalize_account_balances
CREATE OR REPLACE FUNCTION public.normalize_account_balances()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  _cat uuid;
BEGIN
  FOR r IN 
    SELECT id, user_id, saldo, nome
    FROM public.accounts
    WHERE saldo != 0
  LOOP
    
    -- Garantir categoria "Ajuste" para o utilizador usando ON CONFLICT
    INSERT INTO public.categories (nome, cor, user_id)
    VALUES ('Ajuste', '#6B7280', r.user_id)
    ON CONFLICT (nome, user_id, COALESCE(family_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO _cat;

    -- Se não conseguiu obter o ID, buscar manualmente
    IF _cat IS NULL THEN
      SELECT id INTO _cat
      FROM public.categories
      WHERE user_id = r.user_id AND nome = 'Ajuste'
      LIMIT 1;
    END IF;

    -- Criar transação de ajuste inicial
    INSERT INTO public.transactions (
      account_id, user_id, categoria_id, valor, tipo, data, descricao
    ) VALUES (
      r.id,
      r.user_id,
      _cat,
      ABS(r.saldo),
      CASE WHEN r.saldo > 0 THEN 'receita' ELSE 'despesa' END,
      CURRENT_DATE,
      'Ajuste Inicial (normalização de saldo)'
    );

    -- Zerar o saldo da conta
    UPDATE public.accounts 
    SET saldo = 0, updated_at = NOW()
    WHERE id = r.id;

    RAISE NOTICE 'Conta % normalizada: saldo % -> 0', r.nome, r.saldo;
  END LOOP;
END;
$$;

-- 2. Corrigir função set_account_balance
CREATE OR REPLACE FUNCTION public.set_account_balance(
  p_account_id uuid,
  p_new_balance numeric,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_balance numeric;
  _diff numeric;
  _cat uuid;
BEGIN
  -- Obter saldo atual
  SELECT saldo INTO _current_balance
  FROM public.accounts
  WHERE id = p_account_id AND user_id = p_user_id;

  IF _current_balance IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada ou sem permissão';
  END IF;

  _diff := p_new_balance - _current_balance;

  IF _diff = 0 THEN
    RETURN; -- Nada a fazer
  END IF;

  -- Garantir categoria "Ajuste" existe usando ON CONFLICT
  INSERT INTO public.categories (nome, cor, user_id)
  VALUES ('Ajuste', '#6B7280', p_user_id)
  ON CONFLICT (nome, user_id, COALESCE(family_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO _cat;

  -- Se não conseguiu obter o ID, buscar manualmente
  IF _cat IS NULL THEN
    SELECT id INTO _cat 
    FROM public.categories 
    WHERE user_id = p_user_id AND nome = 'Ajuste' 
    LIMIT 1;
  END IF;

  -- Criar transação de ajuste para atingir o novo saldo
  INSERT INTO public.transactions (
    account_id, user_id, categoria_id, valor, tipo, data, descricao
  ) VALUES (
    p_account_id,
    p_user_id,
    _cat,
    ABS(_diff),
    CASE WHEN _diff > 0 THEN 'receita' ELSE 'despesa' END,
    CURRENT_DATE,
    'Ajuste de saldo'
  );

  -- Atualizar saldo da conta
  UPDATE public.accounts
  SET saldo = p_new_balance, updated_at = NOW()
  WHERE id = p_account_id;

END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.normalize_account_balances() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_account_balance(uuid, numeric, uuid) TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.normalize_account_balances() IS 'Normaliza saldos de contas criando transações de ajuste (evita race conditions)';
COMMENT ON FUNCTION public.set_account_balance(uuid, numeric, uuid) IS 'Define saldo de uma conta criando transação de ajuste (evita race conditions)';