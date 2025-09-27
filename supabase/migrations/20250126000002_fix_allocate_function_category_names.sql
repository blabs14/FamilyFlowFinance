-- Corrigir função allocate_to_goal_with_transaction para usar os novos nomes das categorias
-- Esta migração atualiza a função para criar categorias "Objetivos Pessoais" ou "Objetivos Familiares"
-- em vez da categoria genérica "Objetivos"

CREATE OR REPLACE FUNCTION public.allocate_to_goal_with_transaction(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount_requested numeric := ABS(amount_param);
  v_objetivos_account_id uuid;
  v_categoria_id uuid;
  v_transaction_id uuid;
  v_family_id uuid;
  v_goal_exists boolean := false;
  v_category_name text;
  v_result json;
BEGIN
  -- Validar parâmetros
  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;
  
  -- Verificar se o objetivo existe e buscar family_id (pode ser NULL para objetivos pessoais)
  SELECT family_id, true INTO v_family_id, v_goal_exists
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF NOT v_goal_exists THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;
  
  -- Garantir que a conta Objetivos existe (com os novos nomes)
  v_objetivos_account_id := ensure_goals_account(user_id_param, v_family_id);
  
  -- Determinar o nome da categoria baseado no tipo de objetivo
  IF v_family_id IS NULL THEN
    v_category_name := 'Objetivos Pessoais';
  ELSE
    v_category_name := 'Objetivos Familiares';
  END IF;
  
  -- Buscar ou criar a categoria com o nome apropriado
  SELECT id INTO v_categoria_id
  FROM categories
  WHERE user_id = user_id_param AND nome = v_category_name;
  
  IF v_categoria_id IS NULL THEN
    INSERT INTO categories (nome, user_id, cor, family_id)
    VALUES (v_category_name, user_id_param, '#3B82F6', v_family_id)
    RETURNING id INTO v_categoria_id;
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
    
    -- Retornar resultado
    v_result := json_build_object(
      'success', true,
      'amount_allocated', v_amount_requested,
      'transaction_id', v_transaction_id,
      'objetivos_account_id', v_objetivos_account_id,
      'category_id', v_categoria_id,
      'category_name', v_category_name,
      'family_id', v_family_id
    );
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN 
      RAISE EXCEPTION 'Erro ao alocar fundos: %', SQLERRM;
  END;
END;
$$;

-- Dar permissões à função
GRANT EXECUTE ON FUNCTION public.allocate_to_goal_with_transaction(uuid, uuid, numeric, uuid, text) TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.allocate_to_goal_with_transaction(uuid, uuid, numeric, uuid, text) IS 'Aloca fundos para um objetivo e cria as transações correspondentes (suporta objetivos pessoais e familiares com categorias apropriadas)';