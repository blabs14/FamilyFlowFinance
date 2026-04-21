-- Migração para atualizar os nomes das contas de objetivos
-- Contas pessoais: "Objetivos Pessoais"
-- Contas familiares: "Objetivos Familiares"

-- Primeiro, atualizar contas existentes
UPDATE accounts 
SET nome = 'Objetivos Pessoais'
WHERE (LOWER(nome) LIKE '%objetivo%' OR LOWER(tipo) LIKE '%objetivo%')
  AND family_id IS NULL;

UPDATE accounts 
SET nome = 'Objetivos Familiares'
WHERE (LOWER(nome) LIKE '%objetivo%' OR LOWER(tipo) LIKE '%objetivo%')
  AND family_id IS NOT NULL;

-- Atualizar a função ensure_goals_account para usar nomes específicos
CREATE OR REPLACE FUNCTION ensure_goals_account(p_user_id UUID DEFAULT NULL, p_family_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_account_name TEXT;
BEGIN
  -- Usar o user_id fornecido ou o utilizador autenticado
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilizador não autenticado';
  END IF;
  
  -- Determinar o nome da conta baseado no tipo (pessoal vs familiar)
  IF p_family_id IS NULL THEN
    v_account_name := 'Objetivos Pessoais';
  ELSE
    v_account_name := 'Objetivos Familiares';
  END IF;
  
  -- Verificar se já existe uma conta Objetivos
  SELECT id INTO v_account_id
  FROM accounts
  WHERE user_id = v_user_id
    AND family_id IS NOT DISTINCT FROM p_family_id
    AND (LOWER(nome) LIKE '%objetivo%' OR LOWER(tipo) LIKE '%objetivo%')
  LIMIT 1;
  
  -- Se não existe, criar a conta
  IF v_account_id IS NULL THEN
    INSERT INTO accounts (
      user_id,
      family_id,
      nome,
      tipo,
      saldo,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_family_id,
      v_account_name,
      'poupança',
      0,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_account_id;
  ELSE
    -- Se existe mas tem nome antigo, atualizar para o novo nome
    UPDATE accounts 
    SET nome = v_account_name, updated_at = NOW()
    WHERE id = v_account_id 
      AND nome != v_account_name;
  END IF;
  
  RETURN v_account_id;
END;
$$;

-- Atualizar comentário da função
COMMENT ON FUNCTION ensure_goals_account(UUID, UUID) IS 'Garante que existe uma conta Objetivos para o utilizador/família especificado. Cria "Objetivos Pessoais" para contas pessoais e "Objetivos Familiares" para contas familiares.';