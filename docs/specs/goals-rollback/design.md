# Visão geral
Runbook técnico para recuperar e garantir o estado atual e correto da eliminação de objetivos.

## Componentes e limites
- Função principal: fn_goal_delete_with_correct_logic
- Wrapper: delete_goal_with_restoration (encaminha idempotency_key)
- Auxiliar relacionada: fn_goal_deallocate (não cria transações na origem)
- Tabelas: goals, goal_allocations, accounts, transactions, categories, idempotent_ops

## Migração relevante
- Ficheiro: <mcfile name="202510100001_fix_goal_delete_restore_origins.sql" path="supabase/migrations/202510100001_fix_goal_delete_restore_origins.sql"></mcfile>
- Conteúdo: recria fn_goal_delete_with_correct_logic conforme comportamento atual.

## Modelo de dados (resumo)
- goal_allocations(goal_id, account_id, valor)
- transactions(account_id, categoria_id, valor >= 0.01, tipo ['receita','despesa'], data, user_id, family_id)
- categories(nome='Objetivos', user_id, family_id)
- idempotent_ops(operation_key, user_id, operation_type, result)

## Contratos/RPC
- delete_goal_with_restoration(goal_id: uuid, destination_account_id?: uuid, idempotency_key?: text) -> json
- fn_goal_delete_with_correct_logic(goal_id: uuid, user_id: uuid, destination_account_id?: uuid, idempotency_key?: text) -> json

## Estratégia de erros/UX
- Lançar "Erro ao eliminar objetivo: <detalhe>" em exceções SQL.
- Não criar transações com valor < 0.01.
- Mensagens descritivas em result.json.

## Testes
- Integração: goal-delete-100-multi-origins, goal-delete-idempotency.
- Novo teste: caso <100% com várias origens; validar receitas por origem e despesa em "Objetivos".

## Performance
- Agrupar alocações por account_id.
- Índices: goal_allocations(goal_id), transactions(account_id), categories(user_id,nome).

## Segurança
- RLS via user_id e family_id corretos.
- Categorias "Objetivos" criadas com o owner da conta.
- Idempotência registada em idempotent_ops.

## Passos de recuperação (executáveis)
1) Garantir versão de código
- git checkout ac98402 (ou branch main atualizado)

2) Backup de BD (antes de aplicar)
- pg_dump (ou ferramenta preferida) do schema público

3) Aplicar migração
- psql -f supabase/migrations/202510100001_fix_goal_delete_restore_origins.sql
  (ou usar CLI que já utilizas para aplicar migrações)

4) Verificar função
- SELECT proname FROM pg_proc WHERE proname = 'fn_goal_delete_with_correct_logic';
- Opcional: DESCRIBE via pg_get_functiondef para confirmar assinatura

5) Fumo de UI
- Eliminar objetivos: 0€, <100%, =100%; observar toasts e movimentos

6) Logs e métricas
- Console/Network do browser; confirmar ausência de transações < 0.01 e duplicações

## Reversibilidade
- Se precisares reverter para a versão anterior, reaplica a migração antiga correspondente (ex.: 202510090003_update_fn_goal_delete_use_operation_key.sql) que mantinha a lógica sem receitas nas origens (<100%). Documenta o SHA e aplica psql -f sobre essa migração.

## Notas operacionais
- Executar em transação curta; evitar locks prolongados.
- Idempotency_key recomendada na UI para operações repetidas.