-- Corrigir função allocate_to_goal_with_transaction para evitar erro de chave duplicada
CREATE OR REPLACE FUNCTION public.allocate_to_goal_with_transaction(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT 'Alocação para objetivo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount_requested numeric;
  v_account_balance numeric;
  v_objetivos_account_id uuid;
  v_categoria_id uuid;
  v_transaction_id uuid;
  v_family_id uuid;
  v_goal_type text;
  v_category_name text;
BEGIN
  -- Validar parâmetros
  IF goal_id_param IS NULL OR account_id_param IS NULL OR amount_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios não fornecidos';
  END IF;

  v_amount_requested := amount_param;

  -- Verificar se o valor é positivo
  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'O valor deve ser positivo';
  END IF;

  -- Verificar saldo da conta
  SELECT saldo, family_id INTO v_account_balance, v_family_id
  FROM accounts
  WHERE id = account_id_param AND user_id = user_id_param;

  IF v_account_balance IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF v_account_balance < v_amount_requested THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta';
  END IF;

  -- Buscar o tipo do objetivo e family_id
  SELECT tipo, family_id INTO v_goal_type, v_family_id
  FROM goals
  WHERE id = goal_id_param AND user_id = user_id_param;

  IF v_goal_type IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;

  -- Garantir que a conta "Objetivos" existe
  v_objetivos_account_id := ensure_goals_account(user_id_param, v_family_id);

  -- Determinar o nome da categoria baseado no tipo do objetivo
  IF v_goal_type = 'pessoal' THEN
    v_category_name := 'Objetivos Pessoais';
  ELSIF v_goal_type = 'familiar' THEN
    v_category_name := 'Objetivos Familiares';
  ELSE
    v_category_name := 'Objetivos Pessoais'; -- Default para compatibilidade
  END IF;

  -- Buscar ou criar a categoria com o nome apropriado usando ON CONFLICT
  INSERT INTO categories (nome, user_id, cor, family_id)
  VALUES (v_category_name, user_id_param, '#3B82F6', v_family_id)
  ON CONFLICT (nome, user_id, COALESCE(family_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_categoria_id;

  -- Se não conseguiu obter o ID da categoria, buscar manualmente
  IF v_categoria_id IS NULL THEN
    SELECT id INTO v_categoria_id
    FROM categories
    WHERE user_id = user_id_param 
      AND nome = v_category_name
      AND family_id IS NOT DISTINCT FROM v_family_id;
  END IF;

  -- Iniciar transação
  BEGIN
    -- 1. Deduzir valor da conta de origem
    UPDATE accounts 
    SET saldo = saldo - v_amount_requested,
        updated_at = NOW()
    WHERE id = account_id_param;

    -- 2. Adicionar valor à conta "Objetivos"
    UPDATE accounts 
    SET saldo = saldo + v_amount_requested,
        updated_at = NOW()
    WHERE id = v_objetivos_account_id;

    -- 3. Criar a alocação
    INSERT INTO goal_allocations (
      goal_id,
      account_id,
      valor,
      user_id,
      data_alocacao
    ) VALUES (
      goal_id_param,
      account_id_param,
      v_amount_requested,
      user_id_param,
      NOW()
    );

    -- 4. Criar transação de débito na conta de origem
    INSERT INTO transactions (
      account_id,
      valor,
      descricao,
      categoria_id,
      user_id,
      data_transacao,
      tipo
    ) VALUES (
      account_id_param,
      -v_amount_requested,
      COALESCE(description_param, 'Alocação para objetivo'),
      v_categoria_id,
      user_id_param,
      NOW(),
      'despesa'
    ) RETURNING id INTO v_transaction_id;

    -- 5. Criar transação de crédito na conta Objetivos
    INSERT INTO transactions (
      account_id,
      valor,
      descricao,
      categoria_id,
      user_id,
      data_transacao,
      tipo
    ) VALUES (
      v_objetivos_account_id,
      v_amount_requested,
      COALESCE(description_param, 'Alocação para objetivo'),
      v_categoria_id,
      user_id_param,
      NOW(),
      'receita'
    );

    -- Retornar resultado de sucesso
    RETURN json_build_object(
      'success', true,
      'amount_allocated', v_amount_requested,
      'transaction_id', v_transaction_id,
      'objetivos_account_id', v_objetivos_account_id,
      'categoria_id', v_categoria_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Erro na transação: %', SQLERRM;
  END;

EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Erro ao alocar para objetivo: %', SQLERRM;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.allocate_to_goal_with_transaction(uuid, uuid, numeric, uuid, text) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.allocate_to_goal_with_transaction(uuid, uuid, numeric, uuid, text) IS 'Aloca fundos para um objetivo e cria as transações correspondentes (suporta objetivos pessoais e familiares com categorias apropriadas, evita duplicatas)';