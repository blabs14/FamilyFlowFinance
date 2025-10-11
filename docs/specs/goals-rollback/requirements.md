# Introdução
Este documento define os requisitos para recuperar rapidamente o comportamento atual e correto da eliminação de objetivos ("Goals") caso ocorra uma regressão futura. Foca-se em garantir que a base de dados e as funções PL/pgSQL fiquem exatamente no estado funcional de hoje.

## Valor de negócio
- Reduzir tempo de recuperação em caso de falha.
- Evitar perda de dados e movimentos contabilísticos incorretos.
- Assegurar consistência entre UI, API e lógica de BD.

## Escopo
- Funções: fn_goal_delete_with_correct_logic e wrapper delete_goal_with_restoration.
- Migração: supabase/migrations/202510100001_fix_goal_delete_restore_origins.sql.
- Constrangimentos: transactions_valor_min (>= 0.01), RLS, categorias "Objetivos".

# Requisitos (numeração X.Y)

## 1. Restaurar estado exato (DB e funções)
- 1.1 QUANDO for necessário recuperar o estado atual, O SISTEMA DEVERÁ reaplicar a migração <mcfile name="202510100001_fix_goal_delete_restore_origins.sql" path="supabase/migrations/202510100001_fix_goal_delete_restore_origins.sql"></mcfile> assegurando a versão de fn_goal_delete_with_correct_logic publicada no commit atual (SHA curto: ac98402).
- 1.2 ENQUANTO a função delete_goal_with_restoration existir, O SISTEMA DEVERÁ manter o encaminhamento para fn_goal_delete_with_correct_logic com idempotency_key.

## 2. Comportamento funcional
- 2.1 QUANDO o progresso do objetivo for < 100%, O SISTEMA DEVERÁ:
  - Agregar alocações por conta de origem.
  - Para cada origem, criar transação tipo "receita" com valor >= 0.01, categoria "Objetivos" do proprietário da conta.
  - Criar uma transação tipo "despesa" na conta "Objetivos" (do dono da conta) pelo total alocado (>= 0.01).
  - Remover as alocações e eliminar o objetivo.
- 2.2 QUANDO o progresso do objetivo for = 100%, O SISTEMA DEVERÁ apenas remover as alocações e eliminar o objetivo, SEM criar movimentações nas contas de origem.

## 3. Salvaguardas de valor mínimo
- 3.1 SE o valor calculado for < 0.01, ENTÃO O SISTEMA DEVERÁ não criar transação (cumprir transactions_valor_min).

## 4. Segurança e RLS
- 4.1 ENQUANTO executar a lógica, O SISTEMA DEVERÁ usar o user_id correto do proprietário das contas envolvidas (origem e "Objetivos").
- 4.2 QUANDO a categoria "Objetivos" não existir para o proprietário, O SISTEMA DEVERÁ criá-la.
- 4.3 O SISTEMA DEVERÁ respeitar RLS, RBAC e não expor segredos.

## 5. Desempenho
- 5.1 O SISTEMA DEVERÁ executar em tempo linear ao número de alocações, com agrupamento por conta (index goal_allocations.goal_id).

## 6. Idempotência
- 6.1 SE idempotency_key for fornecida, ENTÃO O SISTEMA DEVERÁ registar em idempotent_ops e devolver o resultado anterior em re-execuções.

## 7. Testes
- 7.1 O SISTEMA DEVERÁ passar: tests/integration/goals/goal-delete-100-multi-origins.spec.ts.
- 7.2 O SISTEMA DEVERÁ passar: tests/integration/goals/goal-delete-idempotency.spec.ts.
- 7.3 O SISTEMA DEVERÁ incluir teste novo para caso <100% multi-origens, validando reservas libertadas e saldos de origem.

# Aceitação (EARS)
- WHEN delete_goal(<100%) THE SYSTEM SHALL restore origin accounts with "receita" >= 0.01 and create "despesa" in "Objetivos" pelo total.
- WHEN delete_goal(=100%) THE SYSTEM SHALL delete allocations only (no origin transactions).
- IF amount < 0.01 THEN THE SYSTEM SHALL skip transaction creation.
- WHILE executing with user context THE SYSTEM SHALL respect RLS and create missing "Objetivos" category.
- ON repeated operations with same key THE SYSTEM SHALL return idempotent result.

# Edge cases
- Zero alocações; múltiplos proprietários/famílias; categorias em falta; micro-valores; chamadas repetidas; objetivos sem valor_objetivo.

# Métricas
- Sem transações < 0.01.
- Sem débitos adicionais em origens em casos =100%.
- Tempo de execução aceitável (O(n)).