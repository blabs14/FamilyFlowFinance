-- Correção final da função allocate_to_goal_with_transaction
-- Remove valores negativos e usa tipos de transação corretos

CREATE OR REPLACE FUNCTION public.allocate_to_goal_with_transaction(
    goal_id_param UUID,
    account_id_param UUID,
    amount_param DECIMAL,
    user_id_param UUID,
    description_param TEXT DEFAULT 'Alocação para objetivo'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal_record RECORD;
    v_account_record RECORD;
    v_amount_requested DECIMAL;
    v_transaction_id_out UUID;
    v_transaction_id_in UUID;
    v_allocation_id UUID;
    v_result JSON;
BEGIN
    -- Validação de entrada
    IF amount_param <= 0 THEN
        RAISE EXCEPTION 'O montante deve ser positivo';
    END IF;

    -- Buscar informações do objetivo
    SELECT * INTO v_goal_record
    FROM goals 
    WHERE id = goal_id_param AND user_id = user_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Objetivo não encontrado ou não pertence ao utilizador';
    END IF;

    -- Buscar informações da conta
    SELECT * INTO v_account_record
    FROM accounts 
    WHERE id = account_id_param AND user_id = user_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta não encontrada ou não pertence ao utilizador';
    END IF;

    -- Verificar se há saldo suficiente
    IF v_account_record.saldo < amount_param THEN
        RAISE EXCEPTION 'Saldo insuficiente na conta';
    END IF;

    v_amount_requested := amount_param;

    -- Iniciar transação
    BEGIN
        -- 1. Criar transação de saída da conta (DESPESA com valor positivo)
        INSERT INTO transactions (
            id,
            user_id,
            account_id,
            categoria_id,
            valor,
            tipo,
            descricao,
            data_transacao,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            user_id_param,
            account_id_param,
            NULL,
            v_amount_requested, -- VALOR POSITIVO
            'despesa', -- TIPO DESPESA
            description_param || ' (saída)',
            NOW(),
            NOW(),
            NOW()
        ) RETURNING id INTO v_transaction_id_out;

        -- 2. Atualizar saldo da conta (subtrair)
        UPDATE accounts 
        SET saldo = saldo - v_amount_requested,
            updated_at = NOW()
        WHERE id = account_id_param;

        -- 3. Criar alocação para o objetivo
        INSERT INTO goal_allocations (
            id,
            goal_id,
            user_id,
            valor,
            data_alocacao,
            descricao,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            goal_id_param,
            user_id_param,
            v_amount_requested,
            NOW(),
            description_param,
            NOW(),
            NOW()
        ) RETURNING id INTO v_allocation_id;

        -- 4. Atualizar valor atual do objetivo
        UPDATE goals 
        SET valor_atual = COALESCE(valor_atual, 0) + v_amount_requested,
            updated_at = NOW()
        WHERE id = goal_id_param;

        -- Preparar resultado
        v_result := json_build_object(
            'success', true,
            'message', 'Alocação realizada com sucesso',
            'allocation_id', v_allocation_id,
            'transaction_out_id', v_transaction_id_out,
            'amount', v_amount_requested,
            'goal_id', goal_id_param,
            'account_id', account_id_param
        );

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        -- Em caso de erro, fazer rollback automático
        RAISE EXCEPTION 'Erro na alocação: %', SQLERRM;
    END;
END;
$$;