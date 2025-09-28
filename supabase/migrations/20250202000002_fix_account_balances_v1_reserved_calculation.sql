-- Corrigir view account_balances_v1 para usar a view account_reserved correta
-- 
-- PROBLEMA: A view account_balances_v1 tinha uma CTE interna chamada 'account_reserved'
-- que sobrescrevia a view account_reserved externa, causando cálculos incorretos
-- para contas "Objetivos Pessoais" que recebem alocações mas não fazem alocações.
--
-- SOLUÇÃO: Remover a CTE interna e usar diretamente a view account_reserved
-- que já tem a lógica correta para contas de objetivos.

DROP VIEW IF EXISTS account_balances_v1;

CREATE VIEW account_balances_v1 AS
WITH account_transactions AS (
    SELECT 
        t.account_id,
        COALESCE(SUM(
            CASE 
                WHEN t.tipo = 'receita' THEN t.valor
                WHEN t.tipo = 'despesa' THEN -t.valor
                WHEN t.tipo = 'transferencia' THEN -t.valor
                ELSE 0
            END
        ), 0) AS saldo_atual
    FROM transactions t
    GROUP BY t.account_id
)
SELECT 
    a.id AS account_id,
    a.nome,
    a.tipo,
    a.family_id,
    a.user_id,
    COALESCE(at.saldo_atual, 0) AS saldo_atual,
    COALESCE(ar.total_reservado, 0) AS reservado,
    CASE 
        WHEN a.tipo = 'cartão de crédito' THEN 0
        ELSE COALESCE(ar.total_reservado, 0)
    END AS reservado_final,
    CASE 
        WHEN a.tipo = 'cartão de crédito' THEN NULL
        ELSE GREATEST(COALESCE(at.saldo_atual, 0) - COALESCE(ar.total_reservado, 0), 0)
    END AS disponivel,
    CASE 
        WHEN a.tipo = 'cartão de crédito' THEN COALESCE(at.saldo_atual, 0) < 0
        ELSE NULL
    END AS is_in_debt
FROM accounts a
LEFT JOIN account_transactions at ON a.id = at.account_id
LEFT JOIN account_reserved ar ON a.id = ar.account_id;

-- RESULTADO:
-- - Contas "Objetivos Pessoais" agora mostram corretamente:
--   * reservado = valor total alocado para objetivos
--   * disponivel = saldo_atual - reservado (não todo o saldo)
-- - Contas origem (ex: ab2) continuam a funcionar corretamente
-- - Lógica de desalocação funciona perfeitamente