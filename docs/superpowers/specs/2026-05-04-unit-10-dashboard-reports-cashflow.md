# Unit 10: Dashboard / Reports / Cashflow — Design Spec

**Data:** 2026-05-04  
**Estado:** aprovado  
**Depende de:** Units 1, 2, 5, 6, 7, 8, 9, 13 (todos concluídos)

---

## Objetivo

Tornar Dashboard, Reports e Cashflow totalmente scope-aware (personal/família via `useScope()`), unificar as 3 RPCs de KPI paralelas numa única `get_kpis` scope-aware, introduzir 3 RPCs novas (`get_category_breakdown`, `get_dashboard_insights`, `get_cashflow_timeline`), e eliminar ~1000 linhas de dead code.

---

## Contexto — Estado actual (pré-Unit 10)

| Área | Problema |
|------|----------|
| `Dashboard.tsx` | Chama `getPersonalKPIs()` (ignorado scope família). 4 botões "Ação Rápida" apontam para `/personal/...`. Sem widget Inbox, sem DashboardInsights, sem sparkline cashflow. |
| `useDashboardQuery.ts` | Chama `get_personal_kpis` directamente — não reage ao scope toggle. |
| `reports.tsx` | Usa `familyId` de `familyData.family.id` em vez de `useScope()`. Chama `get_family_kpis` / `get_family_category_breakdown`. Sem tab "Análise Anual". |
| `cashflowService.ts` | Forward-only (começa em `new Date()`). Cartão de crédito como placeholder comentado. Cálculo feito no frontend. |
| `CashflowView.tsx` | Sem linha "agora", sem slider, sem distinção passado/futuro, sem badges `⚠️`. |
| `src/pages/Insights.tsx` | 970 linhas — dead code (não routed em `App.tsx`). |
| RPCs DB | `get_personal_kpis`, `get_family_kpis`, `get_family_kpis_with_user`, `get_family_category_breakdown` — 4 RPCs para o mesmo conceito. Nenhuma scope-aware por parâmetro. |

---

## Decisões

### 1. Sem novas tabelas, sem materialized views

Toda a mudança é em RPCs e UI. Materialized views são YAGNI — a app tem semanas de dados reais, RPCs respondem em <50ms.

### 2. Quatro RPCs novas (SECURITY DEFINER, scope-aware)

`scope_family_id IS NULL` ⇒ scope pessoal (`auth.uid()`). `scope_family_id IS NOT NULL` ⇒ scope família (valida membership activo antes de responder).

#### `get_kpis`
```sql
get_kpis(
  scope_family_id uuid DEFAULT NULL,
  date_start      date DEFAULT date_trunc('month', now())::date,
  date_end        date DEFAULT now()::date,
  exclude_transfers boolean DEFAULT true
) RETURNS TABLE (
  total_balance_cents    bigint,
  income_cents           bigint,
  expense_cents          bigint,
  net_cents              bigint,
  goals_progress_pct     numeric,
  budget_spent_pct       numeric,
  budgets_at_risk        integer,
  reserved_cents         bigint,
  inbox_pending_count    integer
)
```
Substitui: `get_personal_kpis`, `get_family_kpis`, `get_family_kpis_with_user`, `get_family_kpis` com parâmetros de range.

#### `get_category_breakdown`
```sql
get_category_breakdown(
  scope_family_id uuid DEFAULT NULL,
  date_start      date,
  date_end        date,
  kind            text  -- 'income' | 'expense'
) RETURNS TABLE (
  categoria_id    uuid,
  categoria_nome  text,
  amount_cents    bigint,
  share_percent   numeric
)
```
Agrega `expense_splits` (Unit 13) quando scope=família. Substitui: `get_family_category_breakdown` + lógica local de Reports.

#### `get_dashboard_insights`
```sql
get_dashboard_insights(
  scope_family_id uuid DEFAULT NULL
) RETURNS TABLE (
  type    text,   -- 'mom_change' | 'top_category' | 'budget_risk' | 'projected_over'
  title   text,
  value   numeric,
  detail  jsonb
)
```
Devolve 2–3 insights ordenados por relevância. `mom_change`: diferença despesa mês-vs-mês anterior. `top_category`: categoria com maior variação. `budget_risk`: budgets ≥80% ou `is_projected_over`. `projected_over`: categorias projectadas a exceder budget.

#### `get_cashflow_timeline`
```sql
get_cashflow_timeline(
  scope_family_id uuid DEFAULT NULL,
  date_start      date,
  date_end        date,
  account_ids     uuid[] DEFAULT NULL
) RETURNS TABLE (
  event_date      date,
  amount_cents    bigint,
  direction       text,   -- 'in' | 'out'
  source_type     text,   -- 'transaction' | 'recurring_rule' | 'funding_rule' | 'credit_card_payment' | 'goal_deadline'
  source_id       uuid,
  description     text,
  is_projected    boolean,
  needs_confirm   boolean
)
```
Passado (`event_date <= today`): transactions reais. Futuro (`event_date > today`): `recurring_rules` (auto + confirm pendentes), `goal_funding_rules`, `recurring_rules` com `type='credit_card_payment'` (Unit 9), goals com `prazo IS NOT NULL`.

### 3. RPCs antigas — deprecação
`get_personal_kpis`, `get_family_kpis`, `get_family_kpis_with_user`, `get_family_category_breakdown` ficam com comentário `-- DEPRECATED: use get_kpis / get_category_breakdown (Unit 10)` e são removidas no ciclo seguinte.

### 4. Dashboard — widgets MVP

`useDashboardQuery.ts` reescrito para chamar `get_kpis(scopeFamilyId, dateStart, dateEnd)` — reactivo ao scope toggle.

Widgets (em ordem):
1. **Saldo Total** — `total_balance_cents`
2. **Este Mês** — `income_cents` / `expense_cents` / `net_cents`  
3. **Inbox Badge** — `inbox_pending_count` → link `/app/inbox`
4. **Budgets em Risco** — `budgets_at_risk` + top-3 categorias
5. **Goals** — `goals_progress_pct` + `reserved_cents`
6. **Próximos 14 dias** — sparkline via `get_cashflow_timeline(today, +14d)`
7. **Transações Recentes** — 5 entradas (mantido)
8. **DashboardInsights** — `src/components/dashboard/DashboardInsights.tsx` com 2–3 cards do `get_dashboard_insights`
9. **ContributionsWidget** — só scope=família (já existe — Unit 13)

Removidos: "Account Distribution" pie, "Today's Reminders", "Estado do Sistema" (3 cards sem valor).

URLs corrigidos: todos os `/personal/...` e `/Goals` → `/app/transactions`, `/app/accounts`, `/app/goals`, `/app/reports`, `/app/inbox`.

### 5. Cashflow — timeline −30d/+90d

`CashflowView.tsx` passa de `generateCashflowProjection()` local para `get_cashflow_timeline` RPC.

- Janela default: `today − 30d` → `today + 60d`
- Slider UI: 30 / 60 / 90 dias para cada lado (6 combinações)
- Linha vertical "agora" (CSS `border-left`)
- Eventos passados: barra sólida; eventos futuros: barra tracejada
- Badge `⚠️ por confirmar` para `needs_confirm = true`
- `cashflowService.ts` simplificado: remove lógica de projecção frontend, delega para RPC

### 6. Reports — tab "Análise Anual"

5.º tab (novo) com:
- Seletor de ano (default: ano corrente)
- 12 barras mensais income / expense / net
- Linha de cumulative savings
- Nota "Subsídios" quando há payroll data (Unit 11 alimentará)

4 tabs actuais mantidos. Migração para `get_kpis` / `get_category_breakdown`.

### 7. ExportService — completar unificação

`src/services/exportService.ts` — adicionar `exportCashflow(events)` ao lado de `exportTransactions()` e `exportReport()` já existentes. ReportExport continua lazy-loaded.

### 8. Dead code — eliminar

| Ficheiro | Linhas | Acção |
|----------|--------|-------|
| `src/pages/Insights.tsx` | 970 | Apagar |
| `getPersonalKPIs()` em `src/services/accounts.ts` | ~15 | Marcar deprecated |
| `getFamilyKPIs()`, `getFamilyKPIsRange()`, `getFamilyCategoryBreakdown()` em `src/services/family.ts` | ~75 | Marcar deprecated |

---

## Ficheiros criados / modificados

| Ficheiro | Acção |
|----------|-------|
| `supabase/migrations/20260504100000_unit10_rpcs.sql` | Criar 4 RPCs novas, deprecar 4 antigas |
| `src/hooks/useDashboardQuery.ts` | Reescrever — scope-aware, `get_kpis` |
| `src/hooks/useCashflowQuery.ts` | Novo — `get_cashflow_timeline` |
| `src/hooks/useInsightsQuery.ts` | Novo — `get_dashboard_insights` |
| `src/components/dashboard/DashboardInsights.tsx` | Novo — 2–3 cards contextuais |
| `src/pages/Dashboard.tsx` | Refactor — widgets MVP, URLs corrected |
| `src/components/cashflow/CashflowView.tsx` | Refactor — timeline, slider, linha "agora" |
| `src/services/cashflowService.ts` | Simplificar — delegar para RPC |
| `src/pages/reports.tsx` | Refactor — RPCs unificadas, tab Análise Anual |
| `src/services/exportService.ts` | Adicionar `exportCashflow()` |
| `src/pages/Insights.tsx` | **Apagar** |
| `tests/utils/factories.ts` | Adicionar `makeKpiResult`, `makeCashflowEvent`, `makeInsight` |
| `src/hooks/__tests__/useDashboardQuery.test.ts` | Novo |
| `src/hooks/__tests__/useCashflowQuery.test.ts` | Novo |
| `src/components/dashboard/__tests__/DashboardInsights.test.tsx` | Novo |
| `src/pages/__tests__/Dashboard.test.tsx` | Novo (scope reactivity) |

---

## Testes — critérios de aceitação

| Cenário | Como testar |
|---------|-------------|
| Dashboard muda KPIs quando scope toggle muda personal→família | Mock `get_kpis` com `scope_family_id=null` vs `id`; assert widgets actualizam |
| `get_kpis` retorna os mesmos números que os RPCs antigos | Paridade: `get_personal_kpis()` == `get_kpis(null, ...)` |
| Timeline cashflow inclui transactions passadas E recurring futuras | `get_cashflow_timeline` mock com mix `is_projected=false/true` |
| Badge `⚠️` aparece para `needs_confirm=true` | Render `CashflowView` com evento `needs_confirm=true` |
| Slider 30/60/90 altera janela sem refetch desnecessário | `staleTime` adequado; assert queryKey muda |
| DashboardInsights renderiza 2–3 cards | Mock `get_dashboard_insights`; assert cards aparecem |
| Tab "Análise Anual" agrega 12 meses | Mock KPIs mensais; assert 12 barras |
| `exportCashflow()` produz CSV válido | Unit test com eventos fixture |
| Inbox badge mostra count e link correcto | `inbox_pending_count=3` → badge "3" → href `/app/inbox` |
| URLs corrigidos no Dashboard | Assert nenhum link `/personal/` em Dashboard.tsx |

---

## Dependências satisfeitas

| Unit | O que fornece |
|------|---------------|
| Unit 1 | `useScope()`, scope toggle |
| Unit 5 | `accounts` com `amount_cents` |
| Unit 6 | `transactions.amount_cents`, `expense_splits` |
| Unit 7 | `goal_funding_rules`, `reserved_cents` |
| Unit 8 | `budgets`, `is_projected_over`, `budgets_at_risk` |
| Unit 9 | `recurring_rules`, `inbox_items`, `credit_card_payment`, `execution_mode` |
| Unit 13 | `expense_splits`, `ContributionsWidget`, `member_balances` |

---

## O que fica de fora (YAGNI)

- Materialized views — reavaliar com >24 meses de dados reais e lentidão mensurável
- Widget customization (dashboard personalizado) — parked-aceite para pós-beta
- Push notifications de threshold — Unit 15
- Overlay de budgets no cashflow — candidato a backlog pós-launch
