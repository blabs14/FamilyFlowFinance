# FamilyFlowFinance — Roadmap e Decisões

> Documento de referência rápida para retomar o projeto ou arrancar um novo agente a frio.
> Fonte completa: [`docs/superpowers/specs/2026-04-18-product-design-review.md`](specs/2026-04-18-product-design-review.md)
> Planos de implementação: [`docs/superpowers/plans/`](plans/)

---

## Visão do Produto

**"Gestão financeira completa PT: ordenado, subsídios, gastos, família — tudo numa só app."**

O **wedge** é o payroll português (IRS tabelado, SS, subsídios, duodécimos, férias partidas, ajudas de custo) — território mal ocupado. Concorrência: YNAB/Toshl/Emma não fazem payroll PT; Splitwise não faz finanças pessoais; Excel é o concorrente real.

**Rota:** dogfood família → amigos beta → SaaS. Sem prazo fixo. Prioridade: ficar realmente bom.

---

## Estado Atual (2026-04-20)

- App pausada ~5 meses (Nov/2025 → Abr/2026). Sanitização DB + RLS + testes refeitos em Abr/2026.
- Nenhum utilizador usa a app com regularidade.
- **Unit 1 Phase 1 concluída** (2026-04-20): `ScopeProvider`, `useScope`, `ScopeToggle`, `ScopeBadge`, `useMyFamilies` — infraestrutura de scope no ar, sem migrar páginas ainda.
- Prod: 13 transações, 20 goals, 11 contas, 2 goal_allocations — volumes triviais para migração.

---

## Ordem de Execução Recomendada

### Fase A — Fundações (sem isto nada mais funciona corretamente)

| # | Unit | Porquê agora |
|---|------|-------------|
| 1 | **Unit 2** — Modelo de dados | Kill dead code + `goal_ledger` + money em `amount_cents` + `categories.is_system`. Foundation para tudo o resto. |
| 2 | **Unit 4** — Auth security cleanup | Vulnerabilidade ativa: password em `console.log` em produção. Blocker de dogfood. Pode ser feito em paralelo com Unit 2. |
| 3 | **Unit 16.6** — Cypress→Playwright | Blocker para qualquer plan que escreva E2E tests novos. Fazer cedo para não acumular dívida. |

### Fase B — UI Unificada (materializa Unit 1)

| # | Unit | Porquê nesta ordem |
|---|------|-------------------|
| 4 | **Unit 3** — Navegação | Flat sidebar + scope toggle real + rotas unificadas. Completa a UX de Unit 1. |
| 5 | **Unit 5** — Accounts & Cards | Depende de Unit 2 (cents, kill `is_goals`). Separa `credit_cards` de `accounts`. |
| 6 | **Unit 6** — Transactions & Categories | Depende de Unit 2 (cents, `goal_ledger`) e Unit 5 (FK dupla). Tabela `transfers` + splits. |
| 7 | **Unit 7** — Goals | Depende de Unit 2 (`goal_ledger`) e Unit 6 (`operation_id`). Simplifica radicalmente. |
| 8 | **Unit 8** — Budgets | Depende de Unit 2 (cents) e Unit 6 (splits). Templates + rollover + projection. |
| 9 | **Unit 9** — Recorrentes & Inbox | Depende de Units 5/6/7/8. `daily-scheduler` unificado + `inbox_items`. |
| 10 | **Unit 13** — Family Sharing | Materializa Unit 1 (páginas únicas, redirect `/personal/*` → `/app/*`). Depende de Units 6/7/9. |

### Fase C — Intelligence & Reports

| # | Unit | Porquê nesta ordem |
|---|------|-------------------|
| 11 | **Unit 10** — Dashboard & Reports | Depende de Units 5/6/7/8/9 (dados reais). Scope-aware, timeline cashflow, insights. |
| 12 | **Unit 11** — Payroll Core | Depende de Units 5/6/7/9 (conta destino, transaction income, funding rules, recurring). |
| 13 | **Unit 12** — Payroll Advanced | Depende de Unit 11. OT duas escalas, leaves, ajudas de custo, PDF. |
| 14 | **Unit 14** — Importer | Depende de Units 6/9 (dedup contra `recurring_instances`). Templates 6 bancos PT. |

### Fase D — Polish & SaaS-Ready

| # | Unit | Porquê por último |
|---|------|------------------|
| 15 | **Unit 15** — Settings & Profile | Depende de quase tudo. `user_preferences`, GDPR, onboarding real, notificações. |
| 16 | **Unit 16** — Plumbing | Consome todas as outras. Sentry, CI completo, RLS tests template, observabilidade. |

---

## Decisões por Unit — Referência Rápida

### Unit 1: Scope Model
**Decisão:** Scope como estado — `ScopeProvider` + toggle header (`Pessoal` / `Família: X`). Páginas únicas com `useScope()`. RPCs unificados com parâmetro de scope.
**Status:** Phase 1 ✅ concluída. Phases 2-4 (fundir PersonalX/FamilyX, unificar RPCs, apagar providers) executadas nas Units 3/5/6/7/8/13.
**Spec:** §6 Unit 1

### Unit 2: Modelo de Dados Central
**Decisão:** Refactor incremental em 4 fases:
1. Kill dead code (`fixed_expenses`, `goal_contributions`, `goal_deallocations`, `accounts.is_goals`)
2. `goal_ledger` unificado (migrar `goal_allocations` → ledger, nova view `goals_with_balance`)
3. Money em `amount_cents bigint` (uma tabela por commit: accounts, transactions, budgets, goals)
4. `categories.is_system` boolean

**Supersedência:** Unit 7 mantém `goal_funding_rules` (não apagar — remodelar para suportar cron).
**Status:** plano em escrita 🔄
**Spec:** §6 Unit 2

### Unit 3: Navegação
**Decisão:** Flat sidebar única com 8 items (Dashboard, Contas, Transações, Orçamentos, Objetivos, Recorrentes, Payroll, Relatórios) + items contextuais família (Membros, Convites, Definições Família). Rotas `/personal/*` e `/family/*` viram redirects para `/app/*`. Mobile tabbar: 5 items + "Mais".
**Status:** pendente
**Spec:** §6 Unit 3

### Unit 4: Auth & Onboarding
**Decisão:** (1) Limpar vulnerabilidades (password em `console.log` [LoginForm.tsx:34-59], `DirectLoginTest` na página pública, rota `/test` não-autenticada); (2) onboarding híbrido — empty states + mini-wizard 3 passos opcional; (3) investigar fallback timer 3s em `AuthContext`; (4) OAuth desabilitado com "Em breve".
**Status:** pendente ⚠️ vulnerabilidade ativa
**Spec:** §6 Unit 4

### Unit 5: Accounts & Cards
**Decisão:** Separar `credit_cards` de `accounts` (tabela nova). FK dupla `account_id XOR credit_card_id` em `transactions` com CHECK. Nível avançado: limite, ciclo, juros, parcelamentos, faturas, cashback. Contas ganham `currency`, `order_index`, `deleted_at` (soft-delete). Depende de: Unit 2 (cents, kill `is_goals`).
**Status:** pendente
**Spec:** §6 Unit 5

### Unit 6: Transactions & Categories
**Decisão:** Tabela `transfers` + trigger (2 rows auto em `transactions`). Splits por categoria (`transaction_splits`). Anexos (`transaction_attachments`). Hierarquia categorias 1 nível (`parent_id`). Sem datas futuras. `operation_id` obrigatório + `reversal_of` universal. Depende de: Units 1/2/5.
**Status:** pendente
**Spec:** §6 Unit 6

### Unit 7: Goals
**Decisão:** Alocação como reserva (dinheiro não sai da conta). `goal_ledger` fonte da verdade. Funding rules completas com cron (3 tipos: `fixed_monthly`, `income_percent`, `roundup_expense`). Tipo `amortization` (FK a `credit_cards`). Prioridades 1-5 + drag-n-drop. "Precisas X€/mês" quando há prazo. Completion com 4 CTAs. Depende de: Units 1/2/5/6. **Supersede Unit 2** quanto a `goal_funding_rules` (mantém e remodela).
**Status:** pendente
**Spec:** §6 Unit 7

### Unit 8: Budgets
**Decisão:** Granularidade mensal + anual. Templates recorrentes com cron. Hierarquia pai/filho simultâneos. Rollover por budget (`reset|accumulate|transfer_to_goal`). Flexível/soft-cap. Família agregado + meta pessoal opt-in. Projection linear. Notificações 80%/100%/`is_projected_over`. Depende de: Units 1/2/6/7.
**Status:** pendente
**Spec:** §6 Unit 8

### Unit 9: Recorrentes & Lembretes
**Decisão:** Motor híbrido `auto`/`confirm`. `amount_mode` (`fixed|variable|estimated`). Padrões custom sem RRULE completo. `inbox_items` substitui `reminders` como inbox unificado (4 `source_type`). Tipo `credit_card_payment`. Cron único `daily-scheduler` às 03:00 Europe/Lisbon. Rota `/app/inbox`. Dedup fuzzy do importer contra `recurring_instances`. Apagar `fixed_expenses` + crons antigos. Depende de: Units 1/2/5/6/7/8.
**Status:** pendente
**Spec:** §6 Unit 9

### Unit 10: Dashboard / Reports / Cashflow
**Decisão:** Dashboard scope-aware via `useScope()`. Insights absorvido no Dashboard como `<DashboardInsights />`. Cashflow como timeline unificada −30d/+90d com slider. RPCs unificadas: `get_kpis`, `get_category_breakdown`, `get_dashboard_insights`, `get_cashflow_timeline`. Tab "Análise anual" em Reports. `exportService.ts` único. Sem materialized views (YAGNI). Depende de: Units 1/2/6/7/8/9.
**Status:** pendente
**Spec:** §6 Unit 10

### Unit 11: Payroll Core
**Decisão:** IRS 2026 PT via `tax_tables` DB (Despacho 233-A/2026). Uma transação income líquida por payslip. Salário como `recurring_rule` (Unit 9). Posting dispara `run_funding_rules` (Unit 7). Scope-aware + view `family_income`. Um contrato ativo por user no Core. Ambos modos subsídio (full/duodécimos). Meal tax-free caps €6,15 dinheiro / €10,46 cartão. Upload manual PDF. Valores PT 2026: salário mínimo €920, SS 11%/23,75%, mínimo existência €12.880. Depende de: Units 1/2/5/6/7/9.
**Status:** pendente
**Spec:** §6 Unit 11

### Unit 12: Payroll Advanced
**Decisão:** OT com duas escalas legais (até 100h/ano vs acima). Trabalho noturno +25%. Leaves com tratamento fiscal correto. Mileage €0,40/km. Bonuses tipificados. Retroativos tributados pelo ano de competência. Múltiplos contratos simultâneos com alerta de bracket. PDF automático via react-pdf. Ajudas de custo com caps 2026 (nacional €65,89/€72,65; estrangeiro €156,36/€175,42). Turnos rotativos parked-aceite. Depende de: Unit 11.
**Status:** pendente
**Spec:** §6 Unit 12

### Unit 13: Family Sharing
**Decisão:** UI unificada real — apagar `PersonalX`/`FamilyX`, rotas `/personal/*`/`/family/*` → redirects `/app/*`. Edge Function `send-family-invite` com Resend + rate limit. Roles `owner|admin|member|viewer` com min-1-owner. Soft-remove. Tracking contribuição individual. `expense_splits` + `settle_member_balance`. Family events em `inbox_items`. `family_audit_log` 180d. N famílias por user. RLS fortification com triggers BEFORE INSERT. Depende de: Units 1/2/4/5/6/7/8/9.
**Status:** pendente
**Spec:** §6 Unit 13

### Unit 14: Importer
**Decisão:** Templates 6 bancos PT (Millennium, Santander, CGD, NB, ActivoBank, Montepio + BPI). OCR parked-aceite (remover stub). Fuzzy dedup contra `transactions` + `recurring_instances` (marca `posted`). Rules engine `import_categorization_rules` + seed ~30 regras PT. OFX via `ofx-js`. Auto-deteção formato. Sem cap 1000 linhas. `/app/import` scope-aware. Per-row error badges. Testes ≥80%. Retenção 180d. Depende de: Units 1/2/5/6/9/13.
**Status:** pendente
**Spec:** §6 Unit 14

### Unit 15: Settings & Profile
**Decisão:** Rota `/app/settings` scope-aware com 5 tabs (Profile, Preferences, Notifications, Data & Privacy, Family). Migrar JSONB `personal_settings` → tabela tipada `user_preferences` com colunas por evento×canal. Password change real. Avatar upload bucket. Onboarding geral + "Rever". GDPR: deletion com cooling-off 30d + Edge Function; data export ZIP. Matriz notificações 11 eventos × 2 canais (email + inbox). Rule UI fecha Unit 14. ThemeProvider real. Depende de: Units 1/4/9/10/13/14.
**Status:** pendente
**Spec:** §6 Unit 15

### Unit 16: Plumbing Cross-Cutting
**Decisão:** Sentry (frontend + Edge Functions, blocker friends beta). `edgeLogger` com `correlation_id` em todas EFs. `job_runs` + DLQ com retry 3× + Sentry alert. `edge_rate_limits` partilhado. RLS tests completos ~25 tabelas como CI gate. E2E Playwright (8 flows, abandonar Cypress). Coverage thresholds (70%/85%/95%/100% money math). `eslint-plugin-jsx-a11y` + `@axe-core/playwright`. i18n cleanup + `useLocale`. CSP Vite plugin. Type drift + schema snapshot em CI. `.nvmrc` + Husky lint-staged. Dependabot + `npm audit --high`.
**Sub-decisão 6 é blocker para novos E2E tests** — executar cedo no roadmap.
**Parked pré-SaaS ⚠️:** MFA/2FA para roles `owner`/`admin` — **obrigatório antes de SaaS público** (poder destrutivo sem 2FA é risco inaceitável).
**Status:** pendente (sub-decisão 6 cedo, resto por último)
**Spec:** §6 Unit 16

---

## Blockers Pré-SaaS (não lançar sem estes)

| Blocker | Unit | Razão |
|---------|------|-------|
| Sentry em produção | Unit 16.1 | Friends beta sem telemetria é debugging no escuro |
| GDPR account deletion | Unit 15.9 | RGPD Art. 17 — obrigatório antes de abrir a terceiros |
| GDPR data export | Unit 15.10 | RGPD Art. 15/20 — obrigatório antes de SaaS |
| MFA para owner/admin | Unit 16 parked | Poder destrutivo (apagar família, transferir ownership) inaceitável sem 2FA |
| RLS tests ~25 tabelas | Unit 16.5 | Vazamento cross-tenant em SaaS é game-over |

---

## Vulnerabilidades Ativas (corrigir agora)

- **`console.log('[DEBUG] Password:', data.password)`** em [src/components/auth/LoginForm.tsx:34-59](../src/components/auth/LoginForm.tsx) — ativo em produção
- **`DirectLoginTest`** renderizado na página pública de login
- **Rota `/test` pública** não autenticada em produção
- Estas 3 fixes estão no scope da Unit 4 mas podem (e devem) ser feitas imediatamente como patch urgente

---

## Planos Escritos

| Plan | Unit | Estado |
|------|------|--------|
| [2026-04-20-unit-01-phase-1-scope-infrastructure.md](plans/2026-04-20-unit-01-phase-1-scope-infrastructure.md) | Unit 1 Phase 1 | ✅ Executado e merged em main |
| [2026-04-20-unit-02-data-model.md](plans/2026-04-20-unit-02-data-model.md) | Unit 2 | 🔄 Em execução (Trae IDE) |

---

## Planos a Escrever (por ordem)

1. ~~Unit 2 — Modelo de dados (4 fases)~~ → plano escrito, em execução
2. Unit 4 — Auth security cleanup (urgente — vulnerabilidade ativa)
3. Unit 16.6 — Cypress→Playwright migration
4. Unit 3 — Navegação
5. Unit 5 — Accounts & Cards
6. Unit 6 — Transactions & Categories
7. Unit 7 — Goals
8. Unit 8 — Budgets
9. Unit 9 — Recorrentes & Inbox
10. Unit 13 — Family Sharing
11. Unit 10 — Dashboard & Reports
12. Unit 11 — Payroll Core
13. Unit 12 — Payroll Advanced
14. Unit 14 — Importer
15. Unit 15 — Settings & Profile
16. Unit 16 — Plumbing (resto)
