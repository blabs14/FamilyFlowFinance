-- Corrigir a função fn_goal_deallocate para criar transação de despesa na conta Objetivos
-- Isto reverte a transação de receita que foi criada durante a alocação

CREATE OR REPLACE FUNCTION fn_goal_deallocate(
    goal_id_param UUID,
    account_id_param UUID,
    amount_param DECIMAL(10,2),
    user_id_param UUID,
    description_param TEXT DEFAULT 'Desalocação de objetivo',
    force_param BOOLEAN DEFAULT FALSE,
    transaction_date_param DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal_record RECORD;
    v_account_record RECORD;
    v_objetivos_account_id UUID;
    v_objetivos_balance DECIMAL(10,2);
    v_categoria_id UUID;
    v_family_id UUID;
    v_amount_to_deallocate DECIMAL(10,2);
    v_transaction_date DATE;
    v_result JSON;
    v_transaction_id UUID;
    v_objetivos_transaction_id UUID;
BEGIN
    -- Validar parâmetros
    IF goal_id_param IS NULL OR account_id_param IS NULL OR amount_param IS NULL OR user_id_param IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Parâmetros obrigatórios em falta');
    END IF;

    IF amount_param <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Valor deve ser positivo');
    END IF;

    -- Definir data da transação
    v_transaction_date := COALESCE(transaction_date_param, CURRENT_DATE);

    -- Verificar se o objetivo existe e obter informações
    SELECT g.*, g.family_id INTO v_goal_record
    FROM goals g
    WHERE g.id = goal_id_param AND g.user_id = user_id_param;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Objetivo não encontrado');
    END IF;

    v_family_id := v_goal_record.family_id;

    -- Verificar se a conta existe
    SELECT * INTO v_account_record
    FROM accounts
    WHERE id = account_id_param AND user_id = user_id_param;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Conta não encontrada');
    END IF;

    -- Verificar se há valor suficiente alocado para desalocar
    IF v_goal_record.valor_atual < amount_param AND NOT force_param THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Valor insuficiente alocado no objetivo',
            'available', v_goal_record.valor_atual,
            'requested', amount_param
        );
    END IF;

    -- Determinar o valor a desalocar (não pode ser maior que o valor atual)
    v_amount_to_deallocate := LEAST(amount_param, v_goal_record.valor_atual);

    -- Obter a conta Objetivos apropriada
    SELECT ensure_goals_account(user_id_param, v_family_id) INTO v_objetivos_account_id;

    -- Obter o saldo atual da conta Objetivos
    SELECT COALESCE(saldo_atual, 0) INTO v_objetivos_balance
    FROM account_balances
    WHERE account_id = v_objetivos_account_id;

    -- Obter categoria "Objetivos"
    SELECT id INTO v_categoria_id
    FROM categorias
    WHERE nome = 'Objetivos' AND user_id = user_id_param
    LIMIT 1;

    IF v_categoria_id IS NULL THEN
        INSERT INTO categorias (id, nome, user_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Objetivos', user_id_param, NOW(), NOW())
        RETURNING id INTO v_categoria_id;
    END IF;

    -- Iniciar transação
    BEGIN
        -- 1. Criar transação de entrada na conta de destino (RECEITA)
        INSERT INTO transactions (
            id,
            user_id,
            account_id,
            categoria_id,
            valor,
            tipo,
            descricao,
            data_transacao,
            goal_id,
            family_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            user_id_param,
            account_id_param,
            v_categoria_id,
            v_amount_to_deallocate,
            'receita',
            description_param || ' (entrada)',
            v_transaction_date,
            goal_id_param,
            v_family_id,
            NOW(),
            NOW()
        ) RETURNING id INTO v_transaction_id;

        -- 2. Criar transação de saída na conta Objetivos (DESPESA) - SEMPRE
        -- Esta transação reverte a receita que foi criada durante a alocação
        INSERT INTO transactions (
            id,
            user_id,
            account_id,
            categoria_id,
            valor,
            tipo,
            descricao,
            data_transacao,
            goal_id,
            family_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            user_id_param,
            v_objetivos_account_id,
            v_categoria_id,
            v_amount_to_deallocate,
            'despesa',
            description_param || ' (saída de Objetivos)',
            v_transaction_date,
            goal_id_param,
            v_family_id,
            NOW(),
            NOW()
        ) RETURNING id INTO v_objetivos_transaction_id;

        -- 3. Atualizar saldo da conta de destino (adicionar)
        UPDATE accounts 
        SET saldo = saldo + v_amount_to_deallocate,
            updated_at = NOW()
        WHERE id = account_id_param;

        -- 4. Reduzir valor atual do objetivo
        UPDATE goals 
        SET valor_atual = GREATEST(0, valor_atual - v_amount_to_deallocate),
            updated_at = NOW()
        WHERE id = goal_id_param;

        -- 5. Criar registo de desalocação
        INSERT INTO goal_allocations (
            id,
            goal_id,
            user_id,
            valor,
            data_alocacao,
            descricao,
            account_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            goal_id_param,
            user_id_param,
            -v_amount_to_deallocate, -- Valor negativo para indicar desalocação
            v_transaction_date,
            description_param,
            account_id_param,
            NOW(),
            NOW()
        );

        -- Preparar resultado
        v_result := json_build_object(
            'success', true,
            'message', 'Desalocação realizada com sucesso',
            'amount_deallocated', v_amount_to_deallocate,
            'transaction_id', v_transaction_id,
            'objetivos_transaction_id', v_objetivos_transaction_id,
            'goal_id', goal_id_param,
            'account_id', account_id_param,
            'objetivos_account_id', v_objetivos_account_id,
            'objetivos_balance_before', v_objetivos_balance,
            'note', 'Transação criada na conta Objetivos para reverter alocação'
        );

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        -- Em caso de erro, fazer rollback automático
        RAISE EXCEPTION 'Erro na desalocação: %', SQLERRM;
    END;
END;
$$;