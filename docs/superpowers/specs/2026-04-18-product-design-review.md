# Product Design Review — FamilyFlowFinance

**Data:** 2026-04-18
**Autor:** Pedro + Claude
**Estado:** em curso (a preencher à medida que decidimos cada unidade)

---

## 1. Contexto

FamilyFlowFinance foi pensada originalmente como ferramenta pessoal (Pedro + família), depois evoluiu com ambição de produto familiar, e a posição atual é:

> **"Gestão completa PT: ordenado, subsídios, gastos, família — tudo numa só app."**

O payroll PT-específico (subsídios, duodécimos, férias, IRS, SS) é o **wedge** — território mal ocupado por concorrência (YNAB/Toshl/Emma não fazem payroll PT; Splitwise não faz finanças pessoais; Excel é o "concorrente" real).

### Estado atual

- Projeto **pausado ~5 meses** (Nov/2025 → Abr/2026).
- Pausa deixou afinações e bugs por fechar, especialmente em: **Goals** (esforço grande), **transferências cross-scope**, **criação de cartões**, **contratos de payroll**.
- Em Abr/2026 fez-se **sanitização** (segurança DB, RLS, views, search_path), **limpeza de artefactos** e **reconstrução da bateria de testes** (4 fases: units, forms+services, DB integration, E2E Cypress).
- **Ninguém usa a app com regularidade hoje** — incluindo o autor.

### Objetivo

Levar a app de "pausada + sanitizada" a "família a usar → amigos a testar → lançar como SaaS". **Sem prazo.** Prioridade é ficar **realmente boa**.

### Restrição importante

Passaram 5 meses e a forma como o autor desenvolve mudou. Não se confia apenas na memória das decisões originais. Por isso não basta auditar "saúde" — tem que se auditar também **ideia e design**, com abertura a redesenhar o que hoje não parece a melhor escolha.

---

## 2. Abordagens consideradas

### Opção A — Auditar → Estabilizar fatia MVP → Dogfood
Auditoria de saúde, definição de fatia MVP, estabilização apenas dessa fatia, dogfood 4-8 semanas, decisões de refactor com base em uso real.

**Trade-off:** Mais lento nas primeiras semanas, mas cada passo entrega valor e não pinta para um canto.

### Opção B — Lista de bugs de memória e sacudir
Fazer lista do que se lembra estar partido, atacar em ordem, dogfood imediato, iterar.

**Trade-off:** Mais rápido, mas memória decaiu em 5 meses. Arrisca repetir o padrão de pausa a meio.

### Opção C — Refactor grande primeiro (unificar Personal↔Family), depois estabilizar
Unificar Personal/Family em modelo de "scope", remover código morto, então estabilizar.

**Trade-off:** Foundation mais limpa antes de SaaS, mas refactor grande **antes** de qualquer feedback real. Risco alto de nova pausa.

### Decisão: **A com lentes de C embutidas**

Base é a Opção A (auditar antes de tocar, fatia MVP, dogfood). Mas cada unidade auditada não é só "✅/🟡/🔴 de saúde" — inclui **crítica de design** e **alternativas**, para que eventuais redesenhos aconteçam **pela razão certa** (decisão discutida e consensual, não mudança cosmética nem reescrita à cega).

---

## 3. Processo de trabalho

### Unidade de discussão

Uma **feature area** por sessão (ver mapa na §4). Não se discute página a página nem sub-função a sub-função — agrupa-se por domínio.

### Dossier por unidade

Antes de cada sessão, Claude produz um dossier **inline na conversa** (não em ficheiro separado — é material de discussão, não de arquivo). Formato:

```markdown
## Unit N: <nome>

### 1. O que existe
- Ficheiros envolvidos: <lista com paths>
- Serviços usados: <lista>
- Tabelas/RPC DB: <lista>
- Rotas: <lista>

### 2. Estado real (evidência, não memória)
- ✅/🟡/🔴 por sub-função, com indicação de como foi testado
- Bugs conhecidos ou prováveis

### 3. Ideia original (até onde se consegue inferir)
- Problema que resolve
- Decisões de design visíveis no código
- Commits relevantes

### 4. Crítica
- O que está bem
- O que redesenharia, com razão concreta
- Riscos de manter como está

### 5. Alternativas
- Opção X: <descrição> — trade-offs
- Opção Y: <descrição> — trade-offs

### 6. Proposta
- Direção recomendada
- Porquê
- O que obriga (migrações, breaking changes, impacto noutras unidades)
```

### Posições de resposta

Pedro responde com uma de quatro posições:

- ✅ **concordo** → decidido
- 🔄 **concordo com ajustes X** → refinar e decidir
- ❓ **não percebo / quero mais info** → aprofundar
- ❌ **discordo** → Claude defende ou cede consoante argumentos; se persistir divergência, Pedro decide e segue

### Decision log

Depois da discussão, Claude adiciona entrada no decision log (§6 deste documento). Formato:

```markdown
## Unit N: <nome>
- **Data:** 2026-04-XX
- **Decisão:** <frase curta>
- **Contexto:** <1-2 frases do problema real>
- **Alternativas consideradas:** <lista curta>
- **Razão:** <porquê esta e não as outras>
- **Depende de / Afeta:** <unidades com dependência ou impacto — ex.: "depende de Unit 1; afeta Unit 7, Unit 10">
- **Implicações:** <o que muda no código/plano>
- **Evidência a preservar:** <paths, commits, RPC signatures, queries que o plano de execução vai precisar e que se perderiam quando a conversa compactar>
- **Estado:** decidido / parked / parked-aceite / superseded / aberto
- **Supersedes / Superseded by:** <referência a outras entradas, se aplicável>
```

### Estados possíveis

- **aberto** — em discussão ativa.
- **decidido** — consenso alcançado.
- **parked** — discussão não convergiu, adiada. Não qualifica para exit.
- **parked-aceite** — Pedro declarou explicitamente "parked-aceite: seguir sem decidir, assumir default seguro no plano" (ver protocolo abaixo). Qualifica para exit.
- **superseded** — uma decisão posterior tornou esta obsoleta. A entrada fica preservada (não é apagada); é atualizada com `Superseded by: Unit X` e a nova entrada marca `Supersedes: Unit N`.

### Revisão de decisões anteriores

Se ao discutir a Unidade N se concluir que uma decisão prévia (Unidade M, M<N) precisa mudar:

1. Pausa-se a discussão de N.
2. Reabre-se M com estado `aberto`, mantendo a entrada antiga no log intocada.
3. Discute-se M com o novo contexto. Decisão nova é **nova entrada** no log, com `Supersedes: Unit M (data X)`.
4. A entrada antiga é editada para acrescentar `Superseded by: Unit M (data Y)`.
5. Retoma-se N com a decisão atualizada em M.

### Retomar um `parked`

- Para retomar: basta Pedro ou Claude indicar "retomar Unit N". Estado volta a `aberto`.
- Para aceitar parked como terminal: Pedro declara explicitamente "parked-aceite" — o plano de execução tratará a unidade conforme o seu **default seguro** (manter como está, apenas corrigir bugs óbvios; sem redesign).

### Protocolo de retoma de sessão

Uma sessão futura que abra este documento determina a próxima unidade assim:

> Primeira unidade, pela ordem de execução em §4, cujo estado **não seja** `decidido`, `parked-aceite` ou `superseded`.

Se houver `parked` (não-aceite) antes desse ponto, pergunta-se primeiro se é altura de retomar.

### Salvaguardas contra paralisia

- **Time-box macio por unidade** — se uma discussão passar ~1h sem convergir, marca-se `parked` e segue-se. Volta-se quando houver clareza.
- **Default seguro** — unidades sem controvérsia ficam "manter como está, estabilizar bugs".
- **Plano só depois de TODAS as unidades decididas ou parked-aceites.** Não se começa a refactorizar a meio da auditoria.

---

## 4. Mapa de unidades

### Fase 1 — Decisões cruzadas *(afetam tudo; primeiro)*

1. **Scope model** — Personal vs Family como módulos paralelos ou unificado com toggle de contexto?
2. **Modelo de dados central** — relação entre accounts, transactions, goals, budgets; transferências cross-scope; cartões como entidade ou subtype.
3. **Navegação / IA** — estrutura `/app`, `/personal`, `/family` faz sentido? Mental model do utilizador.

### Fase 2 — Auditoria feature-a-feature

4. **Auth & Onboarding**
5. **Accounts & Cards**
6. **Transactions & Categories**
7. **Goals** 🔴 — área mais complexa, maior investimento anterior
8. **Budgets**
9. **Recurrents & Reminders** 🤔 possível sobreposição
10. **Dashboard / Reports / Insights / Cashflow** 🤔 4 vistas agregadas, possível redundância
11. **Payroll Core** — summary, contracts, timesheet, config, onboarding, periods
12. **Payroll Advanced** — bonus, performance-bonus, subsidies, vacations, km, OT
13. **Family sharing** — invites, members, roles, backup, export
14. **Importer**
15. **Settings & Profile**
16. **Plumbing cross-cutting** — notifications, audit_logs, webhooks

### Ordem de execução

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 13 → 11 → 12 → 14 → 15 → 16

**Racional:** foundation cruzada → auth → dados base → agregação → família (afeta tudo o que se discutiu) → payroll (grande mas self-contained) → auxiliares → plumbing.

### Paradas naturais para respirar / dogfood

- Após **unidade 3** — decisões estruturais validadas.
- Após **unidade 10** — features core cobertas.
- Após **unidade 13** — família/partilha coberta.
- Após **unidade 16** — auditoria completa.

O mapa e a ordem são indicativos — podem ajustar-se à medida que surgem descobertas.

---

## 5. Exit criteria → plano de execução

A fase de design review termina quando **todas as 16 unidades** têm estado `decidido`, `parked-aceite` ou `superseded`. Unidades em `aberto` ou `parked` (não-aceite) **bloqueiam** a transição.

Nessa altura, Claude invoca a skill `writing-plans` para produzir um **plano de estabilização baseado no decision log** — não na memória da conversa. O plano:

- Parte da decisão registada em cada unidade.
- Sequencia trabalho para respeitar dependências (ex.: se §1 decidir unificar scope, §5-§10 assentam em cima).
- Organiza em fases com "paradas para dogfood" reais.
- Cada tarefa é bite-sized, testável, com commit frequente.

---

## 6. Decision log

*(Esta secção cresce à medida que cada unidade é decidida. Começa vazia.)*

### Fase 1 — Decisões cruzadas

#### Unit 1: Scope model
- **Data:** 2026-04-18
- **Decisão:** Scope como estado (Opção B). Área única `/app/*` com `ScopeProvider` e toggle no header (`Pessoal` / `Família: X`). Páginas unificadas recebem scope via contexto. RPCs unificados com parâmetro de scope.
- **Contexto:** Hoje há duplicação UI/serviço entre Personal e Family (7 áreas duplicadas, `PersonalProvider` 523 linhas + `FamilyProvider` 942 linhas, RPCs paralelos `get_personal_X`/`get_family_X`), enquanto a DB já é unificada (tabelas únicas com `family_id` nullable). Sintomas: hotfix defensivo em [accounts.ts:482](src/services/accounts.ts), cross-scope transfers tratados como caso especial, `Familia.tsx` morto, `family.legacy.ts` por limpar.
- **Alternativas consideradas:**
  - A — Manter split, só limpar mortos (rejeitada: 50% manutenção duplicada para sempre).
  - B — Scope como estado (escolhida).
  - C — Split com componente genérico (rejeitada: mantém mental model duplicado, meio-caminho sem resolver UX).
- **Razão:** DB já suporta; UI é onde está o problema; alinha com mental model SaaS (um sítio, com contexto); ~50% menos código; cross-scope vira trivial; base de testes permite fazer refactor em segurança.
- **Depende de / Afeta:** Afeta Unit 2 (valida tabelas unificadas), Unit 3 (define como aparece o toggle na nav), Unit 5-10 (cada página passa a usar `useScope()`), Unit 13 (fica restrito a members/invites/roles), Unit 11 (confirma que Payroll fica fora do scope, é propriedade do user).
- **Implicações:**
  - Refactor em 4 sub-fases: (1) `ScopeProvider` + toggle + rotas; (2) fundir `PersonalX.tsx`+`FamilyX.tsx` em `X.tsx`; (3) unificar RPCs + rever RLS; (4) apagar `Familia.tsx`, `family.legacy.ts`, sobras.
  - Áreas exclusivas de família (Members, Invites, família-Settings) só visíveis com scope família.
  - Payroll fora do scope.
  - Cross-scope transfers simplificam: mudar scope ou operação explícita entre scopes.
- **Evidência a preservar:**
  - Ficheiros mortos a apagar: `src/pages/Familia.tsx`, `src/services/family.legacy.ts`.
  - Hotfix defensivo a remover: `src/services/accounts.ts:482-484`.
  - RPCs a unificar: `get_personal_transactions`/`get_family_transactions`, `get_personal_goals`/`get_family_goals`, `get_personal_kpis`/`get_family_kpis`, `get_personal_budgets`/`get_family_budgets`.
  - Providers a fundir/substituir: `src/features/personal/PersonalProvider.tsx` (523L), `src/features/family/FamilyProvider.tsx` (942L), `src/features/family/FamilyContext.tsx`.
  - Páginas duplicadas a fundir: PersonalAccounts/FamilyAccounts, PersonalGoals/FamilyGoals, PersonalBudgets/FamilyBudgets, PersonalTransactions/FamilyTransactions, PersonalDashboard/FamilyDashboard, PersonalSettings/FamilySettings.
- **Estado:** decidido

#### Unit 2: Modelo de dados central
- **Data:** 2026-04-19
- **Decisão:** Refactor incremental do modelo de dados (Opção C), em 4 fases: (1) kill dead code, (2) `goal_ledger` unificado, (3) money em bigint cents + currency, (4) `categories.is_system`. Reminders fica para Unit 9.
- **Contexto:** Schema tem vestígios de várias iterações — 5 mecanismos paralelos para dinheiro de goals (`goal_allocations`, `goal_contributions`, `goal_deallocations`, `goal_funding_rules`, `transactions.goal_id`, `accounts.is_goals`), 2 sistemas de recurrents (`fixed_expenses` legacy vs `recurring_rules`+`recurring_instances`), mistura de `numeric` e `int cents` para valores monetários. Produção tem 0 rows na maior parte destas tabelas — são built-but-never-used.
- **Alternativas consideradas:**
  - A — Manter tudo, só documentar uso (rejeitada: adia o problema; bugs de units permanecem).
  - B — Refactor big-bang numa release (rejeitada: risco alto, bloqueia outras unidades).
  - C — Refactor incremental fatiado (escolhida).
- **Razão:** Dados reais são 0-20 rows → migrações triviais mecanicamente; base de testes + E2E reconstruídos dão rede de segurança; faseado permite dogfood intermediário; cada fase é reversível isoladamente; não bloqueia discussão de outras unidades.
- **Depende de / Afeta:** Depende de Unit 1 (scope já unificado em DB, este refactor é sobre conceitos não sobre scope). Afeta Unit 5 (cartões/saldo em cents), Unit 6 (tx em cents + revalidar `transfer_group_id` que nunca foi usado em prod), Unit 7 (goals simplificadas drasticamente via ledger), Unit 8 (budgets em cents), Unit 9 (kill `fixed_expenses`, decisão final sobre reminders).
- **Implicações:**
  - **Fase 1 — Kill dead code:** apagar tabelas `fixed_expenses`, `goal_contributions`, `goal_deallocations`, ~~`goal_funding_rules`~~ (ver supersedência abaixo); apagar colunas `accounts.is_goals`, possivelmente `goals.account_id` (após ledger). Reminders decide-se na Unit 9.
  - **Fase 2 — Goal ledger:** criar `goal_ledger(goal_id, account_id?, tipo, amount_cents, signed, transaction_id?, rule_id?, data, operation_id)`; migrar 2 rows de `goal_allocations` + 5 rows de `transactions.goal_id`; view `goals_with_balance` deriva `valor_atual` via `SUM`. Apagar `goal_allocations`.
  - **Fase 3 — Money cents:** migrar `transactions.valor`, `accounts.saldo`, `budgets.valor`, `goal_ledger.valor` para `amount_cents bigint`; adicionar `currency text NOT NULL DEFAULT 'EUR'` onde falta. Uma tabela por commit.
  - **Fase 4 — `categories.is_system`:** flag booleana, permite NULL/NULL apenas para seed global.
- **Evidência a preservar:**
  - Tabelas a apagar (com counts confirmados como 0 em produção): `fixed_expenses`, `goal_contributions`, `goal_deallocations`, `goal_funding_rules`.
  - Colunas a apagar: `accounts.is_goals`, `goals.account_id` (após ledger substituir).
  - Tabelas a criar: `goal_ledger` (FK para goals, accounts, transactions, goal_funding_rules — esta última se ressuscitarmos o conceito).
  - Views/funções DB a ajustar: `goal_progress`, `account_balances`, `account_balances_v1`, `budget_progress`, RPCs `get_personal_*`/`get_family_*` que vão ser unificados em Unit 1.
  - Money unit counts em produção: `transactions=13`, `goal_allocations=2`, `goals=20`, `accounts=11` — volumes triviais para migração.
  - Notar: `transactions.transfer_group_id` nunca usado em produção (0 rows com NOT NULL) → a testar seriamente quando chegarmos a Unit 5/6 (pode estar partido e ninguém sabe).
- **Superseded by:** Unit 7 (2026-04-19) — parcialmente, apenas quanto a `goal_funding_rules`: Unit 7 decidiu manter e remodelar a tabela em vez de apagar, para suportar funding rules ativas com cron. Restante da decisão de Unit 2 mantém-se.
- **Estado:** decidido

#### Unit 3: Navegação / IA
- **Data:** 2026-04-19
- **Decisão:** Flat sidebar única + scope toggle persistente no header (Opção A). Chrome único (`MainLayout` + `NavigationSidebar` + `BottomTabBar`). Eliminar os três universos paralelos (`/app`, `/personal`, `/family`) — tudo sob `/app`.
- **Contexto:** Hoje existem 3 layouts concorrentes com 3 sidebars/tabbars separados, 11+9+6 items de nav paralelos, Payroll duplicado em dois caminhos, 4 vistas agregadas sobrepostas (Dashboard/Reports/Insights/Cashflow), terminologia inconsistente ("Resumo"/"Dashboard"), sem indicador persistente de scope ativo. A IA atual é mapa do histórico de desenvolvimento, não do mental model do utilizador.
- **Alternativas consideradas:**
  - A — Flat sidebar + scope toggle no header (escolhida).
  - B — Scope como secção na sidebar (rejeitada: duplica items, noise visual).
  - C — Scope por sub-rota `/app/personal/*` e `/app/family/*` (rejeitada: conflita com "scope = state" de Unit 1).
- **Razão:** alinha com decisão de Unit 1 (scope = state); mental model simples para SaaS; scope sempre visível via toggle + chip; remove 3x manutenção de nav duplicada.
- **Depende de / Afeta:** Depende de Unit 1 (scope como state é pré-requisito). Afeta Unit 4 (onboarding aterra em `/app` com scope Pessoal), Unit 5-8 (páginas únicas recebem scope via `useScope()`), Unit 9 (Recorrentes top-level; Lembretes decide-se lá), Unit 10 (reduz âmbito — só decide conteúdo de Dashboard e Reports, não se existem), Unit 11 (Payroll top-level em `/app/payroll/*`, remove `/personal/payroll`), Unit 13 (Members/Invites/Family Settings como items contextuais ao scope família), Unit 15 (separa settings do utilizador dos settings da família).
- **Implicações:**
  - **Main nav com 8 items:** Dashboard, Contas, Transações, Orçamentos, Objetivos, Recorrentes, Payroll, Relatórios.
  - **Items contextuais ao scope família:** Membros, Convites, Definições da Família.
  - **Items fora do scope (avatar menu):** Perfil, Definições do utilizador.
  - **Dashboard + Reports unificados:** Dashboard = vista presente; Reports = análise temporal com tabs Cashflow e Insights.
  - **Importar vira submenu de Transações** (não item top-level).
  - **Payroll top-level sempre visível** (estado "vazio" se não configurado) — acessível por `/app/payroll/*`.
  - **Performance dashboard** sai da main nav (devtool em settings ou escondida em prod).
  - **Mobile tabbar:** 5 items + "Mais" (drawer).
  - **Scope toggle no header:** dropdown com `Pessoal` + cada família; persist em localStorage; chip de cor em cada página para feedback imediato.
  - **Terminologia padronizada:** Dashboard, Contas, Transações, Orçamentos, Objetivos, Recorrentes, Payroll, Relatórios; scope `Pessoal` / `Família: X`.
- **Evidência a preservar:**
  - Apagar: `src/pages/Personal.tsx`, `src/pages/Family.tsx`, `src/pages/Familia.tsx`, `src/features/family/FamilySidebar.tsx`, `src/features/family/FamilyTabBar.tsx`, `src/features/family/FamilyHeader.tsx`.
  - Atualizar: `src/components/layout/NavigationSidebar.tsx`, `src/components/layout/BottomTabBar.tsx` — passam a ter os 8 items + scope toggle.
  - Novo: `src/features/scope/ScopeToggle.tsx`, `src/features/scope/ScopeProvider.tsx`, `src/features/scope/ScopeBadge.tsx`.
  - Rotas a consolidar: manter `/app/payroll/*`; apagar `/personal/payroll/*`; apagar todas as `/personal/*` e `/family/*`; rota `/app/importar` vira submenu interno de Transações.
- **Estado:** decidido

#### Unit 4: Auth & Onboarding
- **Data:** 2026-04-19
- **Decisão:** (1) Limpeza imediata de código morto e vulnerabilidades de auth; (2) Onboarding híbrido (Opção C) — empty states inteligentes em cada página + mini-wizard de 3 passos opcional no primeiro login; (3) Investigar agora o fallback timer de 3s em `AuthContext`; (4) OAuth desabilitado com label "Em breve" até unit dedicada pré-lançamento (Opção 2).
- **Contexto:** Auth flow tem vulnerabilidades ativas (password a ser impressa em `console.log` em [LoginForm.tsx:34-59](src/components/auth/LoginForm.tsx)), componente de debug `DirectLoginTest` renderizado na página pública de login, rota pública `/test` não-autenticada em produção, `AuthContext.backup.tsx` como cópia morta, providers OAuth declarados mas nunca validados E2E (sem `redirectTo`, sem handling de edge cases do trigger `handle_new_auth_user`), ausência total de onboarding — user novo aterra num dashboard vazio sem orientação, nem sequer são criadas categorias seed. Fallback timer de 3s em `AuthContext` força `loading=false` mesmo sem resposta, mascarando potenciais problemas de rede/Supabase.
- **Alternativas consideradas para onboarding:**
  - A — Empty states por página (rejeitada: sozinha, não orienta sequência crítica contas→categorias→primeira tx).
  - B — Wizard obrigatório no primeiro login (rejeitada: fricção, utilizador pode querer explorar antes).
  - C — Híbrido: empty states + mini-wizard opcional (escolhida).
- **Alternativas consideradas para OAuth:**
  - 1 — Remover botões OAuth completamente (rejeitada: perde a intenção como sinal para o futuro).
  - 2 — Desabilitar com "Em breve" (escolhida).
  - 3 — Implementar já (rejeitada: ~meio dia de trabalho cross-system sem valor para dogfood família/amigos).
- **Razão:**
  - Vulnerabilidades são bloqueadoras de dogfood — limpar é pré-requisito.
  - Híbrido de onboarding respeita estilos de exploração diferentes sem fricção obrigatória; empty states reaproveitam-se depois em fluxos normais (contas vazias, sem transações, etc.).
  - Fallback timer pode estar a mascarar race conditions reais — mais barato investigar agora do que debugar em dogfood.
  - OAuth adia-se porque: (a) dogfood família não precisa, (b) configuração cross-system (Google Console + Supabase Dashboard + redirect URIs + adaptação do trigger `handle_new_auth_user` para `raw_user_meta_data` do Google) é melhor tratada como unit dedicada quando chegar a altura de lançar, (c) manter botões desabilitados preserva a intenção no design.
- **Depende de / Afeta:** Depende de Unit 3 (onboarding aterra em `/app` com scope Pessoal default). Afeta Unit 2 (seed de categorias PT como parte do onboarding toca em `categories.is_system`), Unit 5 (empty state "criar primeira conta" reutilizado), Unit 6 (empty state "registar primeira transação"), Unit 15 (Settings recebe opção "rever onboarding"). Prepara terreno para unit OAuth pré-lançamento.
- **Implicações:**
  - **Cleanup imediato:**
    - Remover `console.log` de password em [LoginForm.tsx:34-59](src/components/auth/LoginForm.tsx) e todos os `console.log` de debug em `auth/*`.
    - Apagar `src/components/auth/DirectLoginTest.tsx` e referência em [login.tsx](src/pages/login.tsx).
    - Apagar `src/pages/AuthTest.tsx`, `src/pages/TestPage.tsx` e a rota `/test` em [App.tsx](src/App.tsx).
    - Apagar `src/contexts/AuthContext.backup.tsx`.
  - **OAuth desabilitado:**
    - Botões Google/Apple/Facebook mantidos visualmente mas `disabled` com tooltip/badge "Em breve".
    - `src/services/authProviders.ts` mantém-se (evita refactor posterior quando ativarem).
  - **Onboarding híbrido:**
    - Empty state em cada página principal (Dashboard, Contas, Transações, Categorias, Objetivos, Orçamentos) com CTA primária.
    - Mini-wizard opcional no primeiro login: Passo 1 = criar conta, Passo 2 = confirmar categorias seed PT, Passo 3 = (opcional) primeira transação. Skippable a qualquer passo.
    - Categorias PT seed criadas automaticamente no primeiro login (via trigger ou onboarding step).
  - **Fallback timer:**
    - Investigar root cause do timeout de 3s antes de remover/alterar; registar conclusão como sub-decisão dentro desta unit.
- **Evidência a preservar:**
  - Vulnerabilidades a fechar: `console.log('[DEBUG] Password:', data.password)` em [LoginForm.tsx:34-59](src/components/auth/LoginForm.tsx).
  - Código morto a apagar: `src/components/auth/DirectLoginTest.tsx`, `src/pages/AuthTest.tsx`, `src/pages/TestPage.tsx`, `src/contexts/AuthContext.backup.tsx`, rota `/test` em `src/App.tsx`.
  - Código a investigar: fallback timer em `src/contexts/AuthContext.tsx` (setTimeout 3000ms).
  - Código a manter (com mudança de estado): `src/services/authProviders.ts`, botões OAuth em `LoginForm.tsx`/`RegisterForm.tsx` (passam a `disabled` com "Em breve").
  - Código a criar: `src/features/onboarding/*` (wizard + empty states reutilizáveis), seed de categorias PT (migration DB ou função TS).
  - Trigger DB existente: `handle_new_auth_user` — pode precisar de ajuste para também fazer seed de categorias (ou fazer-se em TS no primeiro login).
- **Estado:** decidido

### Fase 2 — Features

#### Unit 5: Accounts & Cards
- **Data:** 2026-04-19
- **Decisão:** Separar conceptualmente contas e cartões (Opção B). Criar tabela `credit_cards` distinta de `accounts`. Transações apontam para `account_id` **ou** `credit_card_id` via duas FKs nullable + CHECK (Opção i). Lógica de cartões entregue no nível **avançado** (limite, ciclo, alertas, juros, parcelamentos, cashback, múltiplos cartões na mesma fatura). Aproveitar o refactor para adicionar em `accounts`: `currency`, `order` (drag-n-drop), `deleted_at` (soft-delete), substituindo cascade hard-delete.
- **Contexto:** Hoje cartões e contas vivem na mesma tabela `accounts` com `tipo='cartão de crédito'`. Cartões não têm limite (hardcoded 0% utilização em [CreditCardInfo.tsx:37](src/components/CreditCardInfo.tsx)), não usam `billing_cycle_day` (coluna existe, nunca preenchida), sem data de fecho/pagamento, sem juros, sem anuidade. Pagamento de cartão é transação normal. `useAccounts.ts` é dead code vs `useAccountsQuery.ts`. Hard-delete em cascata apaga histórico. Sem `currency`, sem ordem manual, sem soft-delete. Unit 2 decidiu matar `accounts.is_goals` e criar `goal_ledger` — mesma lógica aplica aqui.
- **Alternativas consideradas (modelo):**
  - A — Manter `accounts` com colunas nullable para cartões (rejeitada: polui tabela, validação cross-field complexa, mesmo erro conceptual que `is_goals`).
  - B — Separar em `accounts` + `credit_cards` (escolhida).
  - C — Polimorfismo `financial_accounts` + filhos 1:1 (rejeitada: overengineering, 3 joins por lista, complica Unit 1).
- **Alternativas consideradas (FK de transações):**
  - (i) Duas FKs nullable `account_id`/`credit_card_id` + CHECK exatamente uma (escolhida).
  - (ii) Coluna genérica `instrument_id` + `instrument_type` (rejeitada: FK sem referential integrity real).
  - (iii) Manter `account_id` e criar view (rejeitada: não resolve o problema).
- **Alternativas consideradas (âmbito de cartões):**
  - Mínimo útil — limite, utilização, badge em atraso.
  - Médio — + ciclo, alertas, previsão de pagamento.
  - **Avançado** — + juros, parcelamentos, múltiplos cartões por fatura, cashback (escolhida).
- **Razão:**
  - Cartões têm semântica distinta (limite, ciclo, pagamento, juros). Tabela separada alinha com decisão de Unit 2 (cada conceito financeiro distinto tem a sua tabela).
  - Volume real ≤20 rows → migração trivial; base de testes dá rede de segurança.
  - FK dupla + CHECK é explícita e a DB valida.
  - Nível avançado alinha com proposta de valor do produto (controlo financeiro PT completo — cartões bem feitos são diferenciador real vs apps genéricas).
  - Features em `accounts` (currency, order, soft-delete) são baratas de adicionar no mesmo refactor — separá-las para depois seria custo duplicado.
- **Depende de / Afeta:** Depende de Unit 1 (scope unificado nas RPCs), Unit 2 (money cents, kill `is_goals`). Afeta Unit 6 (tx aponta para account_id XOR credit_card_id, revalidação de `transfer_group_id`), Unit 8 (budgets têm de lidar com ambos os tipos), Unit 9 (recurrents podem pagar cartão — precisam referenciar o instrumento), Unit 10 (Dashboard e Reports agregam ambos), Unit 14 (importer distribui por ambos). Usa empty states de Unit 4.
- **Implicações — Modelo de dados:**
  - Nova tabela `credit_cards(id, user_id, family_id?, nome, credit_limit_cents bigint NOT NULL, current_balance_cents bigint NOT NULL DEFAULT 0, closing_day smallint CHECK 1-28, payment_day smallint CHECK 1-28, apr numeric(5,4), annual_fee_cents bigint DEFAULT 0, currency text NOT NULL DEFAULT 'EUR', order_index int, deleted_at timestamptz?, created_at, updated_at)`.
  - Alterações em `accounts`: adicionar `currency text NOT NULL DEFAULT 'EUR'`, `order_index int`, `deleted_at timestamptz?`; remover `is_goals` (já Unit 2), remover `billing_cycle_day` (migra para `credit_cards`), remover `tipo='cartão de crédito'` (migrado).
  - Alterações em `transactions`: adicionar `credit_card_id uuid?` + CHECK `(account_id IS NULL) <> (credit_card_id IS NULL)` (XOR). Migrar linhas existentes onde `account_id` aponta para conta com `tipo='cartão de crédito'`.
  - Nova tabela `credit_card_installments(id, credit_card_id, transaction_id, total_cents, num_installments, current_installment, monthly_cents, started_at)` para parcelamentos.
  - Nova tabela `credit_card_statements(id, credit_card_id, closing_date, due_date, total_cents, paid_cents, status)` para fechos mensais (gerada por função DB no closing_day).
  - RPCs: `get_user_accounts_with_balances` split em `get_user_accounts` + `get_user_credit_cards` (ambas unificando scope); função nova `calculate_credit_card_interest(card_id, month)` para juros se statement não pago em pleno; função `pay_credit_card(card_id, from_account_id, amount_cents)` que cria transação de saída em `accounts` + registo em `credit_cards`/`statements`.
- **Implicações — UI:**
  - Lista de contas bancárias e cartões em página `/app/contas` (Unit 3), secções distintas ou tabs.
  - Cartão mostra: limite, utilização %, saldo utilizado, próximo fecho, próximo pagamento, fatura atual (gastos do ciclo), fatura anterior não paga.
  - Ação "Pagar cartão" como fluxo dedicado (não transação manual) — escolhe conta de origem, amount total/parcial, cria ambos os lados atomicamente.
  - Criar transação em cartão pergunta: "Parcelar?" — se sim, N parcelas.
  - Drag-n-drop para reordenar (library `@dnd-kit/sortable` ou similar).
  - Archive (soft-delete) em vez de eliminar; secção "Arquivados" nas Settings da conta.
- **Implicações — Lógica de juros e fechos:**
  - Cron/trigger DB no closing_day cria `credit_card_statements` com total do ciclo.
  - Se pagamento até due_date cobre statement em pleno → sem juros.
  - Caso contrário, `calculate_credit_card_interest` aplica APR pro-rata sobre saldo remanescente e gera transação de juros automática no cartão.
  - Anuidade (`annual_fee_cents`) agendada via `recurring_rules` (Unit 9) no mês de aniversário.
- **Implicações — Múltiplos cartões na mesma fatura:**
  - Conceito suportado via `credit_card_statements.parent_statement_id` (nullable) ou tabela `statement_groups` — decidir em writing-plans; nota: este é o caso raro "fatura consolidada" típico de bancos que emitem family-card sob mesma conta.
- **Evidência a preservar:**
  - Ficheiros a apagar: `src/hooks/useAccounts.ts` (legacy confirmado).
  - Hotfix a remover: `src/services/accounts.ts:482-484` (filtro `family_id == null` — resolve-se com RPC unificada de Unit 1).
  - Código a refactorizar/substituir: `src/components/AccountForm.tsx`, `src/components/AccountList.tsx`, `src/components/RegularAccountForm.tsx`, `src/components/RegularAccountBalance.tsx`, `src/components/CreditCardForm.tsx`, `src/components/CreditCardBalance.tsx`, `src/components/CreditCardInfo.tsx`, `src/shared/types/accounts.ts`, `src/validation/accountSchema.ts`, `src/features/family/services/accounts.service.ts`.
  - Páginas a unificar (por Unit 1/3): `src/features/personal/PersonalAccounts.tsx` + `src/features/family/FamilyAccounts.tsx` + `src/pages/accounts.tsx` → uma página única `/app/contas` com `useScope()`.
  - Features a preservar no merge: `InlineReserveEditor` (percentagem de reserva de FamilyAccounts), `AccountAuditList` (auditoria por conta — generalizar para ambos os scopes), permissões explícitas.
  - RPCs a substituir: `get_user_accounts_with_balances`, `get_family_accounts_with_balances`, `set_regular_account_balance`, `handle_credit_card_account`, `manage_credit_card_balance`, `getCreditCardSummary`, `delete_account_with_related_data`.
  - Transações em produção a migrar: todas com `account_id` a apontar para `accounts.tipo='cartão de crédito'` movem-se para `credit_card_id`.
  - Testes existentes a preservar/adaptar: `tests/unit/services/accounts.test.ts`, `tests/unit/components/AccountForm.test.tsx`, `tests/unit/components/CreditCardForm.test.tsx`, `tests/unit/hooks/useAccountsQuery.test.tsx`, `src/features/family/__tests__/FamilyAccounts.test.tsx`, `src/validation/__tests__/accountSchema.test.ts`, `cypress/e2e/accounts.cy.ts`.
  - Novos testes necessários: ciclo completo (closing_day → statement → pagamento parcial → juros), parcelamento (N parcelas geram N transações mensais), transferência cross-scope que toca cartão, soft-delete + restore, reordenação drag-n-drop.
- **Estado:** decidido

#### Unit 6: Transactions & Categories
- **Data:** 2026-04-19
- **Decisão:** Sete sub-decisões: (1) transferências entre contas como híbrido — tabela `transfers` + 2 rows auto-geradas em `transactions` via trigger (Opção C); (2) split transactions em tabela `transaction_splits` (Opção B); (3) anexos em tabela `transaction_attachments` agora, com OCR adiado para Unit 14 — Importer (Opção B + C na Unit 14); (4) sem tags (Opção A); (5) categorias com hierarquia de 1 nível pai/filho (Opção B); (6) sem datas futuras — transações são factos consumados, planos vivem em Recorrentes/Lembretes, Unit 9 (Opção C); (7) `operation_id` obrigatório + `reversal_of` expandido para todas as ações + UI "Reverter transação" (Opção A). Derivadas: criar UI para `category_customizations`; adicionar trigger de audit para `transactions`; manter paginação fixed 20/página.
- **Contexto:** Hoje `transactions` tem `tipo`=(receita|despesa|transferencia) mas UI só cria receita/despesa; `transfer_group_id` tem 0 rows em produção (só usado internamente para dupla-entrada de goal allocations); `reversal_of` só usado em `fn_goal_deallocate`; `operation_id`/`event_time` existem na DB mas não têm uso no código TS; categorias seed = `user_id IS NULL AND family_id IS NULL` (Unit 2 troca por `is_system` boolean); `category_customizations` permite overrides sem UI; anexos têm infraestrutura (`attachments.ts`, bucket `receipts`, RPC `ingest_receipt` para OCR) mas zero integração com `transactions`. Filtros e paginação da lista são maduros.
- **Razão:**
  - **(1) Híbrido transfers+trigger:** preserves listagens "transação em ambas as contas" sem perder fonte única de verdade; cobre cross-scope e cartões (Unit 5).
  - **(2) Splits:** valor real para controlo financeiro PT sério (supermercado 120€ = 70€ comida + 30€ higiene + 20€ limpeza); encaixa natural com orçamentos por categoria.
  - **(3) Anexos:** infraestrutura já existe, só falta FK + UI; OCR pertence conceptualmente ao Importer.
  - **(4) Sem tags:** categorias + splits + hierarquia cobrem bem; tags sem valor claro e criam confusão de UX.
  - **(5) Hierarquia 1 nível:** cobre 99% dos casos reais; permite orçamentos granulares ou agregados; evita complexidade de árvore profunda.
  - **(6) Sem datas futuras:** preserves clareza (transação = facto); recorrentes/lembretes são o sítio certo para planos; simplifica saldos.
  - **(7) Idempotência + reversão:** table-stakes em produto financeiro sério; previne duplicações em retries; "Reverter" dá controlo sem apagar histórico.
- **Depende de / Afeta:** Depende de Unit 1 (scope unificado em RPCs/páginas), Unit 2 (`amount_cents`, `categories.is_system`, `goal_ledger` substitui `goal_id` + `goal_allocations`), Unit 5 (transferências podem envolver cartões; reversão tem de lidar com cartão). Afeta Unit 7 (goals usam ledger em vez de `transactions.goal_id`), Unit 8 (budgets beneficiam de hierarquia + splits), Unit 9 (recorrentes criam instâncias `pending` para substituir "datas futuras em transações"), Unit 10 (relatórios têm de lidar com splits), Unit 14 (importer herda tabela `transaction_attachments` + estende com OCR), Unit 15 (Settings tem UI para customizations + "rever onboarding").
- **Implicações — Modelo de dados (DDL):**
  - **Nova tabela `transfers`:** `id uuid, user_id, family_id? (scope pattern), from_account_id? + from_credit_card_id? (XOR CHECK), to_account_id? + to_credit_card_id? (XOR CHECK), amount_cents bigint, date date, description text?, operation_id uuid, event_time timestamptz, reversal_of uuid?, created_at, updated_at`. Trigger `trigger_transfer_materialize` cria/atualiza/apaga 2 rows em `transactions` quando `transfers` muda.
  - **Nova tabela `transaction_splits`:** `id, transaction_id FK, categoria_id FK, amount_cents bigint, description text?`. Transação mãe com splits tem `categoria_id = NULL`. CHECK: `SUM(amount_cents)` dos splits = `transactions.amount_cents` (via trigger ou constraint deferrable).
  - **Nova tabela `transaction_attachments`:** `id, transaction_id FK ON DELETE CASCADE, file_path text (bucket receipts), mime_type text, size_bytes int, original_filename text?, uploaded_by uuid FK auth.users, uploaded_at timestamptz`. Múltiplos anexos por transação.
  - **Alterações em `categories`:** adicionar `parent_id uuid? FK categories(id)`, CHECK profundidade máxima 1 (parent não pode ter parent). Unit 2 já adiciona `is_system` e trata `user_id`/`family_id` nullable.
  - **Alterações em `transactions`:** `operation_id uuid NOT NULL UNIQUE`, `event_time timestamptz NOT NULL DEFAULT now()`, `reversal_of uuid? FK transactions(id)`, `created_by uuid FK auth.users`. Remover `transfer_group_id` (migra para `transfers`), remover `goal_id` (migra para `goal_ledger` em Unit 2). Adicionar CHECK `data <= current_date` (sem datas futuras).
  - **Nova tabela `audit_logs`:** se não existir popular via trigger `trigger_audit_transactions` (insert/update/delete).
- **Implicações — Serviços/RPCs:**
  - Novas RPCs (scope-aware via Unit 1): `create_transfer(...)`, `reverse_transaction(tx_id)` — cria contrária com `reversal_of`, `delete_transaction(tx_id, reason)` — soft-delete se implementado.
  - Unificar `get_personal_transactions`/`get_family_transactions` em `get_transactions(scope)` (Unit 1), estender para incluir splits expandidos e anexos via JSON.
  - Criar `get_categories_tree()` que devolve categorias com `children[]` aninhado.
  - Atualizar `create_transaction` para gerar `operation_id` lado cliente (idempotência em retries).
  - RPC `reverse_transaction` cuida de: gerar transação contrária em `transactions`, preservar `reversal_of` link, rejeitar se tx já reversada, em cartões recalcular statement do ciclo.
- **Implicações — UI:**
  - Página única `/app/transacoes` (Unit 1/3), merge de `PersonalTransactions.tsx` + `FamilyTransactions.tsx`.
  - Form de transação: campo "Dividir" abre modal para splits; campo "Anexos" drag-n-drop; campo "Categoria" com autocomplete + indent para hierarquia.
  - Form de transferência: fluxo próprio acessível via CTA "Nova transferência" — escolhe origem (conta ou cartão), destino (conta ou cartão), valor, data, descrição.
  - Lista: ícone "📎" quando tem anexos; indentação/badge para mostrar categoria pai→filha; expandir linha para ver splits; menu "Reverter" na ação contextual.
  - Relatórios (Unit 10) fazem drill-down por categoria pai → filhas.
  - Settings (Unit 15): secção "Categorias personalizadas" para editar cor/ícone/nome de categorias seed (liga a `category_customizations`).
- **Implicações — Cross-scope transfers:**
  - Suportado por natureza do modelo (`from_*` e `to_*` podem pertencer a scopes diferentes).
  - UI pergunta explicitamente: "Transferir entre scopes?" quando origem e destino divergem, com aviso.
- **Evidência a preservar:**
  - Código duplicado a fundir: `src/features/personal/PersonalTransactions.tsx` + `src/features/family/FamilyTransactions.tsx` → `/app/transacoes`.
  - RPCs a depreciar/unificar: `get_personal_transactions`, `get_family_transactions`, `fn_goal_allocate`, `fn_goal_deallocate` (passam a alimentar `goal_ledger` de Unit 2).
  - Tabelas a apagar: `goal_allocations` (Unit 2 já decidiu). Remover coluna `transactions.transfer_group_id` (substituída por `transfers`). Remover coluna `transactions.goal_id` (substituída por `goal_ledger`).
  - Tabelas a reutilizar: `category_customizations` (finalmente ganha UI), `attachments` bucket Storage (reutilizado via `transaction_attachments`), RPC `ingest_receipt` (reutilizado em Unit 14).
  - Ficheiros a refactorizar: `src/services/transactions.ts`, `src/services/categories.ts`, `src/services/attachments.ts`, `src/services/importer.ts`, `src/validation/transactionSchema.ts`, `src/validation/categorySchema.ts`, `src/components/TransactionForm.tsx`, `src/components/TransactionList.tsx`, `src/components/CategoryForm.tsx`, hooks `useTransactions*`, `useCategories*`.
  - Testes a criar: transferência cross-account, cross-scope, envolvendo cartão (Unit 5); splits — soma valida; anexo — upload, delete, size limit; reversão — tx + cartão statement; hierarquia — eliminar pai com filhos; operation_id — idempotência em retry; seed de categorias PT com hierarquia.
  - Testes existentes a preservar: `tests/unit/services/transactions.test.ts`, `tests/integration/rls/transactions.spec.ts`, `src/validation/__tests__/transactionSchema.test.ts`.
- **Estado:** decidido

#### Unit 7: Goals
- **Data:** 2026-04-19
- **Decisão:** Oito sub-decisões: (1) alocação como **reserva** — dinheiro fica na conta origem e aparece como "reservado" (Opção B), `goal_ledger` é fonte da verdade, sem transações em `transactions` para alocações; (2) funding rules completas com cron/Edge Function agendada, 3 tipos (`fixed_monthly`, `income_percent`, `roundup_expense`) (Opção b); (3) tipo de goal expandido para incluir `amortization` (FK a `accounts` ou `credit_cards`), alocar = pagar dívida (Opção b); (4) prioridades (smallint 1-5) + drag-n-drop na lista + cascata em funding rules; (5) cálculo "precisas X€/mês" quando `data_limite` preenchida + badge de atraso vs progressão linear esperada; (6) contribuições em goals família com tracking obrigatório (`goal_ledger.created_by`) + meta individual opcional por contribuidor; (7) fluxo de completion com CTA "o que fazer?" (transferir para conta livre / snowball para outro goal / gastar / manter reservado); (8) limpeza alinhada com Units 1/2/3 — migrar `goal_allocations` → `goal_ledger`, apagar `goal_contributions`/`goal_deallocations`/`goal_funding_rules`, remover `accounts.is_goals` + conta Objetivos oculta, remover `goals.account_id` e colunas `valor_atual`/`valor_meta`.
- **Contexto:** Goals foi a zona mais debugada nos últimos commits — `ac98402 Goals-funcionais a 100%` resolveu delete incompleto, `f5be151` criou runbook de rollback da `fn_goal_delete_with_correct_logic`. Fluxo atual usa conta "Objetivos" oculta (marcada por `accounts.is_goals=true`, criada por `ensure_goals_account`) onde o dinheiro alocado é "guardado" via dupla-entrada em `transactions`. User nunca vê esta conta nem estas transações no extrato — viola mental model e causou os bugs que o runbook documenta. Funding rules tem UI + tabelas + RPCs mas sem cron → regras inertes. Data limite aceita valores sem lógica. Sem prioridades. Sem tracking de quem contribuiu em goal família. Sem fluxo de completion — dinheiro fica preso. `valor_atual` coluna coexiste com view derivada (confusão). `valor_meta` é dead code. Testes são os mais sólidos da app (unit + integration + E2E).
- **Razão:**
  - **(1) Reservado:** honesto mental model ("poupei sem mover"), alinhado com Unit 2 que decidiu kill `accounts.is_goals` e `goals.account_id`, reutiliza `saldo_disponivel`/`total_reservado` já presentes nas RPCs, evita artificialidade de conta oculta e simplicidade excessiva de modelo virtual.
  - **(2) Funding rules completas:** alinhadas com proposta de valor PT-payroll ("10% do ordenado vai para goal X" é feature killer); roundup é toque de qualidade de vida; Supabase tem `pg_cron` ou Edge Function agendada, infraestrutura pronta.
  - **(3) Amortização:** mesma mecânica mental ("poupar para objetivo Y"), empréstimos jovens e dívida de cartão são casos gigantes em PT; produto "controlo financeiro completo" sem amortização é incompleto.
  - **(4) Prioridades + drag-n-drop:** baixo custo, alto valor UX; prioridade cascata em funding rules resolve caso de "onde cai o 10% se tenho 3 goals".
  - **(5) Prazo com cálculo:** trivial computacionalmente, muito valor ("preciso de 127€/mês para o carro em Dezembro"); badge vermelho previne atraso silencioso.
  - **(6) Contribuições família:** tracking obrigatório é baseline honesto; meta individual é opcional (adesão de goal de casal vs indicador competitivo — user decide).
  - **(7) Completion CTA:** único momento de celebração da feature; também corrige onde hoje o dinheiro fica preso sem user perceber.
  - **(8) Limpeza:** já implícita em Units 1/2/3; migração mecânica porque volume é trivial (2 rows em `goal_allocations`, 20 em `goals`, 13 txs a migrar).
- **Depende de / Afeta:** Depende de Unit 1 (scope unificado), Unit 2 (`goal_ledger`, `amount_cents`, kill das tabelas obsoletas), Unit 5 (amortização referencia `credit_cards`), Unit 6 (`operation_id` obrigatório para alocar/desalocar; `reverse_transaction` aplica a alocações também). Afeta Unit 8 (budgets interagem com "reservado"? — decidir em Unit 8), Unit 9 (funding rules partilham cron com recorrentes; lembretes mensais de goals atrasados), Unit 10 (Dashboard mostra progresso agregado + atrasos), Unit 11 (Payroll integra com `income_percent` rules quando ordenado entra).
- **Implicações — Modelo de dados (DDL):**
  - **`goal_ledger`** (Unit 2 já criou conceito): `id uuid PK, goal_id FK, account_id? FK, credit_card_id? FK (CHECK XOR), tipo text ('allocate'|'deallocate'|'interest_accrued'|'completion_transfer'), amount_cents bigint, signed smallint, transaction_id? FK (apenas para completion que gera transação real), rule_id? FK goal_funding_rules, data date, created_by uuid FK auth.users, operation_id uuid UNIQUE, reversal_of? FK goal_ledger, created_at`.
  - **`goals`** (mudanças):
    - Adicionar `tipo text NOT NULL CHECK (tipo IN ('savings','amortization'))`, `target_account_id? FK accounts`, `target_credit_card_id? FK credit_cards` (CHECK: se `tipo='amortization'` então exatamente um está preenchido).
    - Adicionar `priority smallint CHECK 1-5 DEFAULT 3`, `order_index int`.
    - Remover `valor_atual`, `valor_meta` (derivado via view `goals_with_balance`).
    - Remover `account_id` (Unit 2).
    - Manter `data_limite`, adicionar `required_monthly_cents` coluna calculada via view.
  - **`goal_funding_rules`** (renomear e completar, não apagar — Unit 2 revisto por esta unit): `id, goal_id FK, tipo text ('fixed_monthly'|'income_percent'|'roundup_expense'), amount_cents? (fixed), percent numeric? (income), source_account_id? FK accounts (para fixed/income), active boolean, day_of_month smallint? (fixed), priority_cascade_enabled boolean, created_at`. **Supersedes** decisão Unit 2 de apagar esta tabela.
  - **`goal_contributors`** (nova): `goal_id FK, user_id FK auth.users, target_cents? bigint` (meta individual opcional), PK composta `(goal_id, user_id)`.
  - **Apagar:** `goal_allocations` (migrar rows para `goal_ledger`), `goal_contributions`, `goal_deallocations`.
  - **Apagar em `accounts`:** coluna `is_goals`; a conta "Objetivos" oculta existente (se houver dados) tem 13 transações a migrar.
  - **View `goals_with_balance`:** devolve `valor_atual_cents = SUM(goal_ledger.amount_cents * goal_ledger.signed)`, `progress_percent`, `required_monthly_cents`, `is_behind_schedule`.
  - **View `account_available_balance`:** `total_cents − SUM(reservado para goals ativos deste account)`; substitui cálculo disperso atual.
- **Implicações — Serviços/RPCs:**
  - **Novas RPCs (scope-aware):**
    - `allocate_to_goal(goal_id, source_account_id? | source_credit_card_id?, amount_cents, operation_id, description?)` — insere em `goal_ledger`, não cria transação em `transactions`.
    - `deallocate_from_goal(goal_id, target_account_id?, amount_cents, operation_id)` — insere contra-entrada em `goal_ledger`.
    - `complete_goal(goal_id, action text, target_account_id? | other_goal_id? | category_id?)` — materializa dinheiro reservado conforme escolha do user: `action='transfer'` cria `transfer` real; `action='snowball'` move reserva entre goals; `action='spend'` cria `transaction` + desreserva; `action='keep'` nada.
    - `pay_amortization_goal(goal_id, from_account_id, amount_cents, operation_id)` — paga dívida diretamente (não passa por `goal_ledger` de reserva — cria `transfer` real para o account/credit_card alvo e regista em `goal_ledger` tipo `allocate` com `transaction_id` preenchido).
    - `run_funding_rules(as_of date)` — idempotente, chamada por cron diário: executa `fixed_monthly` no `day_of_month`, `income_percent` quando deteta nova entrada de payroll (Unit 11), `roundup_expense` em despesas novas do dia anterior.
    - `get_goals_with_balance(scope)`, `get_goal_ledger(goal_id)`.
  - **Remover/depreciar:** `allocate_to_goal_with_transaction`, `deallocate_from_goal_with_transaction`, `ensure_goals_account`, `fn_goal_allocate`, `fn_goal_deallocate`, `fn_goal_delete_with_correct_logic` (substituída por `delete_goal_with_restoration_v2` que apenas limpa `goal_ledger`, não precisa mover dinheiro — já estava reservado).
  - `delete_goal_with_restoration` é grandemente simplificada: como o dinheiro nunca saiu das contas origem, só é preciso apagar as rows de `goal_ledger` e as reservas desaparecem automaticamente.
- **Implicações — UI:**
  - Página única `/app/objetivos` (Unit 1/3), merge de `PersonalGoals` + `FamilyGoals`.
  - Card de goal mostra: barra de progresso, `valor_atual_cents`/`valor_objetivo`, `required_monthly_cents` se prazo, badge de atraso, top 3 contribuidores (família), botão Alocar/Desalocar.
  - Modal de alocar: escolhe conta origem (filtro por `saldo_disponivel > 0`), valor, descrição; ao submeter, a conta mostra imediatamente novo `saldo_disponivel` reduzido.
  - Conta (Unit 5): na vista de conta, secção "Reservado" lista os goals que reservam e por quanto; link clicável; soma total bate com `total − disponível`.
  - Goal de amortização: em vez de "Alocar", CTA "Pagar dívida" → escolhe account origem → cria transfer real + regista em ledger; barra de progresso é "dívida reduzida".
  - Funding rules: secção colapsável em cada goal; "Adicionar regra" abre modal (tipo + parâmetros); lista de regras ativas com toggle on/off.
  - Completion: quando atinge 100%, card ganha "glow" + modal aparece com 4 CTAs (transferir / snowball / gastar / manter).
  - Drag-n-drop para reordenar; prioridade numérica editable no detalhe.
  - Contribuições (goals família): secção "Contribuições" com bar chart por user; se `target_cents` definido por contribuidor, mostra progresso individual.
- **Implicações — Scheduling:**
  - Criar Edge Function `run-daily-funding-rules` agendada às 03:00 Europa/Lisbon via `pg_cron` ou Supabase Scheduled Edge Functions.
  - Função lê todas as `goal_funding_rules.active=true`, filtra por tipo, chama `run_funding_rules(current_date)` idempotente.
  - `operation_id` gerado deterministicamente `hash(rule_id|date)` previne duplicações em retries.
- **Evidência a preservar:**
  - Código a refactorizar/substituir: `src/services/goals.ts`, `src/services/goalAllocations.ts`, `src/hooks/useGoals*.ts`, `src/components/GoalForm.tsx`, `src/components/GoalList.tsx`, `src/components/GoalCard*.tsx`, `src/components/GoalAllocationModal.tsx`, `src/components/GoalDeallocationModal.tsx`, `src/components/GoalFundingSection.tsx`, `src/validation/goalSchema.ts`, `src/shared/types/goals.ts`.
  - Páginas a unificar: `src/features/personal/PersonalGoals.tsx` + `src/features/family/FamilyGoals.tsx` → `/app/objetivos`.
  - RPCs a apagar/depreciar: `allocate_to_goal_with_transaction`, `deallocate_from_goal_with_transaction`, `ensure_goals_account`, `fn_goal_allocate`, `fn_goal_deallocate`, `fn_goal_delete_with_correct_logic`, `get_user_goal_progress`, `get_user_account_reserved`, `get_personal_goals`/`get_family_goals` (unificar).
  - Migrações em produção: 2 rows de `goal_allocations` → `goal_ledger`; 13 txs da conta oculta Objetivos a migrar (fazer dry-run e verificar); 20 goals a receber `tipo='savings'` default + migrar `account_id`; apagar conta Objetivos oculta após migração.
  - Tabelas a apagar: `goal_allocations`, `goal_contributions`, `goal_deallocations`.
  - Colunas a apagar: `accounts.is_goals`, `goals.account_id`, `goals.valor_atual`, `goals.valor_meta`.
  - Supersedes: Unit 2 decidiu apagar `goal_funding_rules` — **esta decisão supersedes essa parte**: a tabela fica mas é remodelada. Unit 2 entrada a atualizar com `Superseded by: Unit 7 (2026-04-19) — apenas quanto a goal_funding_rules`.
  - Runbook a atualizar: `docs/runbooks/*goals*` — novo runbook pós-migração ledger; preservar snapshot antigo em `docs/superpowers/specs/archive/`.
  - Testes existentes a preservar: `src/validation/__tests__/goalSchema.test.ts`, `src/validation/__tests__/goalAllocationSchema.test.ts`, `tests/unit/services/goals.test.ts`, `tests/integration/goals/goal-canonical-functions.test.ts`, `cypress/e2e/goals.cy.ts`.
  - Testes novos: reserva não cria transação em `transactions`, `saldo_disponivel` reflete reservas, funding rule `income_percent` dispara em entrada de payroll, `roundup_expense` arredonda corretamente, amortização de cartão cria `transfer` real, completion com cada uma das 4 CTAs, drag-n-drop reorder persiste, contribuição individual vs meta familiar, migração de `goal_allocations` para `goal_ledger` preserva totais.
- **Estado:** decidido

#### Unit 8: Budgets
- **Data:** 2026-04-19
- **Decisão:** Dez sub-decisões: (1) granularidade mensal + anual (Opção b), `period_type ('monthly'|'yearly')` + `period_key`; (2) template recorrente via flag `is_template` + cron mensal copia templates para novo mês (Opção b); (3) hierarquia de categorias (Unit 6) — budgets independentes em pai e filhos (Opção c), check suave quando soma dos filhos excede pai; (4) rollover escolhido por budget via `rollover_mode ('reset'|'accumulate'|'transfer_to_goal')` (Opção c), default = reset; (5) manter modelo flexível/soft-cap — nunca bloquear transações (Opção a); (6) budget família híbrido — agregado por default + meta pessoal opt-in por contribuidor (Opção c); (7) projection linear (`gasto_até_hoje / dias_decorridos * dias_no_mês`) + badge "projeção a ultrapassar" (Opção b); (8) notificações in-app baseline via Unit 9 + email opt-in via Unit 15, nos thresholds 80%, 100% e "projeção a ultrapassar a meio do mês" (Opção c); (9) goals Unit 7 — reserva **não** conta para budget, spend-no-completion **conta** para budget da categoria escolhida; (10) limpeza: constraints `ON DELETE RESTRICT` em `budgets.categoria_id`, enforcement de coerência scope, apagar radio "anual" morto, unificar páginas Personal+Family em `/app/orcamentos`, criar testes (unit + integration + E2E).
- **Contexto:** Hoje `budgets(user_id, family_id?, categoria_id, valor, mes)` onde `mes` é string `YYYY-MM`. View `budget_progress` agrega `transactions.tipo='despesa'` por mês+categoria. Só mensal, sem template, sem rollover, sem envelope, sem projection, sem forecast, sem notificações fora do UI. Cores 0-79% verde / 80-99% amarelo / ≥100% vermelho. Budget família é agregado, sem sub-budgets por user. Sem `ON DELETE CASCADE` entre `budgets.categoria_id` e `categories.id` — órfãos possíveis. Radio "anual" existe em BudgetForm mas é dead UI. Testes praticamente inexistentes (1 mock).
- **Razão:**
  - **(1) Mensal + anual:** anual cobre subsídios, férias, IRS — contextualmente PT; semanal e custom range são overengineering.
  - **(2) Template + cron:** 90% dos budgets são iguais mês a mês; criar à mão é fricção; reutiliza infraestrutura de cron da Unit 7.
  - **(3) Hierarquia com ambos:** dá liberdade ao user decidir nível, sem restrições artificiais; check suave avisa sem bloquear.
  - **(4) Rollover por budget:** diferentes categorias beneficiam de modos diferentes; `transfer_to_goal` cria um loop virtuoso com Unit 7 (sobrou em Roupa → vai para goal de férias).
  - **(5) Flexível:** bloquear transações é abrasivo e não reflete finanças reais; alertas + projection são suficientes; YAGNI sobre envelope.
  - **(6) Família agregado + meta pessoal:** agregado é baseline honesto; meta pessoal dá consciência sem impor competição.
  - **(7) Projection linear:** trivial, suficientemente informativo; ML é overhead sem valor para caso típico.
  - **(8) In-app + email opt-in:** in-app é baseline; email opt-in respeita utilizador; SMS/push são futuro.
  - **(9) Reserva não conta; spend conta:** coerente com Unit 7 (reserva = earmark, não consumo); completion spend gera transação normal que naturalmente conta.
  - **(10) Limpeza:** baseline para qualidade do produto; apagar UI morta evita confusão; constraints previnem orfãos.
- **Depende de / Afeta:** Depende de Unit 1 (scope unificado), Unit 2 (`amount_cents`), Unit 6 (splits contam categoricamente, hierarquia pai/filho), Unit 7 (reservas não contam, spend-no-completion sim). Afeta Unit 9 (reutiliza cron para clonar templates e para lembretes de threshold; `run_monthly_budget_rollover` corre no dia 1 de cada mês), Unit 10 (Dashboard e Reports mostram progress + projection agregado), Unit 11 (budgets anuais podem consumir entradas de payroll — subsídios; integração futura), Unit 14 (importer atualiza `budget_progress` via triggers já existentes), Unit 15 (Settings tem opção "Notificações por email — thresholds de budget").
- **Implicações — Modelo de dados (DDL):**
  - **`budgets` (mudanças):**
    - Renomear `valor` → `amount_cents bigint` (Unit 2).
    - Adicionar `period_type text NOT NULL CHECK (period_type IN ('monthly','yearly')) DEFAULT 'monthly'`.
    - Renomear `mes` → `period_key text` — formato `YYYY-MM` para monthly, `YYYY` para yearly; CHECK pattern baseado em `period_type`.
    - Adicionar `is_template boolean NOT NULL DEFAULT false` — template não tem `period_key` específico, é "recipe".
    - Adicionar `rollover_mode text CHECK (rollover_mode IN ('reset','accumulate','transfer_to_goal')) DEFAULT 'reset'`.
    - Adicionar `rollover_target_goal_id uuid? FK goals(id)` — só relevante se `rollover_mode='transfer_to_goal'`.
    - Adicionar `notify_thresholds smallint[] DEFAULT '{80,100}'` — permite user personalizar % de alerta.
    - Adicionar `currency text NOT NULL DEFAULT 'EUR'`.
    - Constraint: `ON DELETE RESTRICT` em `categoria_id` — categoria só pode ser apagada se não houver budgets ativos (UI oferece "mover budgets para outra categoria").
    - Scope check: se `family_id IS NULL`, `categoria_id` deve referenciar categoria pessoal ou sistema; se `family_id IS NOT NULL`, deve referenciar categoria dessa família ou sistema.
  - **`budget_personal_targets` (nova):** `budget_id FK, user_id FK auth.users, target_cents bigint`, PK `(budget_id, user_id)`. Só usado quando `family_id IS NOT NULL` e user quer meta pessoal dentro do budget família.
  - **View `budget_progress` (mudanças):**
    - Derivar `period_start`/`period_end` do `period_key` conforme `period_type`.
    - Somar splits: agregar `transaction_splits.amount_cents` por `categoria_id` + junta transactions sem splits por `categoria_id` direto.
    - Incluir hierarquia: opcionalmente expandir `categoria_id` para incluir filhos quando budget é definido no pai e não há budget no filho (comportamento "drill-down").
    - Excluir `transactions` com `goal_ledger` de reserva pura (nenhum impacto pois reservas não criam transações — mas documentar).
    - Calcular `projected_end_cents = gasto_atual * (total_days_in_period / days_elapsed)`.
    - Calcular `is_projected_over = projected_end_cents > amount_cents`.
  - **Função `run_monthly_budget_rollover(target_month date)` — idempotente:**
    - Para cada budget `is_template=true`, cria cópia com `period_key` do novo mês (se não existe já).
    - Para cada budget `is_template=false` do mês anterior com `rollover_mode='accumulate'`, adiciona `(amount_cents - spent_cents)` ao novo mês.
    - Para `rollover_mode='transfer_to_goal'`, cria entrada em `goal_ledger` para o goal alvo com `amount = amount_cents - spent_cents` (se positivo).
    - `operation_id = hash(template_id|target_month)` previne duplicação.
  - **View `budget_family_contribution_by_user`:** agregação per-user de gasto em cada budget família; alimenta UI "quanto cada member contribui".
- **Implicações — Serviços/RPCs:**
  - Novas RPCs (scope-aware via Unit 1): `create_budget(...)`, `update_budget(...)`, `delete_budget(...)`, `get_budgets(scope, period_type?, period_key?)`, `get_budget_progress(budget_id)`, `clone_budget_to_next_period(budget_id)` (manual), `set_personal_target(budget_id, target_cents)` (dentro de budget família).
  - Unificar `get_personal_budgets`/`get_family_budgets` em `get_budgets(scope)`.
  - RPC `check_budget_before_transaction(amount, categoria_id, date)` devolve `'ok' | 'warn_80' | 'warn_100' | 'projected_over'` para UI mostrar pre-warning ao criar transação (não bloqueia).
- **Implicações — UI:**
  - Página única `/app/orcamentos` (Unit 1/3).
  - Toggle período: Mensal ↓ | Anual ↓; seletor de mês/ano; botão "Ver templates" abre secção de templates.
  - Card de budget: barra de progresso + projection badge (cinza "no ritmo" / amarelo "projeção 95%" / vermelho "projeção ultrapassar").
  - Hierarquia: card de categoria pai mostra barra agregada + expandir para ver filhos; se houver budget em pai e filhos, mostra dois progressos (próprio + agregado).
  - Em família: toggle "Ver contribuições" expande per-user chart; se user definiu meta pessoal, mostra progresso individual.
  - Rollover: icon no card indica modo (♻️ accumulate, ↺ reset, 🎯 transfer_to_goal); configurável no form.
  - Template: flag "📋 Template" no card; edição do template não afeta meses passados, só futuros.
  - Form: remover dead radio "anual"; substituir por select `period_type`; quando `rollover_mode='transfer_to_goal'`, aparece seletor de goal.
  - BudgetForm pre-warns user quando cria transação e categoria tem budget >80%.
- **Implicações — Notificações:**
  - Quando `budget_progress.progress_percent` cruza 80% ou 100%, ou `is_projected_over=true` pela primeira vez no mês, inserir em `reminders` (Unit 9) com tipo `budget_threshold`.
  - User opt-in (Unit 15) em email: cron noturno lê `reminders` do dia e envia digest.
- **Evidência a preservar:**
  - Código a refactorizar/substituir: `src/services/budgets.ts`, `src/hooks/useBudgets*.ts`, `src/components/BudgetCard.tsx`, `src/components/BudgetForm.tsx`, `src/components/BudgetList.tsx`, `src/validation/budgetSchema.ts`, `src/shared/types/budgets.ts`.
  - Páginas a unificar: `src/features/personal/PersonalBudgets.tsx` + `src/features/family/FamilyBudgets.tsx` + `src/pages/BudgetsPage` → `/app/orcamentos`.
  - RPCs a depreciar/unificar: `get_personal_budgets`, `get_family_budgets` → `get_budgets(scope, ...)`.
  - UI morta a apagar: radio "anual" em BudgetForm (substituído por `period_type`).
  - View `budget_progress` a reescrever: passa a considerar splits (Unit 6), projection, hierarquia, rollover.
  - Testes existentes a preservar: `budgets.spec.ts` (expandir).
  - Testes novos: rollover modes (accumulate soma, reset zera, transfer_to_goal cria ledger entry), template copia para novo mês, hierarquia pai+filho simultâneos, projection linear calcula correto, budget anual agrega 12 meses, família agregado vs meta pessoal, split conta para cada categoria, threshold 80% dispara reminder.
- **Estado:** decidido

#### Unit 9: Recorrentes & Lembretes
- **Data:** 2026-04-19
- **Decisão:** Dez sub-decisões: (1) motor híbrido via `recurring_rules.execution_mode text CHECK IN ('auto','confirm')` — `auto` materializa diretamente em `transactions`, `confirm` cria `recurring_instances` pendente (Opção c); (2) `amount_mode text CHECK IN ('fixed','variable','estimated')` — `variable` força `execution_mode='confirm'`, `estimated` usa último valor como sugestão; (3) padrões custom via `schedule_type text CHECK IN ('daily','weekly','monthly','yearly','custom')` + `interval smallint` + `day_of_month smallint?` + `weekday_of_month smallint?` + `weekday_ordinal smallint?` — sem RRULE completo (Opção b); (4) `reminders` deixa de ser tabela ad-hoc e passa a ser **inbox unificada** `inbox_items(source_type, source_id, user_id, family_id?, due_at, status)` alimentada por instâncias pendentes, thresholds de budget (Unit 8), deadlines de goals (Unit 7) e user reminders manuais (Opção b); (5) novo tipo `recurring_rules.type='credit_card_payment'` com FK `credit_card_id` (pagamento programado do extrato + anuidade anual da Unit 5); (6) consolidar todos os crons existentes num único Edge Function `daily-scheduler` a correr às 03:00 Europe/Lisbon, que orquestra sequencialmente: `run_funding_rules` (Unit 7), `run_recurring_rules` (Unit 9), `run_monthly_budget_rollover` se dia 1 (Unit 8), `generate_threshold_reminders` (Unit 8/9), `send_push_notifications` (Unit 15); (7) fuso horário: mudar agendamento de UTC para Europe/Lisbon; adicionar `profiles.timezone text NOT NULL DEFAULT 'Europe/Lisbon'` para futura internacionalização; (8) nova rota `/app/inbox` como único ponto de ação diária — lista instâncias em `confirm` pendentes, thresholds de budget, deadlines próximas e lembretes manuais, com ações inline (confirmar/editar valor, dismiss, snooze); (9) importador (Unit 14) faz fuzzy match `(amount_cents, date±2d, counterparty, account_id)` entre transação importada e `recurring_instances` pendentes — se match, marca instância como `posted` ligando `transaction_id` em vez de duplicar; (10) limpeza: apagar tabela `fixed_expenses` + `src/services/fixed_expenses.ts` + `src/components/FixedExpensesList.tsx` (substituídos por `recurring_rules` com `type='expense'`), unificar páginas Personal/Family em `/app/recorrentes`, adicionar RLS em `inbox_items.family_id`, apagar crons `reminders-push-cron` e `goal-funding-cron` (absorvidos pelo `daily-scheduler`), apagar código morto que escreve diretamente em `reminders`.
- **Contexto:** Hoje existe `recurring_rules(user_id, family_id?, type, amount, categoria_id, schedule)` + `recurring_instances(rule_id, due_date, status)` com UNIQUE `(rule_id, due_date)` — **mas não há cron que popule `recurring_instances`**. Existe `reminders(user_id, family_id?, title, due_at, frequency)` onde o campo `frequency` fica perdido na persistência (apenas título). Existe `fixed_expenses` legacy paralelo a `recurring_rules` com sobreposição semântica. Existe tabela `push_subscriptions` e função `reminders-push-cron` que envia pushes uma vez por lembrete mas não há confirmação nem UI de gestão. `goal-funding-cron` (Unit 7) e rollover mensal (Unit 8) são crons separados, cada um UTC, o que confunde em PT (03:00 UTC = 04:00/05:00 Lisboa dependente de DST). Não existe noção de "inbox" — user tem que ir a cada página verificar o seu estado.
- **Razão:**
  - **(1) Híbrido auto/confirm:** 80% dos casos (ordenado, renda, Netflix) têm valor fixo previsível — `auto` poupa clicks; restantes (água, luz, mercearia variável) beneficiam de confirmação humana; `confirm` também permite edição antes de materializar. Evita tanto automação cega como fricção universal.
  - **(2) `amount_mode`:** captura a diferença entre "sei exatamente" vs "mais ou menos" vs "nunca o mesmo"; `variable` força `confirm` porque persistir valor errado é pior que pedir input; `estimated` preenche form com último valor mas deixa o user ajustar.
  - **(3) Padrões sem RRULE:** interval + day_of_month + weekday_of_month cobre ≥95% de casos reais (quinzenalmente, "primeira sexta do mês", "todos os 25"); RRULE completo é overhead para 5% de casos esquisitos.
  - **(4) Inbox unificado:** hoje o user não tem um sítio para "o que precisa da minha atenção". Consolida 4 fontes (instâncias, thresholds, deadlines, manuais) num único pattern `inbox_items` com `source_type`, simplificando UI e código. Elimina a tabela `reminders` incoerente.
  - **(5) `credit_card_payment`:** integra o ciclo de cartão de crédito (Unit 5) — pagamento programado do extrato e anuidade anual — no mesmo motor em vez de código separado.
  - **(6) Cron único:** reduz superfície operacional de 3 crons separados para 1 Edge Function; sequência ordenada evita race conditions (rollover antes de funding antes de threshold); facilita logging/monitoring unificado.
  - **(7) Europe/Lisbon:** user é PT, cron faz sentido em PT; `profiles.timezone` dá base para futura expansão (nunca é prematuro preparar).
  - **(8) Rota `/app/inbox`:** único ponto de entrada para ação diária do user; reduz fricção de "onde é que vou ver o que tenho de fazer hoje?"; engajamento.
  - **(9) Dedup no importador:** sem isto, user importa extrato bancário e vê tudo duplicado (transação importada + instância materializada). Match fuzzy preserva intenção do recurring rule (categoria, notas) mas reconcilia com realidade bancária.
  - **(10) Limpeza:** `fixed_expenses` é débito puro — ter dois mecanismos paralelos para a mesma intenção confunde e duplica bugs; RLS em `inbox_items.family_id` é obrigatório por Unit 1.
- **Depende de / Afeta:** Depende de Unit 1 (scope unificado), Unit 2 (`amount_cents`, `operation_id`), Unit 5 (FK `credit_cards` para `credit_card_payment`), Unit 6 (transações criadas herdam `operation_id` estável da instância — idempotência), Unit 7 (funding rules reutilizam o cron único), Unit 8 (thresholds emitem para `inbox_items`). Afeta Unit 14 (importador precisa implementar fuzzy match contra `recurring_instances` pendentes e marcar `posted`), Unit 15 (Settings tem `timezone` + opt-in de push/email por tipo de inbox item), Unit 16 (observabilidade do `daily-scheduler` — logs, alertas se falhar).
- **Supersedes:** Unit 2 parcialmente quanto a `fixed_expenses` (apagada) e a estrutura de `reminders` (substituída por `inbox_items`).
- **Implicações — Modelo de dados (DDL):**
  - **`recurring_rules` (mudanças):**
    - Renomear `amount` → `amount_cents bigint` (Unit 2).
    - Adicionar `execution_mode text NOT NULL CHECK (execution_mode IN ('auto','confirm')) DEFAULT 'confirm'`.
    - Adicionar `amount_mode text NOT NULL CHECK (amount_mode IN ('fixed','variable','estimated')) DEFAULT 'fixed'`.
    - Constraint: `amount_mode='variable' => execution_mode='confirm'`.
    - Adicionar `schedule_type text NOT NULL CHECK (schedule_type IN ('daily','weekly','monthly','yearly','custom'))`.
    - Adicionar `interval smallint NOT NULL DEFAULT 1` — cada N unidades de `schedule_type`.
    - Adicionar `day_of_month smallint? CHECK (day_of_month BETWEEN 1 AND 31)`.
    - Adicionar `weekday smallint? CHECK (weekday BETWEEN 0 AND 6)` — 0=domingo.
    - Adicionar `weekday_ordinal smallint? CHECK (weekday_ordinal BETWEEN 1 AND 5)` — "primeira sexta" = (weekday=5, weekday_ordinal=1).
    - Adicionar `type text CHECK (type IN ('income','expense','transfer','credit_card_payment')) NOT NULL`.
    - Adicionar `credit_card_id uuid? FK credit_cards(id)` — obrigatório se `type='credit_card_payment'`.
    - Adicionar `next_due_at date NOT NULL` — precomputado para scan rápido do cron.
    - Adicionar `last_run_at timestamptz?`.
    - Adicionar `active boolean NOT NULL DEFAULT true`.
    - Adicionar `end_date date?` — rule expira automaticamente.
  - **`recurring_instances` (mudanças):**
    - Manter `(rule_id, due_date)` UNIQUE.
    - Renomear `amount` → `amount_cents bigint?` (pode ser null até user confirmar em modo `variable`).
    - Adicionar `status text NOT NULL CHECK (status IN ('pending','confirmed','posted','skipped','failed')) DEFAULT 'pending'`.
    - Adicionar `transaction_id uuid? FK transactions(id)` — ligada após materialização ou importador dedup.
    - Adicionar `operation_id text NOT NULL` = `hash(rule_id|due_date)` — idempotência Unit 2.
    - Adicionar `confirmed_at timestamptz?`, `posted_at timestamptz?`.
  - **`inbox_items` (nova):**
    - `id uuid PK`, `user_id uuid NOT NULL FK auth.users`, `family_id uuid? FK families`, `source_type text NOT NULL CHECK (source_type IN ('recurring_instance','budget_threshold','goal_deadline','manual'))`, `source_id uuid NOT NULL`, `title text NOT NULL`, `body text?`, `due_at timestamptz NOT NULL`, `status text NOT NULL CHECK (status IN ('pending','snoozed','done','dismissed')) DEFAULT 'pending'`, `snoozed_until timestamptz?`, `created_at timestamptz NOT NULL DEFAULT now()`, `completed_at timestamptz?`.
    - Índices: `(user_id, status, due_at)` para listagem; `(source_type, source_id)` para upsert idempotente.
    - RLS: user vê os seus + os da sua família.
  - **`profiles` (adição):** `timezone text NOT NULL DEFAULT 'Europe/Lisbon'`.
  - **Migração de `reminders` → `inbox_items`:** copiar registos existentes com `source_type='manual'`, `source_id = reminders.id`; depois apagar tabela `reminders`.
  - **Apagar `fixed_expenses`:** migrar linhas ativas para `recurring_rules(type='expense', execution_mode='auto', amount_mode='fixed')`; depois drop.
- **Implicações — Serviços/RPCs / Edge Functions:**
  - Nova Edge Function `daily-scheduler` agendada via `pg_cron` em `Europe/Lisbon 03:00` (pg_cron suporta timezone) — sequencial:
    1. `SELECT run_funding_rules();` (Unit 7)
    2. `SELECT run_recurring_rules();` (Unit 9)
    3. `IF EXTRACT(DAY FROM now() AT TIME ZONE 'Europe/Lisbon')=1 THEN SELECT run_monthly_budget_rollover(...); END IF;`
    4. `SELECT generate_threshold_reminders();`
    5. `SELECT send_push_notifications();`
    - Cada step em transação própria; falha em um não aborta os seguintes (log + alerta).
    - Idempotente por `operation_id` ou por step-date key.
  - `run_recurring_rules()`:
    - Para cada `recurring_rules` com `active=true`, `end_date IS NULL OR end_date >= today` e `next_due_at <= today`:
      - Se `execution_mode='auto'`: chama `create_transaction(...)` (ou `create_transfer(...)` / `create_credit_card_payment(...)`) com `operation_id=hash(rule_id|next_due_at)`; atualiza `last_run_at`, avança `next_due_at` conforme schedule.
      - Se `execution_mode='confirm'`: upsert em `recurring_instances(rule_id, due_date=next_due_at, status='pending')`; insere em `inbox_items(source_type='recurring_instance', source_id=instance.id, ...)`; avança `next_due_at`.
    - Função `compute_next_due(rule, from_date)` aplica regras de `schedule_type`/`interval`/`day_of_month`/`weekday`/`weekday_ordinal`.
  - RPCs novas (scope-aware via Unit 1):
    - `create_recurring_rule(...)`, `update_recurring_rule(...)`, `pause_recurring_rule(id)`, `delete_recurring_rule(id)`.
    - `confirm_recurring_instance(instance_id, amount_cents_override?, notes?)` → cria transação, liga `transaction_id`, marca `status='posted'`, marca inbox item `done`.
    - `skip_recurring_instance(instance_id, reason?)` → `status='skipped'`, inbox item `dismissed`.
    - `list_inbox(scope, status?, limit?, offset?)`.
    - `snooze_inbox_item(id, until)`, `complete_inbox_item(id)`, `dismiss_inbox_item(id)`.
    - `create_manual_reminder(scope, title, body?, due_at)` (Unit 15 é onde user cria).
  - Apagar:
    - Edge Function `reminders-push-cron` (absorvida por step 5 do `daily-scheduler`).
    - Edge Function `goal-funding-cron` se existir separada (absorvida por step 1).
    - `fixed_expenses` RPCs/service.
- **Implicações — UI:**
  - Página única `/app/recorrentes` (Unit 1/3) substitui `PersonalRecurring` + `FamilyRecurring` + `FixedExpensesList`.
  - Form de criação: wizard compacto — (a) tipo (receita/despesa/transfer/pagamento cartão), (b) montante + `amount_mode`, (c) schedule visual (botões rápidos "Mensal no dia X", "Semanal à sexta", "Primeira sexta do mês", "Custom"), (d) `execution_mode` toggle "Automático | Pedir confirmação" com default baseado em `amount_mode`.
  - Card de rule: próxima data, badge do modo (⚡ auto / ✋ confirm), histórico das últimas 3 instâncias, ações pause/edit/delete.
  - Nova rota `/app/inbox`: lista agrupada por secção (Hoje / Esta semana / Atrasados), cada item com ações inline; filtro por `source_type`; badge no sidebar com contagem `status='pending' AND due_at <= now()`.
  - BottomTabBar/Sidebar: adicionar entrada "Inbox" com badge.
- **Implicações — Notificações:**
  - `send_push_notifications()` lê `inbox_items` novos desde última execução; envia via `push_subscriptions` (Web Push) e/ou email (Unit 15 opt-in) conforme preferência por `source_type`.
  - Digest em vez de push-por-item (reduz ruído): "Tens 3 coisas pendentes na tua inbox".
- **Evidência a preservar:**
  - Apagar: tabela `fixed_expenses`; `src/services/fixed_expenses.ts`; `src/components/FixedExpensesList.tsx`; `src/pages/FixedExpenses*`; Edge Functions `reminders-push-cron` e `goal-funding-cron`; tabela `reminders` (depois de migração); radio `frequency` perdido no form de reminders manuais.
  - Refactor: `src/services/recurring.ts`; `src/hooks/useRecurring*.ts`; `src/components/RecurringForm.tsx`; `src/components/RecurringList.tsx`; validar contra `Zod` com `amount_cents`.
  - Migrar: linhas de `fixed_expenses` → `recurring_rules`; `reminders` → `inbox_items`; `push_subscriptions` mantém-se mas só consumida pelo `send_push_notifications` do `daily-scheduler`.
  - RPCs a depreciar: `get_personal_recurring`, `get_family_recurring` → `get_recurring_rules(scope)`; qualquer RPC que escreva em `reminders` direto.
  - Testes novos: `auto` materializa transação sem input, `confirm` cria instância e inbox item, `variable` força `confirm`, dedup no importador marca instância `posted`, cron único executa todos os steps em ordem, timezone Europe/Lisbon respeita DST, `credit_card_payment` cria transfer Conta→Cartão, `end_date` desativa rule, `skip` não avança próximo due, `snooze` recoloca inbox item à hora certa, RLS família bloqueia user de outra família.
- **Estado:** decidido

---

## 7. Histórico do documento

- **2026-04-18** — Criação. Processo, mapa e formato acordados. Decision log vazio.
- **2026-04-18** — Revisão pós-reviewer: adicionados estados `parked-aceite` e `superseded`; protocolos de revisão de decisões anteriores, retoma de `parked`, e retoma de sessão; campos `Depende de / Afeta`, `Evidência a preservar` e `Supersedes / Superseded by` no decision log.
- **2026-04-19** — Decisões registadas: Unit 1 (scope como estado), Unit 2 (refactor incremental do modelo de dados), Unit 3 (flat sidebar + scope toggle), Unit 4 (cleanup auth + onboarding híbrido + OAuth em breve), Unit 5 (separar `credit_cards` de `accounts`, nível avançado, FK dupla + CHECK, currency/order/soft-delete), Unit 6 (transfers como tabela própria + trigger, splits, anexos, hierarquia 1-nível em categorias, sem datas futuras, idempotência obrigatória + reversão universal), Unit 7 (alocação como reserva via `goal_ledger`, funding rules completas com cron + 3 tipos, amortização genérica, prioridades + cascata, cálculo de prazo, contribuições multi-user, fluxo de completion; supersedes parcialmente Unit 2 quanto a `goal_funding_rules`), Unit 8 (budgets mensal+anual, templates recorrentes, rollover por budget, hierarquia pai/filho simultâneos, flexível soft-cap, família agregado + meta pessoal opt-in, projection linear, notificações in-app + email opt-in), Unit 9 (motor híbrido auto/confirm com `execution_mode`, `amount_mode` variable força confirm, `schedule_type` expandido com day_of_month/weekday_ordinal, `reminders` substituído por `inbox_items` unificado, tipo `credit_card_payment`, cron único `daily-scheduler` Europe/Lisbon, rota `/app/inbox`, dedup fuzzy no importador para Unit 14, apagar `fixed_expenses` + crons antigos).
