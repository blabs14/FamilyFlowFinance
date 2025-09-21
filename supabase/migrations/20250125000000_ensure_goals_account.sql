-- Função para garantir que a conta "Objetivos" existe para um utilizador
CREATE OR REPLACE FUNCTION ensure_goals_account(p_user_id UUID DEFAULT NULL, p_family_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  v_account_name TEXT := 'Objetivos';
BEGIN
  -- Usar o user_id fornecido ou o utilizador autenticado
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilizador não autenticado';
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
  END IF;
  
  RETURN v_account_id;
END;
$$;

-- Trigger para criar automaticamente a conta Objetivos quando um objetivo é criado
CREATE OR REPLACE FUNCTION handle_goal_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goals_account_id UUID;
BEGIN
  -- Garantir que a conta Objetivos existe
  v_goals_account_id := ensure_goals_account(NEW.user_id, NEW.family_id);
  
  RETURN NEW;
END;
$$;

-- Criar o trigger se não existir
DROP TRIGGER IF EXISTS on_goal_created ON goals;
CREATE TRIGGER on_goal_created
  AFTER INSERT ON goals
  FOR EACH ROW
  EXECUTE FUNCTION handle_goal_creation();

-- Comentários
COMMENT ON FUNCTION ensure_goals_account(UUID, UUID) IS 'Garante que existe uma conta Objetivos para o utilizador/família especificado';
COMMENT ON FUNCTION handle_goal_creation() IS 'Trigger que cria automaticamente a conta Objetivos quando um objetivo é criado';