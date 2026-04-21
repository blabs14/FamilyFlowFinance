-- Migração para atualizar a lógica de busca de contas objetivos
-- Atualizar todas as funções para reconhecer "Objetivos Pessoais" e "Objetivos Familiares"

-- 1. Atualizar função get_personal_financial_summary
CREATE OR REPLACE FUNCTION public.get_personal_financial_summary(user_id_param uuid)
RETURNS TABLE(total_saldo_contas numeric, total_reservado_objetivos numeric, total_saldo_disponivel numeric, total_contas bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    total_goals_val numeric := 0;
    goals_progress numeric := 0;
BEGIN
    -- Query 1: Calcular saldo total das contas pessoais
    SELECT 
        COALESCE(SUM(saldo), 0),
        COUNT(*)
    INTO total_saldo_contas, total_contas
    FROM accounts 
    WHERE user_id = user_id_param 
    AND family_id IS NULL;

    -- Query 2: Calcular objetivos (otimizada)
    SELECT 
        COALESCE(SUM(valor_objetivo), 0),
        COALESCE(SUM(valor_atual), 0)
    INTO total_goals_val, total_reservado_objetivos
    FROM goals g
    JOIN accounts a ON a.user_id = user_id_param 
    AND a.family_id IS NULL
    AND (a.nome = 'Objetivos Pessoais' OR LOWER(a.tipo) LIKE '%objetivo%')
    WHERE g.user_id = user_id_param 
    AND g.family_id IS NULL
    AND g.ativa = true;

    -- Calcular percentagem de progresso dos objetivos
    IF total_goals_val > 0 THEN
        goals_progress := (total_reservado_objetivos / total_goals_val) * 100;
    END IF;

    -- Query 3: Calcular progresso do objetivo principal
    total_saldo_disponivel := COALESCE(
        ((total_reservado_objetivos / NULLIF(total_goals_val, 0)) * 100), 0
    );

    RETURN QUERY SELECT 
        total_saldo_contas,
        total_reservado_objetivos,
        total_saldo_disponivel,
        total_contas;
END;
$$;

-- 2. Atualizar função get_family_financial_summary
CREATE OR REPLACE FUNCTION public.get_family_financial_summary(user_id_param uuid, family_id_param uuid)
RETURNS TABLE(total_saldo_contas numeric, total_reservado_objetivos numeric, total_saldo_disponivel numeric, total_contas bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    total_goals_val numeric := 0;
    goals_progress numeric := 0;
BEGIN
    -- Calculate total account balance for family
    SELECT 
        COALESCE(SUM(saldo), 0),
        COUNT(*)
    INTO total_saldo_contas, total_contas
    FROM accounts 
    WHERE family_id = family_id_param;

    -- Calculate goals account balance for family (find account named 'Objetivos Familiares' or with type 'objetivo')
    SELECT COALESCE(SUM(saldo), 0) INTO total_reservado_objetivos
    FROM accounts 
    WHERE family_id = family_id_param
    AND (nome = 'Objetivos Familiares' OR LOWER(tipo) LIKE '%objetivo%');

    SELECT COALESCE(SUM(valor_objetivo), 0) INTO total_goals_val
    FROM goals 
    WHERE family_id = family_id_param 
    AND ativa = true;

    -- Calculate progress percentage
    IF total_goals_val > 0 THEN
        goals_progress := (total_reservado_objetivos / total_goals_val) * 100;
    END IF;

    total_saldo_disponivel := COALESCE(
        ((total_reservado_objetivos / NULLIF(total_goals_val, 0)) * 100), 0
    );

    RETURN QUERY SELECT 
        total_saldo_contas,
        total_reservado_objetivos,
        total_saldo_disponivel,
        total_contas;
END;
$$;

-- 3. Atualizar função get_dashboard_data
CREATE OR REPLACE FUNCTION public.get_dashboard_data(user_id_param uuid)
RETURNS TABLE(total_saldo_contas numeric, total_reservado_objetivos numeric, total_saldo_disponivel numeric, total_contas bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    total_goals_val numeric := 0;
    goals_progress numeric := 0;
BEGIN
    -- Calculate total account balance (find account named 'Objetivos Pessoais' or with type 'objetivo')
    SELECT 
        COALESCE(SUM(saldo), 0),
        COUNT(*)
    INTO total_saldo_contas, total_contas
    FROM accounts 
    WHERE user_id = user_id_param;

    -- Calculate goals account balance (find account named 'Objetivos Pessoais' or with type 'objetivo')
    SELECT COALESCE(SUM(saldo), 0) INTO total_reservado_objetivos
    FROM accounts 
    WHERE user_id = user_id_param
    AND (nome = 'Objetivos Pessoais' OR LOWER(tipo) LIKE '%objetivo%');

    SELECT COALESCE(SUM(valor_objetivo), 0) INTO total_goals_val
    FROM goals 
    WHERE user_id = user_id_param 
    AND ativa = true;

    -- Calculate progress percentage
    IF total_goals_val > 0 THEN
        goals_progress := (total_reservado_objetivos / total_goals_val) * 100;
    END IF;

    total_saldo_disponivel := COALESCE(
        ((total_reservado_objetivos / NULLIF(total_goals_val, 0)) * 100), 0
    );

    RETURN QUERY SELECT 
        total_saldo_contas,
        total_reservado_objetivos,
        total_saldo_disponivel,
        total_contas;
END;
$$;

-- 4. Atualizar função get_dashboard_data_v2
CREATE OR REPLACE FUNCTION public.get_dashboard_data_v2(user_id_param uuid)
RETURNS TABLE(total_saldo_contas numeric, total_reservado_objetivos numeric, total_saldo_disponivel numeric, total_contas bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    total_goals_val numeric := 0;
    goals_progress numeric := 0;
BEGIN
    -- Calculate total account balance (find account named 'Objetivos Pessoais' or with type 'objetivo')
    SELECT 
        COALESCE(SUM(saldo), 0),
        COUNT(*)
    INTO total_saldo_contas, total_contas
    FROM accounts 
    WHERE user_id = user_id_param;

    -- Calculate goals account balance (find account named 'Objetivos Pessoais' or with type 'objetivo')
    SELECT COALESCE(SUM(saldo), 0) INTO total_reservado_objetivos
    FROM accounts 
    WHERE user_id = user_id_param
    AND (nome = 'Objetivos Pessoais' OR LOWER(tipo) LIKE '%objetivo%');

    SELECT COALESCE(SUM(valor_objetivo), 0) INTO total_goals_val
    FROM goals 
    WHERE user_id = user_id_param 
    AND ativa = true;

    -- Calculate progress percentage
    IF total_goals_val > 0 THEN
        goals_progress := (total_reservado_objetivos / total_goals_val) * 100;
    END IF;

    total_saldo_disponivel := COALESCE(
        ((total_reservado_objetivos / NULLIF(total_goals_val, 0)) * 100), 0
    );

    RETURN QUERY SELECT 
        total_saldo_contas,
        total_reservado_objetivos,
        total_saldo_disponivel,
        total_contas;
END;
$$;

-- 5. Atualizar função get_dashboard_data_v3
CREATE OR REPLACE FUNCTION public.get_dashboard_data_v3(user_id_param uuid)
RETURNS TABLE(total_saldo_contas numeric, total_reservado_objetivos numeric, total_saldo_disponivel numeric, total_contas bigint)
LANGUAGE plpgsql
AS $$
DECLARE
    total_goals_val numeric := 0;
    goals_progress numeric := 0;
BEGIN
    -- Calculate total account balance (find account named 'Objetivos Pessoais' or with type 'objetivo')
    SELECT 
        COALESCE(SUM(saldo), 0),
        COUNT(*)
    INTO total_saldo_contas, total_contas
    FROM accounts 
    WHERE user_id = user_id_param;

    -- Calculate goals account balance (find account named 'Objetivos Pessoais' or with type 'objetivo')
    SELECT COALESCE(SUM(saldo), 0) INTO total_reservado_objetivos
    FROM accounts 
    WHERE user_id = user_id_param
    AND (nome = 'Objetivos Pessoais' OR LOWER(tipo) LIKE '%objetivo%');

    SELECT COALESCE(SUM(valor_objetivo), 0) INTO total_goals_val
    FROM goals 
    WHERE user_id = user_id_param 
    AND ativa = true;

    -- Calculate progress percentage
    IF total_goals_val > 0 THEN
        goals_progress := (total_reservado_objetivos / total_goals_val) * 100;
    END IF;

    total_saldo_disponivel := COALESCE(
        ((total_reservado_objetivos / NULLIF(total_goals_val, 0)) * 100), 0
    );

    RETURN QUERY SELECT 
        total_saldo_contas,
        total_reservado_objetivos,
        total_saldo_disponivel,
        total_contas;
END;
$$;

-- Comentários das funções atualizadas
COMMENT ON FUNCTION public.get_personal_financial_summary(uuid) IS 'Retorna resumo financeiro pessoal com busca atualizada para "Objetivos Pessoais"';
COMMENT ON FUNCTION public.get_family_financial_summary(uuid, uuid) IS 'Retorna resumo financeiro familiar com busca atualizada para "Objetivos Familiares"';
COMMENT ON FUNCTION public.get_dashboard_data(uuid) IS 'Retorna dados do dashboard com busca atualizada para "Objetivos Pessoais"';
COMMENT ON FUNCTION public.get_dashboard_data_v2(uuid) IS 'Retorna dados do dashboard v2 com busca atualizada para "Objetivos Pessoais"';
COMMENT ON FUNCTION public.get_dashboard_data_v3(uuid) IS 'Retorna dados do dashboard v3 com busca atualizada para "Objetivos Pessoais"';