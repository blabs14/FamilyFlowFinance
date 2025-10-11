# Esforço e riscos
- Esforço total: ~1–2h (aplicar migração, validar, smoke tests)
- Riscos: dependências de RLS, categorias em falta, dados legacy com valores < 0.01, migrações fora de ordem

# Checklist por fases

## Fase A — Preparação
- Tarefa A1: Validar versão do repo (SHA ac98402)
  - Req: 1.1
  - Dep: Git remoto atualizado
  - Estimativa: 5m
- Tarefa A2: Backup de BD (schema público)
  - Dep: acesso a Postgres
  - Estimativa: 10–15m

## Fase B — Aplicação
- Tarefa B1: Aplicar migração atual
  - Req: 1.1, 2.1, 2.2, 3.1, 6.1
  - Comando: psql -f supabase/migrations/202510100001_fix_goal_delete_restore_origins.sql
  - Estimativa: 5m
- Tarefa B2: Validar função criada
  - Req: 1.1
  - SQL: SELECT pg_get_functiondef('fn_goal_delete_with_correct_logic'::regproc);
  - Estimativa: 5m

## Fase C — Testes
- Tarefa C1: Executar testes de integração existentes
  - Req: 7.1, 7.2
  - Estimativa: 10–20m
- Tarefa C2: Adicionar/Executar teste <100% multi-origens
  - Req: 7.3
  - Estimativa: 20–30m

## Fase D — Validação em UI
- Tarefa D1: Smoke test (0€, <100%, =100%)
  - Req: 2.1, 2.2
  - Estimativa: 10–15m
- Tarefa D2: Rever logs e toasts
  - Req: 3.1
  - Estimativa: 10m

# Quality checklist
- A11y: mensagens claras, sem toasts duplicados
- Mobile e cross-browser: UI consistente
- Performance: sem operações desnecessárias
- Segurança: RLS ok, user_id/family_id corretos
- Código: commits descritivos; migrações reversíveis

# Pronto-a-implementar (sumário)
- Aplicar migração atual e validar.
- Correr testes de integração + novo teste.
- Fazer smoke test de UI e rever logs.
- Registar resultados e preparar plano de rollback para versões anteriores (se necessário).