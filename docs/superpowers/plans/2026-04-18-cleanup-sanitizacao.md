# Cleanup e Sanitização — FamilyFlowFinance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Limpar o projeto de código morto, branches obsoletas e vulnerabilidades de segurança identificadas na auditoria de 2026-04-17.

**Architecture:** Duas passagens — Pass 1 corrige vulnerabilidades de segurança reais na DB via migrations; Pass 2 remove dead code, tabelas não utilizadas e branches obsoletas.

**Tech Stack:** PostgreSQL 17 (Supabase), React + Vite, TypeScript

---

## PASS 1 — SEGURANÇA

### Task 1: RLS em `deletion_tokens`

**Problema:** Tabela pública com coluna `token` exposta sem RLS. Qualquer utilizador anónimo pode ler tokens de eliminação de conta de outros utilizadores.

**Estrutura da tabela:** `id (uuid), user_id (uuid), token (text), expires_at (timestamptz), created_at (timestamptz)`

**Files:**
- Create: `supabase/migrations/20260418100000_rls_deletion_tokens.sql`

- [ ] **Step 1: Criar migration**

```sql
-- Activar RLS
ALTER TABLE public.deletion_tokens ENABLE ROW LEVEL SECURITY;

-- Utilizador só vê/cria os seus próprios tokens
CREATE POLICY "deletion_tokens_owner_select"
  ON public.deletion_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "deletion_tokens_owner_insert"
  ON public.deletion_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Só o service role pode apagar (processo de eliminação de conta)
CREATE POLICY "deletion_tokens_owner_delete"
  ON public.deletion_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar via MCP `apply_migration`**

  name: `rls_deletion_tokens`

- [ ] **Step 3: Verificar no Supabase que RLS está activo**

```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname = 'deletion_tokens';
```

  Expected: `relrowsecurity = true`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418100000_rls_deletion_tokens.sql
git commit -m "fix(security): activar RLS na tabela deletion_tokens"
```

---

### Task 2: Views SECURITY DEFINER → SECURITY INVOKER

**Problema:** 7 views criadas com SECURITY DEFINER executam com permissões do criador (superuser), ignorando as políticas RLS do utilizador que consulta. Um utilizador autenticado poderia ver dados de outros utilizadores.

**Views afectadas:**
- `account_balances` — agrega transações por conta (sem filtro de user na view)
- `account_balances_v1` — versão mais completa do mesmo
- `budget_progress` — progresso de orçamentos por utilizador
- `goal_progress` — progresso de objectivos
- `account_reserved` — valores reservados em contas
- `v_ingestion_job_summary` — sumário de jobs de importação
- `_rr_rules_for_user` — regras de recorrência (já filtra por auth.uid())

**Fix:** `ALTER VIEW view_name SET (security_invoker = true);` (disponível em PostgreSQL 15+)

**Files:**
- Create: `supabase/migrations/20260418110000_views_security_invoker.sql`

- [ ] **Step 1: Criar migration**

```sql
ALTER VIEW public.account_balances SET (security_invoker = true);
ALTER VIEW public.account_balances_v1 SET (security_invoker = true);
ALTER VIEW public.budget_progress SET (security_invoker = true);
ALTER VIEW public.goal_progress SET (security_invoker = true);
ALTER VIEW public.account_reserved SET (security_invoker = true);
ALTER VIEW public.v_ingestion_job_summary SET (security_invoker = true);
ALTER VIEW public._rr_rules_for_user SET (security_invoker = true);
```

- [ ] **Step 2: Aplicar via MCP `apply_migration`**

  name: `views_security_invoker`

- [ ] **Step 3: Verificar**

```sql
SELECT viewname, security_invoker
FROM pg_views
JOIN pg_class ON relname = viewname
WHERE schemaname = 'public'
  AND viewname IN ('account_balances','account_balances_v1','budget_progress',
                   'goal_progress','account_reserved','v_ingestion_job_summary',
                   '_rr_rules_for_user');
```

- [ ] **Step 4: Testar que a app ainda funciona** — abrir o dashboard, verificar que saldos e orçamentos carregam.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260418110000_views_security_invoker.sql
git commit -m "fix(security): converter views SECURITY DEFINER para SECURITY INVOKER"
```

---

### Task 3: Mutable search_path nas funções RLS críticas

**Problema:** Funções de segurança (usadas em políticas RLS) sem `search_path` fixo. Um atacante com permissão de criar schemas poderia criar funções homónimas em outro schema e hijack as políticas RLS.

**Funções prioritárias** (usadas directamente em políticas RLS):
- `_is_personal_context`
- `_is_family_context`
- `is_family_non_viewer`
- `get_current_user_id`
- `allocate_to_goal_with_transaction`
- `deallocate_from_goal_with_transaction`
- `delete_goal_with_restoration`
- `fn_goal_deallocate`
- `fn_goal_delete_with_correct_logic`

**Files:**
- Create: `supabase/migrations/20260418120000_fix_search_path_rls_functions.sql`

- [ ] **Step 1: Criar migration**

```sql
ALTER FUNCTION public._is_personal_context() SET search_path = public;
ALTER FUNCTION public._is_family_context() SET search_path = public;
ALTER FUNCTION public.is_family_non_viewer(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.get_current_user_id() SET search_path = public;
ALTER FUNCTION public.allocate_to_goal_with_transaction(uuid, uuid, numeric, text) SET search_path = public;
ALTER FUNCTION public.deallocate_from_goal_with_transaction(uuid, uuid, numeric, text) SET search_path = public;
ALTER FUNCTION public.delete_goal_with_restoration(uuid) SET search_path = public;
ALTER FUNCTION public.fn_goal_deallocate(uuid, uuid, numeric, text) SET search_path = public;
```

> **Nota:** Obter as assinaturas exactas com:
> ```sql
> SELECT p.proname, pg_get_function_identity_arguments(p.oid)
> FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
> WHERE n.nspname = 'public' AND p.proname IN (
>   '_is_personal_context','_is_family_context','is_family_non_viewer',
>   'get_current_user_id','allocate_to_goal_with_transaction',
>   'deallocate_from_goal_with_transaction','delete_goal_with_restoration',
>   'fn_goal_deallocate'
> );
> ```

- [ ] **Step 2: Aplicar via MCP `apply_migration`**

  name: `fix_search_path_rls_functions`

- [ ] **Step 3: Verificar que as funções têm search_path**

```sql
SELECT p.proname, p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('_is_personal_context','_is_family_context','is_family_non_viewer','get_current_user_id')
ORDER BY p.proname;
```

  Expected: `proconfig` contém `search_path=public`

- [ ] **Step 4: Correr testes**

```bash
npm run test -- --run
```

  Expected: 309 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260418120000_fix_search_path_rls_functions.sql
git commit -m "fix(security): fixar search_path nas funções RLS críticas"
```

---

### Task 4: Passos manuais no Dashboard Supabase *(não automatizáveis)*

- [ ] **Activar Leaked Password Protection**
  - Dashboard → Authentication → Providers → Email → activar "Check for leaked passwords (HaveIBeenPwned)"

- [ ] **Actualizar PostgreSQL**
  - Dashboard → Project Settings → Infrastructure → Upgrade disponível → seguir wizard
  - ⚠️ Causa downtime de ~2 minutos. Fazer em horário off-peak.

---

## PASS 2 — CÓDIGO E SCHEMA

### Task 5: Apagar ficheiros e branches obsoletas

**Files:**
- Delete: `src/components/CreditCardForm.tsx.backup`

- [ ] **Step 1: Apagar ficheiro de backup**

```bash
rm src/components/CreditCardForm.tsx.backup
```

- [ ] **Step 2: Apagar branches remotas obsoletas**

Branches a apagar (stale, nunca mergeadas ou já mergeadas):
```bash
git push origin --delete docs/rollback-goals-runbook
git push origin --delete chore/auth-hardening-authcontext-case-fix
git push origin --delete cursor/progressive-type-safety-and-linting-improvements-a088
git push origin --delete feature/sistema-feriados
git push origin --delete feature/standardize-naming
```

> ⚠️ `chore/auth-context-case-hardening-clean` tem PR #11 aberto — ver Task 8.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remover ficheiro de backup e branches remotas obsoletas"
```

---

### Task 6: Remover dead code da base de dados

**Identificado:**
- `idempotent_operations` — tabela com jsonb não usada no código (usa-se `idempotent_ops`)
- `get_dashboard_data_v2` e `get_dashboard_data_v3` — funções duplicadas não referenciadas

**Files:**
- Create: `supabase/migrations/20260418130000_drop_dead_db_code.sql`

- [ ] **Step 1: Confirmar que não são usadas**

```sql
-- Verificar se há chamadas recentes
SELECT query, calls, last_call
FROM pg_stat_statements
WHERE query ILIKE '%idempotent_operations%'
   OR query ILIKE '%get_dashboard_data_v2%'
   OR query ILIKE '%get_dashboard_data_v3%'
LIMIT 10;
```

  Se sem resultados, prosseguir.

- [ ] **Step 2: Criar migration**

```sql
-- Tabela duplicada de idempotência (versão simples usada: idempotent_ops)
DROP TABLE IF EXISTS public.idempotent_operations CASCADE;

-- Funções de dashboard duplicadas (v1 get_dashboard_data é a activa)
DROP FUNCTION IF EXISTS public.get_dashboard_data_v2(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_data_v3(uuid, text) CASCADE;
```

- [ ] **Step 3: Aplicar via MCP `apply_migration`**

  name: `drop_dead_db_code`

- [ ] **Step 4: Verificar**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'idempotent_operations';
-- Expected: 0 rows
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260418130000_drop_dead_db_code.sql
git commit -m "chore: remover tabela idempotent_operations e funções dashboard v2/v3 (dead code)"
```

---

### Task 7: Avaliar e limpar `debug_logs`

- [ ] **Step 1: Verificar conteúdo e uso**

```sql
SELECT COUNT(*), MAX(created_at) FROM public.debug_logs;
```

```bash
grep -r "debug_logs" src/ supabase/functions/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Decisão**
  - Se 0 rows e não referenciada no código → criar migration para DROP
  - Se tem dados ou ainda é usada → criar migration para adicionar RLS + política de limpeza automática (ex: apagar entries com mais de 30 dias)

- [ ] **Step 3: Aplicar decisão e commit**

---

### Task 8: Rever PR #11 e fechar dependabot PRs

- [ ] **Rever PR #11** (`chore/auth-context-case-hardening-clean`)
  - `gh pr view 11`
  - Se os fixes ainda são necessários: merge. Se já foram incorporados: close.

- [ ] **Fechar dependabot PRs**
  - PR #18 (lucide-react) e PR #16 (framer-motion): `gh pr merge 18 --squash` e `gh pr merge 16 --squash`
  - Verificar se não há breaking changes antes de mergear.

---

## Resultado Esperado

| Área | Antes | Depois |
|------|-------|--------|
| Segurança (advisors) | 3 ERRORs críticos | 0 ERRORs |
| Views SECURITY DEFINER | 7 | 0 |
| Tabelas sem RLS | 2 (`deletion_tokens`, `users`) | 0 |
| Dead code DB | `idempotent_operations` + v2/v3 funcs | removido |
| Branches remotas obsoletas | 6 | 1 (PR #11 a decidir) |
| Ficheiros de backup | 1 | 0 |
