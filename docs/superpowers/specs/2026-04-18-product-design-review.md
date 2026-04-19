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

#### Unit 10: Dashboard / Reports / Insights / Cashflow
- **Data:** 2026-04-19
- **Decisão:** Dez sub-decisões: (1) Dashboard passa a **respeitar o scope toggle global** da Unit 1 (adapta widgets conforme personal/família), removendo o hardcode pessoal (Opção b); (2) **absorver Insights no Dashboard** como secção `<DashboardInsights />` (2-3 cards contextuais: anomaly mês-vs-mês-1, categoria em alta, risco de budget); apagar página `/personal/insights` e o `pages/Insights.tsx` dead (Opção b); (3) Cashflow passa a **timeline unificada `−30d → +90d`** centrada numa linha vertical "agora", slider configurável (default 30/60), eliminando o gap histórico↔futuro entre Reports e Cashflow (Opção c); (4) Cashflow projeta **recurring_rules (auto + confirm pendentes marcados `⚠️`) + Unit 7 funding rules + credit_card_payment (Unit 9) + deadlines de goals**, nesta primeira iteração sem overlay de budgets (Opção b); (5) widgets do Dashboard MVP pós-refactor: Saldo Total (contas + cartões), Inbox badge (Unit 9), Este mês (income/expense/saldo), Budgets em risco (≥80% ou `is_projected_over` da Unit 8), Goals (reservas + % prazo da Unit 7), Próximos 14 dias cashflow (sparkline), Recentes transações (5); remover "Account Distribution" pie e "Today's Reminders" (absorvido pelo Inbox); (6) **unificar RPCs** em `get_kpis(scope, date_start, date_end, exclude_transfers)` e `get_category_breakdown(scope, date_start, date_end, kind)` scope-aware (Unit 1), deprecar `get_personal_kpis`/`get_family_kpis`/`get_family_category_breakdown` (Opção b); (7) Reports refactor = `amount_cents` + splits (Unit 6) + nova `get_kpis` + tab **"Análise anual"** (subsídios, IRS, cumulative savings — coerente com Unit 8 anual); Forecast fica no Cashflow; (8) **sem materialized views por agora** — manter RPCs + memoization frontend; reavaliar só quando houver >24 meses de data real com lentidão (YAGNI); (9) **unificar exports** num único `src/services/exportService.ts` com `exportTransactions()`, `exportReport()`, `exportCashflow()`, absorvendo a lógica de Insights e Cashflow; manter lazy-load do `ReportExport`; (10) limpeza: apagar `src/pages/Insights.tsx` (41KB dead), apagar `src/features/personal/PersonalInsights.tsx` após migrar para `<DashboardInsights />`, remover `navigate('/personal/transactions')` hardcoded do Dashboard → URLs scope-aware, remover placeholder comentado de credit card em `cashflowService.ts:137` e implementar via `credit_card_payment` da Unit 9.
- **Contexto:** Hoje o Dashboard ([src/pages/Dashboard.tsx](src/pages/Dashboard.tsx), ~19KB) é **hardcoded personal** (chama `get_personal_kpis()`, hooks pessoais, navega para `/personal/...`) — viola Unit 1. Reports ([src/pages/reports.tsx](src/pages/reports.tsx), ~40KB) é scope-aware via `familyId` do contexto, usa RPCs família (`get_family_kpis`, `get_family_category_breakdown`), tem 5 tabs funcionais. Insights está em dois sítios: `src/pages/Insights.tsx` (41KB **dead code**, não routed em App.tsx) e `src/features/personal/PersonalInsights.tsx` (50 linhas, routed em `/personal/insights`, não em `/app`). Cashflow ([src/pages/cashflow.tsx](src/pages/cashflow.tsx) + [src/components/cashflow/CashflowView.tsx](src/components/cashflow/CashflowView.tsx)) é forward-only 30d, projeta `recurring_rules` + `goal_funding_rules`, com credit card como placeholder comentado. Não existe widget de Inbox (Unit 9) no Dashboard, não existe overlay de reservas de goals (Unit 7) nem de `is_projected_over` de budgets (Unit 8). Reports e Dashboard recalculam KPIs com RPCs distintas.
- **Razão:**
  - **(1) Scope-aware Dashboard:** coerência com Unit 1. Um user com família precisa de ver a família quando está em modo família e vice-versa — hardcoded personal é bug.
  - **(2) Insights dentro do Dashboard:** reduz rotas (menos navegação para ver valor), elimina 41KB de dead code e a duplicação semântica `/personal/insights` vs `/app/insights`; 2-3 cards contextuais entregam o essencial sem uma página dedicada.
  - **(3) Timeline unificada:** o gap "Reports = passado, Cashflow = futuro" é artificial para o user; ver o próprio "agora" no contexto de −30d/+90d é muito mais informativo; slider evita sobrecarga.
  - **(4) Scope de projeção:** aceitar (b) em vez de (c) mantém a vista legível nesta iteração; overlay de budgets é candidato óbvio para Unit 16 ou backlog pós-launch.
  - **(5) Widgets MVP:** cada widget responde a uma pergunta real ("posso gastar?", "tenho coisas pendentes?", "como vai o mês?", "vou ultrapassar algum budget?", "onde estão os meus goals?", "o que aí vem?", "o que fiz agora?"). Pie chart de distribuição tinha baixo valor diário.
  - **(6) `get_kpis` unificada:** três RPCs para o mesmo conceito é superfície a mais; Unit 1 impõe `scope` como estado.
  - **(7) Análise anual:** subsídios e IRS são inerentemente anuais em PT; Reports é o sítio natural para isso. Forecast é visual e temporal — pertence ao Cashflow.
  - **(8) Sem MV agora:** user tem poucos meses de data real e os RPCs respondem rápido; YAGNI; MV traz complexidade de refresh e invalidações.
  - **(9) ExportService único:** DRY; testes concentrados; format consistente (PDF/CSV/Excel) entre features.
  - **(10) Limpeza:** 41KB de dead code é ruído; URLs hardcoded quebram Unit 1.
- **Depende de / Afeta:** Depende de Unit 1 (scope toggle), Unit 2 (`amount_cents`), Unit 6 (splits contam em breakdown), Unit 7 (reservas + deadlines nos widgets e cashflow), Unit 8 (budgets em risco + `is_projected_over`), Unit 9 (inbox badge + `credit_card_payment` projetado + instâncias pendentes marcadas). Afeta Unit 14 (importer atualiza dados que alimentam KPIs — `get_kpis` deve refletir transações importadas em tempo real), Unit 15 (Settings controla visibilidade/ordem de widgets), Unit 16 (observabilidade das RPCs unificadas + telemetria de performance para decidir quando introduzir MV).
- **Supersedes:** Unit 3 parcialmente quanto ao modo como Dashboard consome o scope (clarifica que Dashboard respeita o toggle global em vez de ter UI de scope próprio).
- **Implicações — Modelo de dados (DDL):**
  - **Sem novas tabelas.** Toda a mudança é em RPCs e views.
  - **Novas RPCs (scope-aware):**
    - `get_kpis(scope_family_id uuid?, date_start date, date_end date, exclude_transfers boolean DEFAULT true) RETURNS TABLE(total_balance_cents bigint, income_cents bigint, expense_cents bigint, net_cents bigint, goals_progress_percentage numeric, budget_spent_percentage numeric, budgets_at_risk integer, reserved_cents bigint)` — `scope_family_id IS NULL` ⇒ personal scope (`auth.uid()`).
    - `get_category_breakdown(scope_family_id uuid?, date_start date, date_end date, kind text)` — `kind IN ('income','expense')`; agrega splits (Unit 6); devolve `categoria_id, categoria_nome, amount_cents, share_percent`.
    - `get_dashboard_insights(scope_family_id uuid?)` — devolve 2-3 insights estruturados: `type text ('mom_change','top_category','budget_risk','projected_over')`, `title text`, `value numeric`, `detail jsonb`.
    - `get_cashflow_timeline(scope_family_id uuid?, date_start date, date_end date, account_ids uuid[]?)` — unifica passado (transactions reais) + futuro (recurring_rules + funding rules + credit_card_payment + goal deadlines); devolve eventos com `date, amount_cents, direction, source_type, source_id, is_projected boolean, needs_confirm boolean`.
  - **RPCs a deprecar:** `get_personal_kpis`, `get_family_kpis`, `get_family_category_breakdown` (manter temporariamente com `DEPRECATED` comment; apagar após todas as frentes migrarem — max 1 release).
- **Implicações — Serviços / UI:**
  - `src/hooks/useDashboardQuery.ts` passa a chamar `get_kpis(scope, ...)` em vez de `get_personal_kpis()`.
  - `src/pages/Dashboard.tsx` lê `useScope()` (Unit 1) e re-renderiza quando scope muda; URLs de navegação passam a ser relativas ao scope atual.
  - Novo componente `src/components/dashboard/DashboardInsights.tsx` consumindo `get_dashboard_insights(scope)`.
  - `src/pages/reports.tsx` migra para `get_kpis`/`get_category_breakdown` unificadas; adiciona tab "Análise anual" com seletor de ano e cumulative savings.
  - `src/components/cashflow/CashflowView.tsx` passa a consumir `get_cashflow_timeline(...)`; UI ganha linha vertical "agora", slider de janela temporal, badges `⚠️ por confirmar` para instâncias `confirm` pendentes da Unit 9.
  - `src/services/exportService.ts` centraliza `exportTransactions()`, `exportReport()`, `exportCashflow()`.
- **Implicações — UI (rotas):**
  - `/app` Dashboard scope-aware; widget "Inbox" com badge de contagem (link para `/app/inbox` — Unit 9).
  - Apagar rota `/personal/insights`.
  - Manter `/app/reports`, `/app/cashflow` (ambos scope-aware).
- **Evidência a preservar:**
  - Apagar: [src/pages/Insights.tsx](src/pages/Insights.tsx) (41KB dead), [src/features/personal/PersonalInsights.tsx](src/features/personal/PersonalInsights.tsx) (após migração para `<DashboardInsights />`).
  - Refactor: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx), [src/hooks/useDashboardQuery.ts](src/hooks/useDashboardQuery.ts), [src/pages/reports.tsx](src/pages/reports.tsx), [src/components/cashflow/CashflowView.tsx](src/components/cashflow/CashflowView.tsx), [src/services/cashflowService.ts](src/services/cashflowService.ts) (remover placeholder credit card linha ~137 e implementar via `credit_card_payment`).
  - RPCs a depreciar: `get_personal_kpis`, `get_family_kpis`, `get_family_category_breakdown`.
  - RPCs novas: `get_kpis`, `get_category_breakdown`, `get_dashboard_insights`, `get_cashflow_timeline`.
  - Export: consolidar [src/services/exportService.ts](src/services/exportService.ts); ReportExport lazy-loaded continua.
  - Testes novos: Dashboard respeita scope toggle (personal→family atualiza widgets), Insights cards calculam corretamente, `get_kpis(scope)` devolve os mesmos números que os dois RPCs antigos (paridade), timeline do cashflow inclui tanto transactions passadas como recurring_rules futuras + instâncias `confirm` marcadas, slider 30/60/90 altera janela sem refetch desnecessário, `credit_card_payment` aparece como evento futuro no cashflow, Análise anual de Reports agrega 12 meses corretamente, `exportTransactions`/`exportReport`/`exportCashflow` produzem ficheiros válidos.
- **Estado:** decidido

#### Unit 11: Payroll Core
- **Data:** 2026-04-19
- **Decisão:** Dez sub-decisões + valores PT 2026 confirmados. (1) IRS via tabela DB `tax_tables(year, jurisdiction, type, brackets jsonb)` com seed das tabelas oficiais 2026 (Despacho n.º 233-A/2026 de 6 de janeiro); mínimo de existência = €12.880; escalões atualizados +3,51%; redução 0,3pp entre 2º e 5º escalão; isenção de retenção até €920 (até €991 para casado único titular) (Opção c); (2) ao fechar `payroll_period`, criar **uma transação de income "Ordenado líquido"** + opcionalmente "Subsídio alimentação" separada — detalhes do bruto/IRS/SS ficam no payslip, linked via `transactions.source_type='payroll'`, `source_id=payslip_id` (Opção b); (3) salário integra com Unit 9 como `recurring_rule(type='income')` com `execution_mode='auto'` se contrato tem `base_salary` fixo e sem OT/bónus previsto, `confirm` caso contrário (Opção c); (4) posting do salário **dispara `run_funding_rules(user_id, event='salary_income', amount_cents)`** automaticamente aplicando regras `income_percent` da Unit 7 (Opção b); (5) scope-aware (Unit 1) — cada user tem o seu contrato pessoal (`user_id`-scoped); família vê agregado "rendimento familiar" via view derivada (Opção b); (6) **um contrato ativo por user no Core**; múltiplos ficam para Unit 12 Advanced (schema já suporta via `ActiveContractProvider`, decisão é UX do Core) (Opção a); (7) suportar **ambos os modos de subsídio** por contrato: `vacation_bonus_mode` + `christmas_bonus_mode IN ('full','duodecimos')` (Opção c); (8) meal allowance com **caps tax-free PT 2026 encoded**: dinheiro €6,15/dia, cartão/voucher €10,46/dia; acima do cap entra no IRS; configurável por contrato via `meal_allowance_cents_per_day` + `payment_method` (Opção b); (9) payslip no Core com **upload manual** do PDF emitido pela entidade patronal para bucket `payroll-payslips`; geração automática de PDF fica para Unit 12 (Opção b); (10) limpeza: remover navegação hardcoded `/personal/payroll` → consolidar tudo em `/app/payroll`; remover `[DEBUG] console.log`; repor `family_id` coerente (contratos são `user_id`-scoped, configs podem ter `family_id` quando faça sentido); criar `docs/payroll-pt-2026.md` com tabelas; apagar rotas `DEV_ROUTES` (calculator, history preview). **Valores PT 2026 confirmados oficialmente:** salário mínimo €920 (DL n.º 139/2025 de 29 de dezembro), SS trabalhador 11% + SS empregador 23,75% (totalizam 34,75%) sem alterações, subsídio refeição tax-free €6,15 dinheiro e €10,46 cartão (regra: cartão = 70% acima do cash), IRS 2026 per Despacho n.º 233-A/2026.
- **Contexto:** Hoje [src/features/payroll/lib/calc.ts](src/features/payroll/lib/calc.ts) (676 linhas) calcula regular/OT/meal/mileage/bonus mas **IRS é % flat hardcoded** (linha 636). SS 11% default (correto). Schema: 13 tabelas `payroll_*` via migrations 2025-01 a 2025-08. UI tem ~30 componentes e rotas `/app/payroll/*` mas **nada integra com o resto da app** — salário não cria transactions, não aparece no Dashboard/Reports, não dispara funding rules nem é `recurring_rule`. Payslips têm coluna `file_path` mas sem UI de upload/download. PT edge cases em falta: férias partidas, 13º/14º como subsídio próprio (não bónus genérico), retroativos, ajudas de custo. Inconsistência de rotas: App.tsx monta `/app/payroll/*` mas código interno navega para `/personal/payroll/...`. Testes ~30% cobertura. **Verdict do audit**: "a wedge feature é uma calculadora, não um sistema de payroll integrado".
- **Razão:**
  - **(1) Tabelas IRS em DB:** evita ciclo anual de release obrigatório; seed inicial garante correção 2026; futuras atualizações via insert SQL.
  - **(2) Uma transação líquida + payslip link:** reflete o extrato bancário real (uma entrada líquida), mantém legível; detalhes fiscais ficam no payslip linkable.
  - **(3) Híbrido `auto`/`confirm`:** coerente com Unit 9; user com salário 100% fixo tem zero clicks, outros confirmam OT/bónus.
  - **(4) Funding rules on salary posting:** é o coração do fluxo "ganhei → alocado imediatamente"; sem isto, goals Unit 7 perde metade do valor.
  - **(5) Scope:** famílias reais têm 2 ordenados; `family_income` agregado alimenta Dashboard/Reports em modo família.
  - **(6) Um contrato no Core:** YAGNI; schema suporta múltiplos quando for relevante (freelance, side jobs — Unit 12).
  - **(7) Ambos os modos de subsídio:** realidade PT tem as duas formas (14 pagamentos tradicional vs duodécimos); tem de ser correto no motor.
  - **(8) Meal tax-free caps:** valores 2026 confirmados (€6,15 dinheiro / €10,46 cartão); acima do cap o excesso é tributável.
  - **(9) Upload manual:** valor imediato (user centraliza recibos) sem complexidade de geração PDF; PDF automático é UX bonito mas não-crítico.
  - **(10) Limpeza:** consolidar em `/app/payroll` alinha com Unit 1; remover DEV_ROUTES evita confusão em produção.
- **Depende de / Afeta:** Depende de Unit 1 (scope toggle), Unit 2 (`amount_cents`, `operation_id` — payslip gera `operation_id=hash(payslip_id)` para idempotência), Unit 5 (conta destino do salário), Unit 6 (transaction de income gerada segue modelo normal), Unit 7 (`run_funding_rules` chamado no posting com `event='salary_income'`), Unit 9 (salário é `recurring_rule` com `type='income'` e inbox item quando `confirm`). Afeta Unit 10 (Dashboard/Reports agora mostram income real mensal agregado via `get_kpis`), Unit 12 (Payroll Advanced expande com OT/bónus/ajudas/PDF automático/timesheet detalhado/férias partidas/retroativos/turnos), Unit 13 (family sharing agrega ordenados dos members via view `family_income`), Unit 14 (importer pode reconciliar transferência do IBAN patronal com payslip via fuzzy match data+valor), Unit 15 (Settings tem "Configuração de Payroll" que abre onboarding / acede a config do contrato).
- **Supersedes:** N/A (expande Unit 2 sem superseder).
- **Implicações — Modelo de dados (DDL):**
  - **`tax_tables` (nova):** `year smallint NOT NULL`, `jurisdiction text NOT NULL DEFAULT 'PT-continente'`, `type text NOT NULL CHECK (type IN ('irs_monthly','irs_yearly','ss_employee','ss_employer','meal_allowance_caps'))`, `brackets jsonb NOT NULL`, `source_url text`, `effective_from date NOT NULL`, `effective_to date?`, `created_at timestamptz NOT NULL DEFAULT now()`. PK `(year, jurisdiction, type, effective_from)`.
  - **Seed 2026 PT-continente:**
    - `irs_monthly` jsonb com tabelas do Despacho 233-A/2026 (estado civil × titulares × dependentes × brackets); source_url = Portal das Finanças.
    - `ss_employee`: `{rate: 0.11}`; `ss_employer`: `{rate: 0.2375}`.
    - `meal_allowance_caps`: `{cash_cents_per_day: 615, card_cents_per_day: 1046}`.
    - Mínimo de existência: `{minimo_existencia_anual_cents: 1288000}` guardado em `irs_yearly`.
  - **`payroll_contracts` (mudanças):**
    - Renomear `base_salary_cents` mantém.
    - Confirmar `currency text NOT NULL DEFAULT 'EUR'`.
    - Adicionar `target_account_id uuid? FK accounts(id)` — conta onde o líquido é depositado; se `NULL`, user escolhe no momento do confirm.
    - Adicionar `meal_allowance_payment_method text CHECK (meal_allowance_payment_method IN ('cash','card'))`.
    - Adicionar `vacation_bonus_mode text CHECK (vacation_bonus_mode IN ('full','duodecimos'))` (se não existir).
    - Adicionar `christmas_bonus_mode text CHECK (christmas_bonus_mode IN ('full','duodecimos'))` (se não existir).
    - Adicionar `estado_civil text CHECK (estado_civil IN ('solteiro','casado_unico_titular','casado_dois_titulares'))`.
    - Adicionar `dependentes smallint NOT NULL DEFAULT 0 CHECK (dependentes >= 0)`.
    - Adicionar `residencia text NOT NULL DEFAULT 'PT-continente' CHECK (residencia IN ('PT-continente','PT-acores','PT-madeira'))`.
    - Adicionar `active boolean NOT NULL DEFAULT true` + partial unique index `(user_id) WHERE active=true` (um ativo por user no Core).
  - **`payroll_payslips` (mudanças):**
    - Adicionar `transaction_id uuid? FK transactions(id) ON DELETE SET NULL` — ligação à transação de income criada.
    - Adicionar `operation_id text NOT NULL` = `hash(payslip_id)` (idempotência Unit 2).
    - Manter `file_path text?` para PDF uploaded.
    - Adicionar índice `(contract_id, period_start)`.
  - **View `family_income` (nova):** `family_id, year_month, total_gross_cents, total_net_cents, by_user jsonb` — agrega payslips de todos os members da família.
  - **Bucket Storage:** `payroll-payslips` privado, RLS via `contract.user_id = auth.uid()`.
- **Implicações — Serviços / Motor:**
  - `src/features/payroll/lib/calc.ts`:
    - Substituir `irsPercentage / 100` por `lookupIrsRate(year, jurisdiction, estadoCivil, titulares, dependentes, grossMonthlyCents)` que consulta `tax_tables`.
    - Respeitar mínimo de existência anual (não reter quando rendimento anual estimado < €12.880).
    - Respeitar isenção de retenção: bruto ≤ €920 (ou ≤ €991 casado único titular) → retenção = 0.
    - Meal allowance split tax-free/tributável usando caps da `tax_tables`.
  - Novo serviço `src/features/payroll/services/postingService.ts`:
    - `closePeriodAndPost(periodId)` — idempotente via `operation_id`; calcula, cria payslip, cria transaction income, atualiza saldo conta, dispara `run_funding_rules(user_id, 'salary_income', net_cents)`.
    - `confirmSalaryFromInbox(instance_id, net_cents_override?, notes?)` — fluxo Unit 9.
  - RPC `get_family_income(family_id, year_month)` para Unit 10.
  - RPC `upsert_payroll_contract(...)` scope-aware.
- **Implicações — Integração Unit 9:**
  - `create_payroll_contract` cria também `recurring_rule`:
    - `type='income'`, `amount_cents=base_salary + meal_allowance*20*expected_days` (estimativa inicial), `amount_mode='fixed'` se sem OT/bónus previsto senão `estimated`, `execution_mode='auto'` se `fixed` senão `confirm`, `schedule_type='monthly'`, `day_of_month=25` (default, configurável), `target_account_id`, `next_due_at` calculado.
  - Ao `confirm` do recurring instance da inbox, chama `closePeriodAndPost` em vez do fluxo genérico.
- **Implicações — UI:**
  - Consolidar todas as rotas em `/app/payroll/*`; remover `/personal/payroll` interna e o `PersonalPayroll`.
  - PayrollOnboarding guia o user em 3 passos: (1) dados do contrato (base salary, estado civil, dependentes), (2) subsídios (modo full vs duodécimos), (3) conta destino + data de pagamento.
  - Página contrato tem upload direto de PDF do recibo do mês atual.
  - Remover `DEV_ROUTES` (calculator preview, history preview) — já não fazem sentido no Core.
  - Formulário de contrato passa a validar que há `target_account_id` para que auto-posting funcione.
- **Evidência a preservar:**
  - Apagar: navegação hardcoded `/personal/payroll` em todos os componentes; `DEV_ROUTES` preview; `console.log('[DEBUG]')` payroll.
  - Refactor: [src/features/payroll/lib/calc.ts](src/features/payroll/lib/calc.ts) (substituir IRS flat), [src/features/payroll/services/calculation.service.ts](src/features/payroll/services/calculation.service.ts), [src/features/payroll/components/PayrollModule.tsx](src/features/payroll/components/PayrollModule.tsx) (rotas), contratos migration para novos campos.
  - Migrar: contratos existentes → preencher `residencia='PT-continente'`, `estado_civil` via prompt do user, `target_account_id` via prompt; se ficheiros `file_path` existirem mover para bucket.
  - Novo: `docs/payroll-pt-2026.md` com tabelas IRS 2026 + fontes (Despacho 233-A/2026, DL 139/2025, Portal das Finanças), caps subsídio alimentação, SS rates, mínimo de existência.
  - Testes novos: paridade com cálculos de payslip real português em cenários canónicos (solteiro 0 dependentes vários brackets, casado único titular, casado dois titulares 2 dependentes), limite isenção de retenção €920/€991, meal allowance tributável quando excede cap, subsídio férias full vs duodécimos, posting cria 1 transação com `operation_id` idempotente, repost não duplica, `run_funding_rules` disparado, `family_income` agrega 2 members, mínimo de existência zera retenção em rendimentos baixos, RLS bucket bloqueia acesso cross-user.
- **Estado:** decidido

#### Unit 12: Payroll Advanced
- **Data:** 2026-04-19
- **Decisão:** Doze sub-decisões + valores PT 2026 confirmados oficialmente. (1) OT tabela PT encoded por defeito com **duas escalas** per Art. 268.º CT (Lei 13/2023): **até 100h/ano** = +25% 1.ª hora, +37,5% seguintes, +50% dia descanso/feriado; **acima 100h/ano** = +50% 1.ª hora, +75% seguintes, +100% dia descanso/feriado; customizável por contrato via `payroll_ot_policies` + alerta ao ultrapassar limites legais anuais (Opção c); (2) timesheet com time entries start/end/break + regras automáticas de intervalos (6-8h = 1h, >8h = 1h30) (Opção b); (3) trabalho noturno com multiplier separado +25% para horas 22:00-07:00 (CT art. 266.º), gated por flag `night_work=true` no contrato (Opção b); (4) **parked-aceite** para trabalho por turnos rotativos (`payroll_shift_patterns`) — cobre poucos users; adicionar quando houver pedido concreto; (5) leaves afetam payslip com tratamento fiscal completo: unpaid leave pro-rata; sick leave (3 dias empregador, depois SS); maternidade/paternidade SS; férias pagas normal; férias partidas com subsídio proporcional aos dias (Opção c); (6) mileage com tabela PT 2026 encoded: **€0,40/km viatura própria** (limite isento); acima entra no IRS; via `tax_tables` type=`mileage_caps` (Opção b); (7) bonuses tipificados: `performance_bonus`, `retention_bonus`, `sign_on_bonus`, `custom`; 13º/14º ficam como subsídios na Unit 11, não bónus; **parked-aceite** regras fiscais específicas (IRS Jovem / Work Bonus DL) que mudam anualmente (Opção b); (8) retroativos como entidade própria `payroll_retroactives(contract_id, period_start, period_end, amount_cents, reason)`; tributados pelas **tabelas IRS do ano de competência** (regra AT), não do ano de pagamento (Opção b); (9) múltiplos contratos em simultâneo (ordenado + recibos verdes + RNH); cada um com o seu payroll_contract ativo; Dashboard/Reports agregam; retenção mensal é por contrato; **aviso** quando soma dos brutos salta para bracket superior (Opção c); (10) geração automática de PDF via template (react-pdf) com layout Recibo PT standard (NIF/NISS/IBAN/bruto/deduções/líquido/subsídios/OT); assinatura digital opcional (Opção b); (11) ajudas de custo com `payroll_travel_allowances` com tipos `alojamento`, `deslocacao_nacional`, `deslocacao_estrangeiro`, `deslocacao_viatura_propria`; caps tax-free 2026 via `tax_tables` type=`travel_allowance_caps` (Opção b); (12) limpeza: consolidar ~30 componentes dispersos em estrutura clara (`timesheet/`, `bonuses/`, `deductions/`, `leaves/`, `mileage/`, `travel-allowances/`, `reports/`); cobertura ≥70% do motor com casos-teste PT reais. **Valores PT 2026 confirmados oficialmente:** ajudas de custo **nacional €65,89/dia (geral) e €72,65/dia (administradores/gerentes)**; ajudas de custo **estrangeiro €156,36/dia (geral) e €175,42/dia (administradores/gerentes)**; mileage viatura própria **€0,40/km** (inalterado); limites anuais horas extra (Art. 228.º): **175h/ano MPE (<50 trabalhadores)** e **150h/ano para ≥50 trabalhadores**, até **200h via IRCT**; máximo **2h/dia** em dia normal; **IRS em horas extra** (desde 1/1/2025) = retenção autónoma **50% da taxa IRS aplicável ao salário base**, desde a 1.ª hora.
- **Contexto:** Unit 11 estabeleceu Payroll Core (contrato único ativo, base salary, IRS tabelado via `tax_tables`, 1 transação líquida, subsídios full/duodecimos, meal tax-free, upload manual PDF). Ficaram por resolver: OT (código existe em `payroll_ot_policies` mas multipliers flat sem as duas escalas 100h), mileage (existe tabela mas sem cap tax-free), bonuses (existe `payroll_bonus_configs` mas sem tipos específicos nem regras fiscais), timesheet detalhado, leaves com impacto fiscal, férias partidas, ajudas de custo (não modelado), turnos rotativos (não modelado), múltiplos contratos (schema suporta via `ActiveContractProvider` mas decisão Core limitou a 1), PDF automático, retroativos (hoje tratados como bónus genérico). O audit identificou ~30 componentes dispersos sem estrutura clara. Testes ~30% cobertura — insuficiente para um motor que produz valores fiscais.
- **Razão:**
  - **(1) OT duas escalas:** obrigação legal PT (Lei 13/2023 alterou Art. 268.º CT); user que fizer >100h/ano com tabela simplificada fica subtributado (e o empregador subpaga — divergência com recibo real).
  - **(2) Timesheet:** start/end permite OT correto (intervalos automáticos mudam o pagável); sem isto user tem de calcular manualmente.
  - **(3) Noturno:** +25% 22:00-07:00 é valor para turnos de saúde/segurança/restauração — muitos users PT.
  - **(4) Turnos parked:** escopo grande, poucos users, entra em sprint dedicado quando necessário.
  - **(5) Leaves fiscais:** realidade PT tem regras específicas (sick 3+N, maternidade SS, férias partidas); sem isto payslip não reflete vida real.
  - **(6) Mileage €0,40/km:** valor da AT; excesso tributado; `tax_tables` permite futuras atualizações.
  - **(7) Bonuses tipificados:** estrutura para tratamento fiscal diferenciado; regras específicas (IRS Jovem etc.) mudam muito e ficam parked.
  - **(8) Retroativos tributados no ano de competência:** regra AT fundamental; tratar como bónus genérico inflaciona IRS do mês atual e ofusca acerto anual.
  - **(9) Múltiplos contratos + aviso:** realidade comum (ordenado + side gig); aviso evita surpresa em Maio.
  - **(10) PDF automático:** valor claro para user que quer histórico centralizado sem depender do empregador; react-pdf é ligeiro.
  - **(11) Ajudas de custo com caps:** valores 2026 confirmados para nacional e estrangeiro; tratamento fiscal correto evita subtributação.
  - **(12) Limpeza:** 30 componentes dispersos são débito técnico; estrutura por domínio facilita manutenção e onboarding de novos contribuidores.
- **Depende de / Afeta:** Depende de Unit 11 (Core — contrato, payslip, posting, integração com transactions/Unit 7/Unit 9), Unit 1 (scope), Unit 2 (`amount_cents`/`operation_id`), `tax_tables` (expandida com `mileage_caps`, `travel_allowance_caps`, `ot_rates`). Afeta Unit 14 (importer pode reconciliar ajudas de custo e mileage via categorias específicas), Unit 15 (Settings tem "Configuração Avançada de Payroll" — OT policies, leaves, turnos futuros), Unit 16 (PDF generation via react-pdf pode ser cross-cutting com Reports e Exports).
- **Supersedes:** N/A (expande Unit 11).
- **Implicações — Modelo de dados (DDL):**
  - **`tax_tables` adições (seed 2026):**
    - `mileage_caps`: `{cents_per_km: 40}`.
    - `travel_allowance_caps`: `{national_general_cents: 6589, national_admin_cents: 7265, foreign_general_cents: 15636, foreign_admin_cents: 17542, breakdown: {lunch: 0.25, dinner: 0.25, sleep: 0.50}}`.
    - `ot_rates`: `{up_to_100h: {first_hour_pct: 0.25, next_hours_pct: 0.375, rest_day_pct: 0.50}, above_100h: {first_hour_pct: 0.50, next_hours_pct: 0.75, rest_day_pct: 1.00}, night_work_pct: 0.25, night_start: '22:00', night_end: '07:00'}`.
    - `ot_annual_limits`: `{mpe_hours: 175, others_hours: 150, irct_max_hours: 200, daily_max_hours: 2}`.
    - `ot_irs_withholding`: `{autonomous_rate_of_base: 0.50, since: '2025-01-01'}`.
  - **`payroll_ot_policies` (mudanças):** adicionar `use_legal_defaults boolean NOT NULL DEFAULT true` — se true, motor consulta `tax_tables.ot_rates`; se false, usa valores customizados; adicionar `accumulated_hours_ytd` numeric para tracking das 100h.
  - **`payroll_leaves` (mudanças):** adicionar `type text CHECK (type IN ('sick','vacation','unpaid','maternity','paternity','other'))`; adicionar `employer_days smallint?` (dias a cargo empregador — default 3 para sick); adicionar `affects_subsidy boolean NOT NULL DEFAULT false` (férias partidas que alteram subsídios pro-rata).
  - **`payroll_bonus_configs` (mudanças):** adicionar `bonus_type text CHECK (bonus_type IN ('performance_bonus','retention_bonus','sign_on_bonus','custom'))`; remover overlap com subsídios férias/Natal (forçados no contrato Unit 11).
  - **`payroll_retroactives` (nova):** `id uuid PK`, `contract_id uuid NOT NULL FK payroll_contracts`, `period_start date`, `period_end date`, `amount_cents bigint NOT NULL`, `reason text`, `competence_year smallint NOT NULL` (ano fiscal de competência — usado para escolher tabela IRS), `paid_at date?`, `operation_id text NOT NULL`.
  - **`payroll_travel_allowances` (nova):** `id uuid PK`, `contract_id uuid FK payroll_contracts`, `type text NOT NULL CHECK (type IN ('alojamento','deslocacao_nacional','deslocacao_estrangeiro','deslocacao_viatura_propria'))`, `date_start date`, `date_end date`, `days numeric?` (suporta frações per breakdown 25/25/50), `km numeric?` (para viatura própria), `role text CHECK (role IN ('general','admin'))`, `amount_cents bigint NOT NULL`, `taxable_excess_cents bigint GENERATED`, `receipt_file_path text?`, `operation_id text NOT NULL`.
  - **`payroll_contracts` mudança Unit 11→12:** remover unique partial index `(user_id) WHERE active=true` (ou substituir por `(user_id, contract_scope)` se distinguir ordenado vs recibo verde); adicionar `contract_scope text CHECK (contract_scope IN ('primary_employment','secondary_employment','self_employed'))`.
  - **View `contract_ot_status`:** `contract_id, year, ot_hours_ytd, ot_hours_remaining, next_threshold ('100h_switch'|'annual_limit')`.
- **Implicações — Serviços / Motor (`src/features/payroll/lib/calc.ts`):**
  - `calcOvertime(entries, policy, ytdAccumulated)`:
    - Consulta `tax_tables.ot_rates` se `policy.use_legal_defaults=true`.
    - Para cada hora, decide escala: `ytdAccumulated + hours_before < 100 ? up_to_100h : above_100h`; lida com transição a meio de um bloco.
    - Aplica +25% noturno se entry cai em 22:00-07:00.
    - Alerta se somar ultrapassa `tax_tables.ot_annual_limits`.
  - `calcRetroactive(retroactive, year_tables)`:
    - Consulta `tax_tables` com `year = retroactive.competence_year` (não ano corrente).
    - Calcula IRS como se o valor tivesse sido pago no ano de competência.
  - `calcMultipleContracts(userId, month)`:
    - Itera todos `payroll_contracts active` do user.
    - Calcula cada payslip independentemente (retenção por contrato).
    - Agrega brutos para alerta "bracket superior".
  - `calcTravelAllowance(allowance, year_tables)`:
    - Consulta `tax_tables.travel_allowance_caps` pelo `type` e `role`.
    - Devolve `{exempt_cents, taxable_cents}`.
  - `calcOvertimeIrsWithholding(ot_pay, base_rate)`:
    - Aplica regra 50% da taxa base desde 1/1/2025.
- **Implicações — PDF Generation:**
  - Novo package `react-pdf/renderer`; componente `src/features/payroll/components/PayslipPdf.tsx` com template Recibo PT.
  - Edge Function `generate_payslip_pdf(payslip_id)` — renderiza server-side para bucket `payroll-payslips`; alternativa: renderizar client-side e fazer upload.
  - Payslip ganha dois botões: "Upload recibo" (Unit 11) e "Gerar PDF" (Unit 12).
- **Implicações — UI:**
  - Página "Horas Extra" mostra YTD accumulated + barra de progresso até 100h (switch) e até 175h/150h (limite legal).
  - Página "Ajudas de Custo" com formulário escolhendo tipo, datas, role (geral/admin), valor diário; calcula tax-free automaticamente mostrando excesso tributável.
  - Página "Retroativos" com campo `competence_year` (ano de competência) + tooltip explicativo.
  - Wizard de contrato secundário (self-employed, recibo verde) — detetado por `contract_scope`.
  - Dashboard de Payroll: widget "OT Status" (horas YTD), "Leaves" (dias usados/restantes), "Retroativos pendentes" se houver.
- **Evidência a preservar:**
  - Refactor: consolidar `src/features/payroll/components/` em subpastas por domínio (`timesheet/`, `bonuses/`, `leaves/`, `mileage/`, `travel-allowances/`, `reports/`).
  - `src/features/payroll/lib/calc.ts` ganha novas funções puras (testáveis isoladamente).
  - Novo: `docs/payroll-pt-2026-advanced.md` com tabelas OT (duas escalas), ajudas de custo (4 valores), mileage, fontes: DL 106/98 (ajudas de custo funcionários públicos), Lei 13/2023 (OT), Art. 228.º CT (limites anuais), Despacho SEAF sobre IRS em OT desde 2025.
  - Testes novos: OT duas escalas passa correctly pelo switch das 100h; OT noturno acumula com OT diurno; leaves sick 3 dias empregador + resto SS; férias partidas reduzem subsídio pro-rata; retroativos usam tabela IRS do ano de competência; múltiplos contratos calculam retenção independente + alertam bracket; ajudas de custo nacional geral (€65,89) vs admin (€72,65); ajudas estrangeiro geral (€156,36) vs admin (€175,42); mileage acima de €0,40/km parte tributável; PDF gerado tem todos os campos obrigatórios; retenção IRS em OT = 50% taxa base; limite anual 175h MPE bloqueia e alerta; cobertura ≥70% no motor.
- **Estado:** decidido

#### Unit 13: Family Sharing
- **Data:** 2026-04-19
- **Decisão:** Doze sub-decisões. (1) **Unificação de UI real** — apagar `PersonalX` + `FamilyX` duplicados (accounts, transactions, budgets, goals, dashboard), componente único consome `useScope()` (Unit 1); rotas `/personal/*` e `/family/*` passam a **redirects** para `/app/*`; esta é a unit onde a Unit 1 se materializa (Opção b). (2) Nova **Edge Function `send-family-invite`** envia email via Resend (ou SMTP configurado) com template próprio PT/EN, token seguro, link para `/invite?token=...`; **rate limiting**: 10 invites/dia/user, max 3 por email/30 dias (Opção c). (3) Roles **`owner + admin + member + viewer`** com constraint "tem sempre ≥1 `owner`"; ownership transferível explicitamente (Opção c). (4) **Soft-remove** de members — status `active|removed` + `removed_at`; `user_id` fica para integridade histórica mas perde RLS access; UI oferece "reassign to owner" (Opção c). (5) **Tracking de contribuição individual** via `transactions.user_id` + `goal_ledger.user_id` (campos já existem, passam a ter significado semântico); Dashboard família mostra "Pedro X%, Ana Y%"; widget `/app/members` com breakdown agregado mês a mês (Opção c). (6) **Splits / reimbursement dentro da família**: nova tabela `expense_splits(transaction_id, user_id, share_cents)` + RPC `split_transaction(tx_id, splits)` + view `member_balances(family_id, user_id, owes_cents)` + ação "acertar contas" que cria transfer Unit 6 entre contas pessoais dos members (Opção b); **parked-aceite** splits para grupos não-família (Splitwise-like) — fora do wedge "Gestão PT Família". (7) **"Private pocket" fica em `/app/*` com scope=personal**; família é 100% partilhada por design (Unit 1); não adicionar `visible_to` em contas família (Opção c — reaproveitar o scope toggle). (8) **Inbox Unit 9 recebe family events**: `source_type='family_event'` para novo member, goal atingido, budget ultrapassado, transação >€X registada por outro member; filtragem fina por user em Unit 15 Settings (Opção c). (9) **Manter `family_audit_log(family_id, user_id, action, entity_type, entity_id, diff jsonb, created_at)`** com retenção 180 dias; visível para `admin+owner` (Opção b). (10) **Permitir N famílias por user**: toggle de scope ganha dropdown quando user tem >1 família; schema já suporta (Opção b). (11) **RLS fortification defence-in-depth**: triggers `BEFORE INSERT` em todas as tabelas com `family_id` validam `EXISTS (SELECT 1 FROM family_members WHERE user_id=auth.uid() AND family_id=NEW.family_id AND role != 'viewer' AND status='active')`; testes E2E com token de user de família B a tentar INSERT em família A devem falhar (Opção c). (12) **Fluxo de invite completo**: email com link → login/register → accept → join; register com email que tem invite pendente aceita automaticamente; Unit 4 onboarding deteta pending invite e salta de "criar família" para "juntar família".
- **Contexto:** Hoje existem 3 tabelas (`families`, `family_members(role='admin'|'member'|'viewer')`, `family_invites`) + RPC `invite_family_member_by_email_safe`/`accept_family_invite_by_email`. A UI é **forked** ~3000+ linhas: `PersonalAccounts(609) + FamilyAccounts(609)`, `PersonalBudgets + FamilyBudgets(626)`, `PersonalGoals + FamilyGoals(613)`, `PersonalTransactions + FamilyTransactions(742)`. **Assimetria**: Family tem accounts/transactions/budgets/goals mas **NÃO tem Insights, Reminders, Payroll**. Sem conceito "own vs shared money", sem contribuição individual, sem splits, sem reimbursement. `remove_family_member` **orphans data** (não cascade, não reassign). RLS retrofit explícito no migration `20250115000000_fix_family_invites_rls.sql` indica bug histórico. `family.legacy.ts` usa "safe" wrapper para evitar invalidação de sessão — auth bugs históricos. Envio de email de invite opaco (presume-se Supabase built-in, não confirmado). RLS trust-based: valida pertença via JOIN mas não valida no write que user pode gravar naquele `family_id`.
- **Razão:**
  - **(1) Unificação real:** Unit 1 decidiu scope como state; UI forked viola essa decisão; materializar aqui evita divergência futura.
  - **(2) Edge Function + rate limit:** invites são user-facing, email deliverability é produto-crítico; rate limit previne spam/abuse.
  - **(3) Owner + admin + member + viewer:** padrão em apps colaborativas; constraint min-1-owner evita família órfã.
  - **(4) Soft-remove com reassign:** divórcio / rotura é caso real; perder 2 anos de histórico porque um member foi removido é inaceitável.
  - **(5) Contribuição individual:** dá consciência + justiça em famílias reais; baseline continua "tudo partilhado" mas expõe a verdade quando quisermos.
  - **(6) Splits intra-família:** casa com partner + filhos onde um paga supermercado e outro combustível é caso comum; "acertar contas" fecha o loop; Splitwise-para-amigos fica fora do wedge.
  - **(7) Sem private pocket em família:** Unit 1 já distinguiu; adicionar `visible_to` complica RLS sem necessidade.
  - **(8) Family events na inbox:** um dos principais valores da família é "saber o que o outro fez"; settings fino evita ruído.
  - **(9) Audit log 180d:** disputas correntes cobertas; sem explosão de storage.
  - **(10) N famílias:** família nuclear + casa partilhada + família alargada são cenários reais; schema aguenta.
  - **(11) RLS fortification:** defesa em profundidade; histórico de bugs RLS nesta app merece triggers adicionais; testes E2E fazem parte da regressão contínua.
  - **(12) Fluxo invite completo:** invite UX falha em "email sem conta Supabase" é comum; register a aceitar auto resolve.
- **Depende de / Afeta:** Depende de Unit 1 (scope — materializa-se aqui), Unit 2 (`amount_cents`, `operation_id`), Unit 4 (onboarding deteta pending invite), Unit 5 (contas família), Unit 6 (transactions com `user_id` como contributor; "acertar contas" cria transfer), Unit 7 (goals família com ledger per member), Unit 8 (budgets família com contribuições), Unit 9 (inbox recebe family events), Unit 10 (Dashboard widget "Contribuições" em scope=família). Afeta Unit 15 (Settings de família: gerir members/roles/transferir ownership/sair/filtrar family events), Unit 16 (testes E2E cross-family security + triggers RLS).
- **Supersedes:** Materializa Unit 1 (scope toggle passa a ter código único por baixo em vez de dois paralelos). Amplia Unit 9 (inbox recebe `source_type='family_event'`). Amplia Unit 10 (Dashboard família ganha breakdown de contribuições).
- **Implicações — Modelo de dados (DDL):**
  - **`family_members` (mudanças):**
    - Adicionar `status text NOT NULL CHECK (status IN ('active','removed')) DEFAULT 'active'`.
    - Adicionar `removed_at timestamptz?`, `removed_by uuid? FK auth.users`, `removed_reason text?`.
    - Adicionar `role` values: extender CHECK para incluir `'owner'`; migration: primeiro `created_by` de cada família promovido a `owner`.
    - Constraint: `EXISTS (SELECT 1 FROM family_members WHERE family_id=fm.family_id AND role='owner' AND status='active')` — enforce via trigger BEFORE DELETE/UPDATE.
  - **`family_invites` (mudanças):**
    - Adicionar `invite_link_opened_at timestamptz?` (telemetria).
    - Constraint UNIQUE `(family_id, email, status)` WHERE status='pending' — impede duplicados pendentes.
  - **`expense_splits` (nova):** `id uuid PK`, `transaction_id uuid NOT NULL FK transactions(id) ON DELETE CASCADE`, `user_id uuid NOT NULL FK auth.users(id)`, `share_cents bigint NOT NULL CHECK (share_cents > 0)`, `created_at timestamptz`. PK `(transaction_id, user_id)`. Constraint: soma de `share_cents` de todos os splits de uma transação = `transaction.amount_cents`.
  - **View `member_balances`:** `family_id, user_id, paid_cents (soma das suas transactions família), owed_cents (soma dos splits onde foi devedor), balance_cents = paid_cents - owed_cents`.
  - **`family_audit_log` (nova):** `id uuid PK`, `family_id uuid NOT NULL FK`, `user_id uuid FK auth.users`, `action text NOT NULL`, `entity_type text`, `entity_id uuid?`, `diff jsonb?`, `created_at timestamptz`. Retention policy: job diário apaga >180d. RLS: visível só para role `owner` e `admin`.
  - **Triggers RLS fortification** (BEFORE INSERT ou UPDATE com family_id não-null): `accounts`, `credit_cards`, `transactions`, `transfers`, `budgets`, `goals`, `goal_ledger`, `recurring_rules`, `inbox_items`, `categories` — validar `EXISTS (SELECT 1 FROM family_members WHERE user_id=auth.uid() AND family_id=NEW.family_id AND status='active' AND role != 'viewer')`; viewer bloqueia INSERT/UPDATE mas permite SELECT.
- **Implicações — Edge Functions / Serviços / RPCs:**
  - Nova Edge Function `send-family-invite`:
    - Input: `{family_id, email, role}`.
    - Valida: caller é `owner` ou `admin` da família; email não tem invite pending; rate limit (10/dia/user, 3/email/30d).
    - Cria `family_invites` com token seguro (crypto.randomUUID) + `expires_at = now() + 7 days`.
    - Envia email via Resend com template `family_invite_{locale}.html`.
    - Retorna `{invite_id, link}`.
  - Nova Edge Function (ou RPC) `accept_family_invite(token)`:
    - Valida token não expirado, status='pending'.
    - Se email do invite = email do auth.user atual → adiciona a `family_members(status='active')`, atualiza `family_invites(status='accepted', accepted_at)`.
    - Se user não logado → retorna erro "login first" (frontend redireciona).
  - RPC `transfer_ownership(family_id, new_owner_user_id)` — só owner atual pode chamar; atomic.
  - RPC `remove_family_member(family_id, user_id, reassign_to uuid)` — soft-update + reassigna data (transfere `user_id` em transactions/goals/etc para `reassign_to` se fornecido; senão mantém mas nega RLS).
  - RPC `split_transaction_among_members(transaction_id, shares jsonb)` — valida soma = amount; insert em `expense_splits`. **Nota de desambiguação vs Unit 6:** Unit 6 tem `transaction_splits` (reparte **por categoria**, ex: 120€ supermercado = 70€ comida + 30€ higiene + 20€ limpeza) com RPC `split_transaction(transaction_id, category_splits jsonb)`; Unit 13 tem `expense_splits` (reparte **entre membros da família**, quem pagou vs quem deve) com RPC renomeado `split_transaction_among_members(...)`. UI: label "Dividir por categorias" (Unit 6) vs "Repartir entre membros" (Unit 13) — labels distintos, ícones distintos. **Interação permitida:** uma transação pode ter ambos simultaneamente — `SUM(transaction_splits.amount_cents) = transactions.amount_cents` AND `SUM(expense_splits.share_cents) = transactions.amount_cents` independentemente. Triggers validam cada constraint em separado.
  - RPC `settle_member_balance(family_id, from_user_id, to_user_id, amount_cents)` — cria `transfer` entre contas pessoais (Unit 6) + zera slice do balance.
  - RPC `list_family_events(family_id, limit, offset)` — alimenta audit log UI.
  - RPC `register_family_event(family_id, action, entity_type, entity_id, diff)` — chamado por triggers de transactions/goals/budgets quando há família.
- **Implicações — UI:**
  - **Eliminar**: `src/features/personal/PersonalAccounts.tsx`, `PersonalBudgets.tsx`, `PersonalGoals.tsx`, `PersonalTransactions.tsx`, `PersonalDashboard.tsx`, `PersonalReminders.tsx`, `PersonalInsights.tsx`; equivalentes em `src/features/family/*`; páginas `src/pages/Personal.tsx` e `src/pages/Family.tsx`.
  - **Criar / Consolidar** em `/app/*` componentes únicos: `<Accounts />`, `<Transactions />`, `<Budgets />`, `<Goals />`, `<Dashboard />`, `<Recurrents />` — cada um com `const scope = useScope()` e RPC adequada.
  - Rotas `/personal/*` e `/family/*` → redirects para `/app/*` + `setScope()` correspondente; apagar após 1 ciclo de release.
  - Nova página `/app/family/members` com: lista members (status, role, joined_at, contributor %), convidar, transferir ownership, remover (com reassign), sair da família.
  - Nova página `/app/family/audit` (só owner/admin) com log.
  - Em scope=família:
    - Dashboard adiciona `<ContributionsWidget />` (Pedro X%, Ana Y%).
    - Transactions show `user_id` como coluna "Por" com avatar; filtro por member.
    - Ação "Dividir" em transaction abre modal de splits; depois aparece "Acertar contas" com saldo entre members.
  - Invite aceito via `/invite?token=...` dispara aceitação + redirect para `/app` com toast "Bem-vindo à família X".
  - Onboarding (Unit 4) deteta `family_invites` pendentes com email do user e oferece "Juntar à família X" em vez de "Criar família".
  - Settings de família em `/app/settings/family` (Unit 15): name, currency, remover família (só owner, requer confirm por digitar nome), filtrar family events do inbox.
- **Evidência a preservar:**
  - Apagar: [src/services/family.legacy.ts](src/services/family.legacy.ts), `PersonalX`/`FamilyX` ~3000+ linhas duplicadas, `src/pages/Personal.tsx` e `src/pages/Family.tsx` (routers).
  - Refactor: [src/services/family.service.ts](src/services/family.service.ts) (remover DEBUG logs, migrar para nova Edge Function), [src/features/family/FamilyMembers.tsx](src/features/family/FamilyMembers.tsx) (novos roles, status, transferir ownership), hooks de accounts/transactions/budgets/goals para aceitarem `scope` único.
  - Novos: Edge Functions `send-family-invite` e (opcionalmente) `accept-family-invite`; tabelas `expense_splits`, `family_audit_log`; view `member_balances`; triggers RLS fortification.
  - Migração SQL: promoção de `created_by` de cada família para `role='owner'`; backfill `status='active'` em `family_members`; constraint min-1-owner via trigger.
  - Template email: `supabase/functions/send-family-invite/templates/invite_pt.html` + `invite_en.html`.
  - Testes: E2E invite lifecycle (create→email→click→register→accept→list família); cross-family INSERT bloqueado por trigger; soft-remove preserva histórico; transferência ownership atomic; split transaction com soma != amount rejeitado; `settle_member_balance` cria transfer Unit 6; audit log inserido em eventos família; viewer bloqueado em INSERT; rate limit de invite (11ª tentativa rejeitada).
- **Estado:** decidido

#### Unit 14: Importer
- **Data:** 2026-04-19
- **Decisão:** Doze sub-decisões. (1) **Templates pré-configurados** para 6 bancos PT maiores (Millennium BCP, Santander Totta, CGD, Novo Banco, ActivoBank, Montepio + BPI bonus) em `src/features/importer/bank-templates/`; auto-deteção pelo header CSV; user pode corrigir; comunidade PR parked (Opção b). (2) **OCR de recibo / PDF parked-aceite** — remover stub atual (`OCR_PROVIDER='mock'`), env vars `GCV_KEY`/`GCV_ENDPOINT` e UI de "Importar recibo" para parar a façade; revisitar quando PT Payroll wedge gerar tração (Opção d). (3) **Fuzzy dedup contra `transactions`**: mesmo account + |date_diff| ≤ 2 dias + |amount_diff| ≤ €0,02 → `duplicate`; ≤ 5 dias + exact amount + description similar (Levenshtein) → `probable_duplicate` (user confirma) (Opção b). (4) **Dedup contra `recurring_instances` (Unit 9) obrigatório**: fuzzy match `(account_id, amount_cents ± €0,02, date ± 2d, counterparty similar)` contra instâncias `pending` E `confirmed`; se match, marca `status='posted'`, liga `transaction_id`, não duplica (Opção c). (5) **Rules engine `import_categorization_rules`** (user_id, family_id?, priority, match_field, match_type, pattern, category_id) aplicado em ordem; user cria regras via UI inline na staging table; **seed inicial de ~30 regras comuns PT** (LIDL/PINGO/CONTINENTE→Supermercado, GALP/BP/REPSOL→Combustível, NOS/MEO/VODAFONE→Telecomunicações, EDP→Energia, ACT/AT→Impostos, etc.); aprendizagem automática parked-aceite (Opção c). (6) **OFX via `ofx-js`**; MT940 e CAMT.053 parked-aceite (Opção b). (7) **Auto-deteção de formato** por extensão + sniff do conteúdo (primeiras linhas CSV → match template; OFX detetado por `<OFX>`); user corrige se errado (Opção b). (8) **Remover cap 1000 linhas**; processar em batches de 100; progress via polling; >2000 linhas usa Edge Function em background job (Opção b). (9) **Consolidar em `/app/import` scope-aware** (Unit 1/13); rotas antigas passam a redirects (Opção b). (10) **Error handling per row**: cada linha em staging tem badge `ok|warning|error` + tooltip com razão ("data inválida", "account não existe"); user corrige inline ou skip (Opção b). (11) **Cobertura de testes ≥80%** no parser com fixtures reais (CSV anonimizados dos 6 bancos PT), dedup contra `transactions` + `recurring_instances`, rules engine, E2E do fluxo completo (Opção b). (12) **Retenção de ficheiros 180 dias** por default (config em Unit 15); após isso soft-delete do ficheiro; `staging_transactions` e `ingestion_files` mantêm metadata + hash para audit (Opção b).
- **Contexto:** Hoje importer é **40% real, 60% incompleto**, zero testes. CSV parser genérico com mapeamento manual em [src/pages/importer.tsx](src/pages/importer.tsx) (169 linhas) + [src/features/importer/MappingForm.tsx](src/features/importer/MappingForm.tsx) + [src/features/importer/StagingTable.tsx](src/features/importer/StagingTable.tsx). Sem templates de bancos PT. PDF/receipt é stub: `ingest_receipt/index.ts:45` devolve `{ok:true, provider:'mock'}` com `OCR_PROVIDER='mock'`. OFX/MT940/CAMT inexistente. Dedup SQL em `supabase/migrations/20250812030000_importer_phase1.sql:73-96` faz exact match `date + amount/100` só contra `transactions` — **viola Unit 9** (sem dedup contra `recurring_instances`). Zero auto-categorization. Armazenamento decente: bucket `imports/` + tabela `ingestion_files` com sha256; `staging_transactions` com `raw_json`, `normalized_json`, `hash`, `dedupe_status`, `posted_txn_id`. Fluxo upload→map→review→post funcional e editável. Sem progress indicator; cap hardcoded de 1000 linhas. Rotas `/personal/importar` + `/family/importar` (Unit 13 manda unificar). [src/pages/Personal.tsx:1](src/pages/Personal.tsx) tem lazy import quebrado. Fallback em [src/services/importer.ts:76-101](src/services/importer.ts) para `create_regular_transaction` se Edge Function falhar — ok.
- **Razão:**
  - **(1) Templates PT:** mapeamento manual é fricção brutal (5 min por extrato); 6 bancos cobrem ~90% do mercado PT.
  - **(2) OCR parked:** implementação correta exige investimento ($0.0015/recibo GCV + edge cases recibos térmicos) sem valor claro no MVP; CSV/OFX resolvem 95% do valor; stub atual engana user — remover.
  - **(3) Fuzzy vs exact:** FX rounding (€0,01-€0,02), datas diferentes entre data-valor e data-movimento, pagamentos com débito diferido — exact match tem falsos negativos constantes.
  - **(4) Dedup `recurring_instances`:** sem isto Unit 9 não fecha; user importa extrato e vê cada salário duplicado.
  - **(5) Rules engine + seed:** cada linha categorizada à mão em extrato de 200 linhas = 1h; regras automáticas + seed PT poupam 80% do tempo no primeiro uso.
  - **(6) OFX:** formato popular em bancos PT (Millennium, CGD exportam); MT940/CAMT são corporate.
  - **(7) Auto-deteção:** fricção-zero; falhas visíveis (user corrige).
  - **(8) Sem cap:** user com migração histórica (2 anos) passa do limite; batches + progress é UX padrão.
  - **(9) `/app/import`:** Unit 13 manda; scope toggle determina conta-alvo candidata.
  - **(10) Per-row errors:** toast genérico perde info em ficheiros grandes; badge por linha permite triagem.
  - **(11) Testes 80%:** importer é fiscal-critical (alimenta budgets, reports, goals, payroll integration).
  - **(12) Retenção 180d:** GDPR-friendly; config em Unit 15; audit trail via hash mantém integridade.
- **Depende de / Afeta:** Depende de Unit 1 (scope), Unit 2 (`amount_cents`, `operation_id=hash(file_sha256|row_index)` para idempotência), Unit 5 (target account), Unit 6 (transactions criadas + idempotência), Unit 9 (dedup contra `recurring_instances` — **blocker mútuo**; fecha decisão da Unit 9 que o importer tem de marcar `posted`), Unit 13 (rota `/app/import` scope-aware). Afeta Unit 10 (importações frescas alimentam `get_kpis`/breakdown sem delay), Unit 11 (importer pode marcar `recurring_instance` de salário como `posted` quando transferência do IBAN patronal aparecer no extrato), Unit 15 (Settings tem "Importações: retenção, gestão de regras, templates, histórico de importações"), Unit 16 (observabilidade dos Edge Functions + rate limits; background job queue para ficheiros grandes).
- **Supersedes:** Finaliza decisão da Unit 9 sobre fluxo `importer → recurring_instances.posted` (aqui é onde implementa).
- **Implicações — Modelo de dados (DDL):**
  - **`import_profiles` (existe, manter):** mantém mapeamentos custom do user.
  - **`bank_templates` (nova):** `id uuid PK`, `bank_code text NOT NULL` (values: `'MILLENNIUM_BCP'`, `'SANTANDER_TOTTA'`, `'CGD'`, `'NOVO_BANCO'`, `'ACTIVOBANK'`, `'MONTEPIO'`, `'BPI'`), `format text CHECK (format IN ('csv','ofx'))`, `header_signature text[]` (strings canónicas a detetar no header), `mapping jsonb` (date_col, amount_col, description_col, debit_sign, decimal_separator, date_format, encoding), `locale text DEFAULT 'pt-PT'`, `active boolean NOT NULL DEFAULT true`.
  - **Seed 2026**: 7 linhas (6 + BPI bonus) com mapeamento testado contra extratos reais anonimizados.
  - **`import_categorization_rules` (nova):** `id uuid PK`, `user_id uuid?`, `family_id uuid?`, `scope text NOT NULL CHECK (scope IN ('user','family','system_seed'))`, `priority smallint NOT NULL DEFAULT 100`, `match_field text NOT NULL CHECK (match_field IN ('description','counterparty','amount_range','merchant_code'))`, `match_type text NOT NULL CHECK (match_type IN ('contains','regex','equals','range','starts_with'))`, `pattern text NOT NULL` (ou jsonb para `range`), `category_id uuid NOT NULL FK categories`, `notes_template text?`, `active boolean NOT NULL DEFAULT true`, `created_at timestamptz`.
  - **Seed `system_seed` ~30 regras PT**: LIDL/PINGO/CONTINENTE/AUCHAN/JUMBO/INTERMARCHE→Supermercado; GALP/BP/REPSOL/CEPSA→Combustível; NOS/MEO/VODAFONE/NOWO→Telecomunicações; EDP/GALP GAS/GOLD ENERGY→Energia; MB WAY→Transferência; MULTIBANCO/LEVANTAMENTO→Levantamento; Caixa Automática→Levantamento; COMISSAO/TAXA BANCARIA→Despesas Bancárias; IUC/IMI/IRS/ACT/AT→Impostos; FARMACIA→Saúde; CTT→Serviços Postais; SEG SOCIAL→Segurança Social; etc.
  - **`staging_transactions` (mudanças):**
    - Adicionar `error_code text?`, `error_detail text?`, `row_status text NOT NULL CHECK (row_status IN ('ok','warning','error')) DEFAULT 'ok'`.
    - Adicionar `matched_recurring_instance_id uuid? FK recurring_instances(id)` — quando dedup encontra match contra Unit 9.
    - Adicionar `category_id uuid? FK categories` — regra aplicada ou selecção manual.
    - Adicionar `applied_rule_id uuid? FK import_categorization_rules(id)` (auditoria).
  - **`ingestion_files` (mudanças):**
    - Adicionar `detected_format text CHECK (detected_format IN ('csv','ofx','unknown'))`.
    - Adicionar `detected_bank text?` (bank_code do template detetado).
    - Adicionar `soft_deleted_at timestamptz?` para retenção 180d.
    - Adicionar `total_rows integer?`, `ok_rows integer?`, `error_rows integer?`, `duplicate_rows integer?`, `matched_recurring_rows integer?`.
  - **Função `refresh_staging_dedupe` (reescrever):** em vez de só exact match contra `transactions`, passa a:
    1. Fuzzy contra `transactions` (|date|≤2d ∧ |amount|≤€0,02 ∧ mesmo account → `duplicate`; |date|≤5d ∧ exact amount ∧ description similar ≥0.7 Levenshtein → `probable_duplicate`).
    2. Fuzzy contra `recurring_instances(status IN ('pending','confirmed'))` → se match, marca `dedupe_status='matches_recurring'`, regista `matched_recurring_instance_id`.
  - **Função `post_staging` (mudanças):** quando row tem `matched_recurring_instance_id`, em vez de inserir nova transaction, chama `confirm_recurring_instance(instance_id, amount_cents_override, notes)` da Unit 9 que já marca `posted`.
  - **Bucket `imports/`** — RLS via `user_id`; retention policy via cron que corre a partir do `daily-scheduler` (Unit 9) movendo ficheiros >180d para soft-delete.
- **Implicações — Parsers (TypeScript):**
  - `src/features/importer/parsers/csv-generic.ts` — parser actual, renomear.
  - `src/features/importer/parsers/csv-bank-template.ts` — aplica `bank_templates.mapping` automaticamente.
  - `src/features/importer/parsers/ofx.ts` — novo, usa `ofx-js`.
  - `src/features/importer/parsers/detect-format.ts` — sniff: CSV (delimiter + PT/EN headers) vs OFX (`<OFX>`).
  - `src/features/importer/parsers/detect-bank.ts` — compara header CSV contra `bank_templates.header_signature`.
  - `src/features/importer/rules/apply-rules.ts` — aplica `import_categorization_rules` em ordem de prioridade.
  - `src/features/importer/dedup/fuzzy-match.ts` — Levenshtein + tolerance helpers; usado pelo SQL via RPC wrapper para testes unitários.
- **Implicações — UI:**
  - Rota `/app/import` scope-aware.
  - Upload step: drag&drop; preview do formato detetado ("CSV - Millennium BCP detetado" ou "OFX - Santander Totta"); user pode override.
  - Mapping step só aparece se formato é `csv` sem template detetado.
  - Staging table:
    - Coluna "Estado" com badge `ok|warning|error|duplicate|probable_duplicate|matches_recurring`.
    - Linhas `matches_recurring` expandem para mostrar a instância original da Unit 9 e oferecem botão "Confirmar match" (default) ou "Criar transação nova".
    - Linhas `probable_duplicate` mostram a transação existente e oferecem "Ignorar" (default) ou "Importar mesmo assim".
    - Coluna "Categoria" mostra a regra aplicada + ícone "⚡ Auto" com tooltip; user pode override; opção "Criar regra a partir daqui" abre modal.
  - Progress bar em tempo real (polling 1s) para ficheiros grandes.
  - Página `/app/import/history` (Unit 15) com lista de importações passadas, filtros, link para ficheiro original (até 180d).
- **Evidência a preservar:**
  - Apagar: UI de "Importar recibo" + `supabase/functions/ingest_receipt/` + env vars `GCV_KEY`/`GCV_ENDPOINT`; lazy import quebrado em [src/pages/Personal.tsx:1](src/pages/Personal.tsx); cap hardcoded de 1000 em `ingest_csv/index.ts:158`.
  - Refactor: [src/services/importer.ts](src/services/importer.ts) (novos Edge Function endpoints), [src/features/importer/MappingForm.tsx](src/features/importer/MappingForm.tsx) (auto-deteção), [src/features/importer/StagingTable.tsx](src/features/importer/StagingTable.tsx) (novos estados, modal de regras), `supabase/migrations/*importer*` (nova `refresh_staging_dedupe`, novas tabelas).
  - Criar: `src/features/importer/bank-templates/*.ts` (7 templates), `src/features/importer/parsers/*.ts` (detect-format, detect-bank, csv-bank-template, ofx), `src/features/importer/rules/apply-rules.ts`, `src/features/importer/dedup/fuzzy-match.ts`, `supabase/migrations/NNNN_importer_phase2.sql` (tabelas novas + seed + função reescrita).
  - Testes novos: 6 fixtures CSV por banco (Millennium, Santander, CGD, NB, ActivoBank, Montepio) + 1 OFX; dedup fuzzy hits com FX rounding; dedup recurring instance marca `posted` sem duplicar; rule seed LIDL categoriza Supermercado; rule custom user cria e aplica; ficheiro 5000 linhas processado em batches com progress; retenção 180d move ficheiro para soft-delete; formato OFX auto-detetado; error per-row mostra razão; `operation_id` idempotente impede repost.
- **Estado:** decidido

#### Unit 15: Settings & Profile
- **Data:** 2026-04-20
- **Decisão:** Dezassete sub-decisões. (1) **Rota unificada `/app/settings` scope-aware** com tabs *Profile · Preferences · Notifications · Data & Privacy · Family* (tab "Family" só visível quando `scope=family` ∧ role ∈ {owner,admin}); rotas legacy `/personal/settings` e `/family/settings` viram redirects. (2) **Apagar duplicação**: eliminar `src/components/SettingsForm.tsx`; fatiar `src/features/personal/PersonalSettings.tsx` (850 linhas) em `<ProfileSettings />`, `<PreferencesSettings />`, `<NotificationsSettings />`, `<DataPrivacySettings />`, `<FamilySettingsPanel />`; schema único `userPreferencesSchema` em `src/validation/`. (3) **Migrar preferências JSONB → tabela tipada `user_preferences`** com colunas dedicadas + migração one-shot do JSONB; drop de `profiles.personal_settings` após backfill; razão: Edge Functions precisam de queries SQL rápidas por canal/evento. (4) **Timezone forçado `Europe/Lisbon` no MVP** (coluna `timezone` existe mas não editável); destravar quando SaaS multi-país. (5) **Password change real** via `supabase.auth.updateUser({password})`; remover stub `"Aqui implementaria a lógica"`. (6) **MFA/2FA parked-aceite** — revisitar pós-SaaS com Supabase TOTP nativo. (7) **Avatar upload real**: bucket `avatars` (público read, RLS write owner), `react-easy-crop`, cap 2MB, substitui input de URL. (8) **Onboarding geral + "rever"**: wizard pós-signup leve (scope inicial → 1.ª conta → convidar família opcional → salário Unit 11 opcional; skipable); botão "Rever onboarding" em Profile; persistido em `user_preferences.onboarding_completed_at`. (9) **GDPR — account deletion**: UI em Data & Privacy com confirmação typed-string "APAGAR", cria `deletion_tokens` (tabela já existe, 30d cooling-off), Edge Function `process-account-deletion` integrada no `daily-scheduler` Unit 9, email de confirmação via Resend (reusa infra Unit 13). (10) **GDPR — data export**: Edge Function `export-user-data` gera ZIP (CSVs por tabela do user) → link por email; rate limit 1/semana via `export_audit` (tabela já existe). (11) **Notifications — matriz evento × canal**: ~11 eventos (`goal_target_reached`, `goal_deadline_near`, `budget_80pct`, `budget_100pct`, `recurring_needs_confirm`, `recurring_posted`, `card_statement_ready`, `family_invite`, `family_audit`, `large_inbound`, `large_outbound`, `import_completed`) × 2 canais (email, in-app Unit 9); push parked; tabela de switches; defaults: email+inbox para críticos, só inbox para info. (12) **Rule management UI (fecha Unit 14)**: tab "Regras" com CRUD de `import_categorization_rules`; seed rules visíveis com `is_system=true` não editáveis mas desativáveis por user. (13) **Dashboard widget customization parked-aceite** — Unit 10 ficou minimal; revisitar com pedido de beta users. (14) **Family tab (só owner/admin, scope=family)** com sub-secções *Info · Membros (lista+invite+role+soft-remove Unit 13) · Audit log 180d (Unit 13) · Zona perigosa*. (15) **Theme**: manter light/dark/system, garantir `ThemeProvider` real com swap `<html class="dark">`, persistir em `user_preferences.theme`. (16) **Language**: pt-PT + en-US só; outros idiomas parked. (17) **Currency no settings = display fallback** — Unit 5 define currency por conta; preferência do user só aplica quando não há conta (ex: primeira sessão).
- **Contexto:** Auditoria revelou fragmentação severa. Rotas: `/personal/settings`, `/family/settings` (via FamilyContext), `/app/profile` — **não existe `/app/settings`**. Duplicação: `SettingsForm.tsx` (275 linhas) + `PersonalSettings.tsx` (850 linhas) + `FamilySettings.tsx` (680 linhas) com lógica de tema/notificações divergente. Preferências em JSONB `profiles.personal_settings` — não tipado, não indexável. Timezone só browser (`Intl`), não persistido. Password change com UI mas backend stub (`PersonalSettings.tsx:302`). Avatar só input URL. Zero MFA/2FA. `deletion_tokens` table + RLS existe (`20260418100000_rls_deletion_tokens.sql`) mas **sem UI nem Edge Function**. `export_audit` table existe, não usada. Notificações só 6 toggles globais (email/push/goal/budget/transaction/local) sem granularidade. Onboarding só payroll (`PayrollOnboardingWizard.tsx`), sem wizard geral nem "rever". Rule management: zero UI. Família — UI de membros scattered em FamilyContext, sem agregação em settings.
- **Razão:**
  - **(1) Rota unificada:** Unit 1 (scope como estado) + Unit 13 (materialização) mandam UI única.
  - **(2) Apagar duplicação:** três ficheiros a fazer o mesmo = bugs divergentes garantidos; refactor é pré-requisito para (11) matriz de notificações.
  - **(3) JSONB→tabela tipada:** `daily-scheduler` Unit 9 precisa de `SELECT user_id FROM user_preferences WHERE notif_budget_80pct_email = true`; em JSONB é lento e não indexável; type safety em migration + TS types gerados.
  - **(4) Timezone Europe/Lisbon:** MVP é PT; picker de tz = UI desnecessária que ninguém usa; coluna fica reservada.
  - **(5) Password real:** stub em produção é quebra de confiança; 10 linhas de código.
  - **(6) MFA parked:** Supabase TOTP é significativo em UI (enroll, QR, backup codes, recovery); MVP família/friends aceita password+email.
  - **(7) Avatar upload:** input de URL é amador; bucket + crop é padrão.
  - **(8) Onboarding:** Unit 4 decidiu híbrido mas nunca foi implementado além de payroll; sem onboarding geral, users caem numa Dashboard vazia.
  - **(9) Account deletion:** RGPD Art. 17 (direito ao esquecimento) — **obrigatório antes de abrir a friends/SaaS**; 30d cooling-off protege de arrependimento e erro.
  - **(10) Data export:** RGPD Art. 15/20 (acesso + portabilidade) — **obrigatório antes de SaaS**; ZIP de CSVs é o mínimo decente.
  - **(11) Matriz notificações:** 6 toggles globais = "tudo ou nada" frustrante; user quer email só para budget_100pct e inbox para resto.
  - **(12) Rule UI:** Unit 14 decidiu rules engine + seed mas sem UI user não pode criar/editar; loop da Unit 14 fica aberto.
  - **(13) Widget custom parked:** Unit 10 escolheu minimal; custom dashboard é feature-creep sem evidência de demand.
  - **(14) Family tab:** Unit 13 decidiu audit log, roles, soft-remove — precisa de UI concentrada; dispersão em contextos é hoje o problema.
  - **(15) Theme real:** UI existe, verificar que `ThemeProvider` swap `<html class="dark">` (atual aplica via classes Tailwind sem provider global = potencial flash of unstyled content).
  - **(16) Línguas:** MVP PT; EN só porque infra já existe; outros = polish.
  - **(17) Currency fallback:** Unit 5 mandou currency por conta; user-level só serve para formatar antes de haver conta.
- **Depende de / Afeta:** Depende de Unit 1 (scope), Unit 4 (onboarding), Unit 9 (inbox + daily-scheduler para notifs + deletion), Unit 10 (tab personality), Unit 13 (family members/audit UI), Unit 14 (rule UI). Afeta Unit 8 (budget alert channels via `user_preferences`), Unit 9 (cron reads `user_preferences` para saber destinatários), Unit 13 (`send-family-invite` lê language prefs), Unit 14 (retenção 180d exposta + regras CRUD), Unit 16 (observabilidade das Edge Functions `process-account-deletion` e `export-user-data`, scheduled jobs de cleanup de deletion_tokens e export_audit).
- **Supersedes:** Consolidação final das rotas `/personal/*` → redirects (Unit 13 já anunciou; aqui aplica à settings area). Fecha o loop da Unit 14 (rule CRUD) e da Unit 13 (family members/audit UI concentrada).
- **Implicações — Modelo de dados (DDL):**
  - **Nota de extensibilidade da matriz de notificações:** optou-se por colunas tipadas (em vez de junction table `user_notification_prefs(user_id, event, channel, enabled)`) para permitir queries SQL diretas no `daily-scheduler` Unit 9 sem joins. Custo: adicionar um evento novo = migration nova. **Padrão para novos eventos:** migration adiciona colunas `notif_<event>_email bool NOT NULL DEFAULT <sensible>` e `notif_<event>_inapp bool NOT NULL DEFAULT <sensible>`. Se a matriz crescer para >20 eventos, revisitar a decisão e considerar refactor para junction table (decisão adiada até houver evidência de fricção).
  - **`user_preferences` (nova):** `user_id uuid PK FK auth.users`, `language text NOT NULL DEFAULT 'pt-PT' CHECK (language IN ('pt-PT','en-US'))`, `currency text NOT NULL DEFAULT 'EUR'`, `timezone text NOT NULL DEFAULT 'Europe/Lisbon'`, `theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system'))`, `compact_mode boolean NOT NULL DEFAULT false`, `show_currency_symbol boolean NOT NULL DEFAULT true`, `onboarding_completed_at timestamptz?`, `notif_goal_target_reached_email boolean NOT NULL DEFAULT true`, `notif_goal_target_reached_inapp boolean NOT NULL DEFAULT true`, `notif_goal_deadline_near_email boolean NOT NULL DEFAULT false`, `notif_goal_deadline_near_inapp boolean NOT NULL DEFAULT true`, `notif_budget_80pct_email boolean NOT NULL DEFAULT false`, `notif_budget_80pct_inapp boolean NOT NULL DEFAULT true`, `notif_budget_100pct_email boolean NOT NULL DEFAULT true`, `notif_budget_100pct_inapp boolean NOT NULL DEFAULT true`, `notif_recurring_needs_confirm_email boolean NOT NULL DEFAULT false`, `notif_recurring_needs_confirm_inapp boolean NOT NULL DEFAULT true`, `notif_recurring_posted_email boolean NOT NULL DEFAULT false`, `notif_recurring_posted_inapp boolean NOT NULL DEFAULT false`, `notif_card_statement_ready_email boolean NOT NULL DEFAULT true`, `notif_card_statement_ready_inapp boolean NOT NULL DEFAULT true`, `notif_family_invite_email boolean NOT NULL DEFAULT true`, `notif_family_invite_inapp boolean NOT NULL DEFAULT true`, `notif_family_audit_email boolean NOT NULL DEFAULT false`, `notif_family_audit_inapp boolean NOT NULL DEFAULT true`, `notif_large_inbound_email boolean NOT NULL DEFAULT false`, `notif_large_inbound_inapp boolean NOT NULL DEFAULT true`, `notif_large_outbound_email boolean NOT NULL DEFAULT false`, `notif_large_outbound_inapp boolean NOT NULL DEFAULT true`, `notif_import_completed_email boolean NOT NULL DEFAULT false`, `notif_import_completed_inapp boolean NOT NULL DEFAULT true`, `large_threshold_cents bigint NOT NULL DEFAULT 50000` (€500 default para large_* triggers), `updated_at timestamptz NOT NULL DEFAULT now()`.
  - **Migration one-shot:** `INSERT INTO user_preferences (user_id, language, currency, theme, ...) SELECT user_id, COALESCE(personal_settings->>'language', 'pt-PT'), COALESCE(personal_settings->>'currency', 'EUR'), ... FROM profiles WHERE personal_settings IS NOT NULL ON CONFLICT DO NOTHING;` depois `ALTER TABLE profiles DROP COLUMN personal_settings;`.
  - **RLS `user_preferences`:** `SELECT/UPDATE` só `user_id = auth.uid()`; `INSERT` no signup via trigger `on_auth_user_created` que insere linha default.
  - **`deletion_tokens` (já existe):** adicionar coluna `cooling_off_until timestamptz NOT NULL` (30d); Edge Function lê e processa quando `now() > cooling_off_until`. UI confirmação typed "APAGAR" + email confirmação Resend + botão "cancelar dentro do prazo".
  - **`export_audit` (já existe):** garantir colunas `user_id`, `started_at`, `completed_at`, `file_path`, `file_size_bytes`, `error?`; rate limit via `SELECT count(*) FROM export_audit WHERE user_id = ? AND started_at > now() - interval '7 days'` < 1.
  - **Bucket `avatars/` (novo):** público read, RLS write `(storage.foldername(name))[1] = auth.uid()::text`; cleanup via trigger em profile deletion.
  - **Bucket `exports/` (novo):** privado; RLS read/write só owner; retention 7d (arquivado depois apagado pelo `daily-scheduler`).
- **Implicações — Edge Functions / Serviços:**
  - **Novo `supabase/functions/process-account-deletion/`:** invocado pelo `daily-scheduler` Unit 9; seleciona `deletion_tokens WHERE cooling_off_until < now() AND processed_at IS NULL`; para cada user apaga dados em ordem (transactions, goals, budgets, accounts, payslips, imports, family_members, profiles, auth.users) dentro de transaction; regista em `deletion_audit` table nova; email final de confirmação.
  - **Novo `supabase/functions/export-user-data/`:** HTTP POST com `user_id` (validação JWT); gera ZIP com CSVs por tabela (transactions.csv, accounts.csv, budgets.csv, goals.csv, payslips.csv, imports.csv, categories.csv); upload para bucket `exports/<user_id>/<timestamp>.zip`; cria linha em `export_audit`; envia email via Resend com link pré-assinado (24h); rate limit aplicado.
  - **`send-family-invite` (Unit 13, refactor):** lê `user_preferences.language` do invitee-se-existir para escolher template.
  - **`daily-scheduler` (Unit 9, refactor):** ao decidir envio de email, consulta `user_preferences.notif_{event}_{channel}` em vez de JSONB.
  - **Novo serviço `src/services/userPreferences.ts`:** CRUD + hook `useUserPreferences()` (React Query), invalidação ao update.
  - **Novo serviço `src/services/accountDeletion.ts`:** `requestDeletion()`, `cancelDeletion()`, `getStatus()`.
  - **Novo serviço `src/services/dataExport.ts`:** `requestExport()`, `getLastExport()`.
  - **Apagar `src/services/settings.ts`:** substituído por `userPreferences` + `familySettings` (renomeado a partir do que sobra).
  - **`src/services/personalSettings.ts`:** substituído por `userPreferences.ts`.
- **Implicações — UI:**
  - **Nova rota `/app/settings`** com 5 tabs (scope-aware).
  - **Tab Profile:** nome, email (read-only + botão "Change email" → Supabase flow), phone, birth_date, avatar upload com crop, botão "Alterar palavra-passe", botão "Rever onboarding", card com `ProfileAuditList` (já existe).
  - **Tab Preferences:** language (pt-PT/en-US select), currency (display fallback), theme (light/dark/system toggle), compact_mode toggle, show_currency_symbol toggle; timezone read-only ("Europe/Lisbon — fixo no MVP"); large_threshold_cents input (€).
  - **Tab Notifications:** tabela 11 eventos × 2 canais (switches); header com "Defaults sensatos" + botão reset; nota sobre push parked.
  - **Tab Data & Privacy:** card "Exportar dados" (botão "Pedir export" → status "pedido em X, chega em email"), card "Apagar conta" (collapse zona perigosa, typed-string "APAGAR", countdown de 30d se pedido ativo, botão "Cancelar pedido"), link para política de privacidade.
  - **Tab Family** (condicional): sub-accordion *Info · Membros · Audit log · Zona perigosa*; reaproveita componentes existentes refatorados.
  - **Wizard de onboarding geral:** novo `src/features/onboarding/OnboardingWizard.tsx` com 4 steps (scope, conta, família opcional, salário opcional); skipable em cada step; grava `user_preferences.onboarding_completed_at`; route guard em `/app` que força redirect para `/app/onboarding` se `onboarding_completed_at IS NULL` (exceto em paths de settings/profile).
  - **Nova rota `/app/settings/rules`:** CRUD de `import_categorization_rules` (fecha Unit 14).
  - **ThemeProvider:** wrap em `App.tsx` que aplica `document.documentElement.classList.toggle('dark', ...)` com base em `user_preferences.theme`; elimina FOUC.
- **Evidência a preservar:**
  - Apagar: `src/components/SettingsForm.tsx`, `src/services/settings.ts`, `src/services/personalSettings.ts`, `profiles.personal_settings` (após migração), stub de password em `PersonalSettings.tsx:302`, rotas `/personal/settings` e `/family/settings` (→ redirects).
  - Refactor: `src/features/personal/PersonalSettings.tsx` (850 linhas → 5 sub-componentes), `src/features/family/FamilySettings.tsx` (integrado como tab Family), `src/contexts/LocaleProvider.tsx` (lê `user_preferences` em vez de JSONB), `src/components/ProfileForm.tsx` (avatar upload em vez de URL input).
  - Criar: `supabase/migrations/NNNN_user_preferences.sql` (tabela + migração JSONB + RLS + trigger signup), `supabase/functions/process-account-deletion/`, `supabase/functions/export-user-data/`, `src/features/settings/tabs/*.tsx` (5 tabs), `src/features/settings/NotificationsMatrix.tsx`, `src/features/settings/AvatarUploader.tsx`, `src/features/onboarding/OnboardingWizard.tsx`, `src/features/importer/ImportRulesManager.tsx`, `src/services/userPreferences.ts`, `src/services/accountDeletion.ts`, `src/services/dataExport.ts`, `src/components/ThemeProvider.tsx`.
  - Testes novos: `user_preferences` CRUD + defaults em signup; migração JSONB→linhas preserva valores; deletion token 30d cooling-off respeitado; deletion cascata apaga todos os dados do user sem violar FKs; export ZIP contém todas as tabelas do user; export rate limit 1/semana bloqueia 2.º pedido; avatar upload com crop + cap 2MB; password change real muda hash em Supabase; onboarding wizard grava `completed_at`; "Rever onboarding" força refazer; notif matriz — `daily-scheduler` mock com user opt-out de budget_80pct_email só envia in-app; rule CRUD via UI persiste e aplica; theme switch aplica classe no `<html>` sem FOUC; tab Family só aparece para owner/admin; redirects `/personal/settings` → `/app/settings`; typed-string "APAGAR" obrigatório.
- **Estado:** decidido

#### Unit 16: Plumbing Cross-Cutting
- **Data:** 2026-04-20
- **Decisão:** Catorze sub-decisões + 5 parked-aceite. (1) **Sentry (frontend + Edge Functions)** via `@sentry/react` + `@sentry/vite-plugin` (source maps, release tagging) + `@sentry/deno` em EFs; tags `{user_id pseudonimizado, scope, feature}`; integra com `ErrorBoundary` e com (3) cron wrapper; **blocker para friends beta**. (2) **`edgeLogger` unificado** em `supabase/functions/_shared/logger.ts` com `correlation_id` (UUID/req) + contexto `{user_id, family_id, function, duration_ms}`; `warn+error` emitem para Sentry; aplicar em todas as EFs (existentes + `daily-scheduler` Unit 9, `send-family-invite` Unit 13, `process-account-deletion` Unit 15, `export-user-data` Unit 15, `ingest_csv` refactor Unit 14). (3) **`job_runs` table + DLQ** `(id, job_name, started_at, finished_at, status, error_detail, retry_count, payload_jsonb)` com wrapper `run_cron_job(name, fn)` que regista start/end, captura exceptions, re-tenta 3× com backoff exponencial, ao 4º falha → `status='failed'` + Sentry alert; dashboard leve em `/app/settings/ops` só para role=owner de qualquer família. (4) **Rate limit partilhado** via tabela `edge_rate_limits(user_id, endpoint, ts)` + helper `check_rate_limit(user_id, endpoint, window, max)`; defaults: `send-family-invite` 10/h, `export-user-data` 1/semana, `ingest_csv` 20/dia, `process-account-deletion` 1/dia. (5) **RLS tests completos** com template partilhado `tests/integration/rls/_template.ts` que valida isolamento cross-user e cross-family (SELECT/INSERT/UPDATE/DELETE) em **todas** as ~25 tabelas com RLS após Units 7/9/13/14/15; CI corre `test:integration` em PR como gate. (6) **E2E Playwright — abandonar Cypress** (remover deps + `cypress/`, migrar o único teste); flows cobertos: signup→onboarding→1.ª conta→1.ª transação, invite família→aceitar→scope, goal+funding rule→cron reserva, import CSV Millennium→dedup vs recurring→post, payroll contrato→payslip→income, settings tema/notifs, GDPR export, GDPR deletion + cancelar; CI em PR, headless, artifacts on fail. (7) **Coverage thresholds Vitest**: unit geral 70%, services 85%, validation 95%, money math `amount_cents` 100%; CI gate. (8) **A11y**: `eslint-plugin-jsx-a11y` (error level) + `@axe-core/playwright` em 5 páginas chave (Login, Dashboard, Settings, Import, Payroll); CI gate. (9) **i18n hardcoded cleanup**: regra ESLint `no-restricted-syntax` proíbe `'pt-PT'`/`'pt'` em `toLocale*`; centralizar em `useLocale()` que lê `user_preferences` (Unit 15); migration one-shot elimina os ~20 hardcodes identificados. (10) **CSP + security headers** via Vite plugin meta CSP: `connect-src self + Supabase URL + Resend + Sentry`, `script-src self`, `style-src self unsafe-inline`; MVP em GitHub Pages via meta tag; migração para Vercel/Netlify com `_headers` quando SaaS. (11) **Type drift + migration snapshot em CI**: (a) step CI corre `npm run types:gen` contra staging + `git diff --exit-code database.types.ts`; (b) step CI corre `supabase db reset` + reaplica migrations + `pg_dump --schema-only` e compara com `supabase/schema-snapshot.sql` commitado; ambos PR gates. (12) **Node pinning + engines + Husky lint-staged**: `.nvmrc` `20.17.0`, `package.json` `engines: node >=20.17 <21, npm >=10`; Husky pre-commit → `lint-staged` (eslint+prettier+`tsc --noEmit` em staged); pre-push → `npm test -- --run --changed`. (13) **Dependabot + audit gate**: `.github/dependabot.yml` weekly, grouping patches, auto-merge patches após CI; adicionar `npm audit --audit-level=high` ao `security.yml` como PR gate. (14) **Env validation**: `scripts/validate-env.ts` corre em `predev`/`prebuild`, lê `.env.example` como source of truth, valida var presente + não vazia + formato (URL, UUID); Resend key e Sentry DSN entram no `.env.example`.
- **Parked-aceite:** (a) Lighthouse CI como PR gate (MVP: warning-only via Sentry metrics); (b) Grafana/Prometheus (Supabase Studio + Sentry suficientes no MVP); (c) MFA/2FA para admins (mirror de Unit 15) — **⚠ flag pré-SaaS blocker**: roles `owner`/`admin` (Unit 13) têm poder destrutivo (apagar família, remover members, transferir ownership); aceitável em friends beta com password+email mas **deve ser resolvido antes de abrir SaaS público**; plan de SaaS-launch deve levantar isto como gate; (d) OpenTelemetry tracing distribuído (pós-SaaS multi-tenant); (e) Chaos/load testing (pós-SaaS).
- **Pré-requisito de ordem:** a migração Cypress→Playwright (sub-decisão 6) é **blocker para qualquer plan que tenha E2E tests novos** — Units 5, 7 referenciam `cypress/e2e/*.cy.ts` em "Testes existentes a preservar"; esses ficheiros são preservados *em conteúdo* (portados para `tests/e2e/playwright/*.spec.ts`) mas não em localização. Plan sequence recomendada: Unit 16 sub-decisão 6 executada cedo no roadmap; restantes plans que tocam E2E escrevem diretamente em Playwright.
- **Contexto:** Auditoria revelou prontidão heterogénea para friends beta. Observabilidade externa nula (logger custom dev-only, zero Sentry). E2E: 1 teste Cypress (`tests/e2e/cypress/recurrents_smoke.cy.ts`) num universo de 8+ flows críticos. A11y: `@axe-core/react` e Radix presentes mas zero linting ou testes a11y. RLS tests: só 3-4 tabelas cobertas (`categories`, `transactions`) num universo de ~25 tabelas com RLS após Units 7/9/13/14/15. Cron: `pg_cron` ativo com 2 jobs (`reminders_push_notify`, `recurrents_daily`) mas falhas silenciosas, sem retry, sem DLQ, sem alertas. Rate limit: zero em produção, só teste em `export-payslips`. i18n: 20+ hardcodes `'pt-PT'` em `toLocaleDateString`/`toLocaleString` em componentes família/cashflow/account. CI: `lint+typecheck+test+build` mas **E2E e integration scripts existem mas não correm em PR**. Type drift: `types:gen` existe como npm script, não automatizado. Migrations: 122 sem snapshot ou reset em CI. Husky existe sem `lint-staged` (lint total em cada commit). Sem `.nvmrc` ou `engines`. Cypress + Playwright ambos configurados = desperdício e manutenção dupla. CSP inexistente. ESLint ignora supabase folder. `@axe-core/react` instalado mas nunca importado.
- **Razão:**
  - **(1) Sentry:** friends beta envolve users reais a reportar bugs via WhatsApp; sem stack trace remoto, debugging é adivinhar; é o maior ROI de qualquer investimento em plumbing.
  - **(2) edgeLogger:** 14 EFs hoje + 5 novas = 19 pontos de falha invisíveis sem correlation_id + contexto estruturado.
  - **(3) job_runs + DLQ:** Unit 9 cron é o coração operacional; sem retry silencioso + alerta, um bug em produção fica invisível dias.
  - **(4) Rate limit:** sem isto, `send-family-invite` (Unit 13) + `export-user-data` (Unit 15) são vetores de abuso fácil (spam + DoS).
  - **(5) RLS tests:** ~25 tabelas com `family_id`/`user_id` + RLS complexo; uma única policy mal escrita expõe dados cross-tenant — risco de vazamento em SaaS é game-over.
  - **(6) Playwright + migração Cypress:** manter dois frameworks = testes duplicados, devs confusos; Playwright tem a11y addon e parallelização melhor.
  - **(7) Coverage thresholds:** sem gate, coverage derrapa ao longo do tempo; money math 100% é não-negociável (é fiscal-critical).
  - **(8) a11y:** Radix dá primitivos acessíveis mas composições quebram WCAG; linting captura 80% dos problemas em PR.
  - **(9) i18n cleanup:** Unit 15 prometeu pt-PT+en-US reais; com 20 hardcodes, switching de idioma parece amador.
  - **(10) CSP:** defense in depth contra XSS/script injection; trivial de ligar, catastrófico quando falta.
  - **(11) Type/schema drift:** 122 migrations + TS types manualmente regenerados = janela garantida para tipos errados em produção.
  - **(12) Node pinning + lint-staged:** UX de dev; sem `.nvmrc` quem clona não sabe a versão; Husky lento empurra devs para `--no-verify`.
  - **(13) Dependabot + audit gate:** 100+ deps, vulns chegam; sem gate, sobem para main.
  - **(14) Env validation:** erro mais comum em onboarding de devs ou deploys; falha early com mensagem clara poupa horas.
- **Depende de / Afeta:** Depende de **todas** as Units 1-15 (consome e testa decisões). Afeta Unit 8 (budget notifs via DLQ de delivery), Unit 9 (daily-scheduler dentro de `run_cron_job` + Sentry), Unit 13 (`send-family-invite` com rate limit real + Sentry + structured log), Unit 14 (`ingest_csv` com rate limit + structured log + migration para deno `edgeLogger`), Unit 15 (`process-account-deletion` + `export-user-data` com Sentry + rate limit), Unit 7 (goal-funding-cron dentro de `run_cron_job`), Unit 4 (onboarding wizard com Sentry breadcrumbs).
- **Supersedes:** Nada (é o topo da pirâmide operacional).
- **Implicações — Modelo de dados (DDL):**
  - **`job_runs` (nova):** `id uuid PK`, `job_name text NOT NULL`, `started_at timestamptz NOT NULL DEFAULT now()`, `finished_at timestamptz?`, `status text NOT NULL CHECK (status IN ('running','succeeded','failed','retrying')) DEFAULT 'running'`, `error_detail text?`, `retry_count smallint NOT NULL DEFAULT 0`, `payload_jsonb jsonb?`, `correlation_id uuid?`. Índice `(job_name, started_at DESC)` e `(status)`. Retenção 90d via cron.
  - **`edge_rate_limits` (nova):** `user_id uuid NOT NULL`, `endpoint text NOT NULL`, `ts timestamptz NOT NULL DEFAULT now()`. Índice `(user_id, endpoint, ts DESC)`. Cleanup via cron (>7d).
  - **Função `check_rate_limit(p_user_id uuid, p_endpoint text, p_window_seconds int, p_max int) RETURNS boolean`:** conta registos na janela, se excede devolve false; senão insere novo registo e devolve true.
  - **Função `run_cron_job(p_name text, p_fn text)`:** cria linha em `job_runs`, tenta `EXECUTE p_fn`, captura exception, re-tenta 3×, atualiza `status` final. Para Edge Functions (que não são SQL), wrapper TypeScript equivalente em `_shared/cron-wrapper.ts`.
  - **`supabase/schema-snapshot.sql` (novo, versionado):** dump do schema após todas as migrations; regenerado por `scripts/update-schema-snapshot.sh` quando intencional.
- **Implicações — Edge Functions / Serviços:**
  - **Novo `supabase/functions/_shared/logger.ts`:** `edgeLogger(req, { function, user_id?, family_id? })` retorna objeto com `debug/info/warn/error(msg, extra?)` que inclui `correlation_id` em cada log e emite para Sentry em warn+error.
  - **Novo `supabase/functions/_shared/cron-wrapper.ts`:** `runCronJob(name, handler)` regista em `job_runs`, executa, captura exceptions, decide retry.
  - **Novo `supabase/functions/_shared/rate-limit.ts`:** wrapper HTTP que chama `check_rate_limit` RPC antes de executar handler; responde 429 se excedido.
  - **Novo `supabase/functions/_shared/cors.ts`:** helper que aplica CORS headers só aos origins permitidos (lê env `ALLOWED_ORIGINS`).
  - **Refactor obrigatório:** todas as 14 EFs + 5 novas (Unit 9/13/14/15) passam a usar os 4 helpers `_shared/*`.
- **Implicações — CI/CD:**
  - **`.github/workflows/ci.yml` refactor:** jobs paralelos — `lint`, `typecheck`, `test:unit`, `test:integration` (RLS gate), `test:e2e:pw` (Playwright gate), `types-drift`, `schema-snapshot`, `audit`; todos obrigatórios para merge em `main`.
  - **Novo workflow `a11y.yml`:** corre `@axe-core/playwright` em 5 páginas chave; PR comment com relatório.
  - **`.github/dependabot.yml` (novo):** weekly updates, grouping patches.
  - **Scripts novos:** `scripts/validate-env.ts`, `scripts/check-types-drift.sh`, `scripts/update-schema-snapshot.sh`, `scripts/run-rls-tests.sh`.
  - **Husky refactor:** `.husky/pre-commit` → `npx lint-staged`; `.husky/pre-push` → `npm test -- --run --changed`; `package.json` campo `lint-staged` configurado por extensão.
- **Implicações — Frontend / UI:**
  - **Novo `src/lib/sentry.ts`:** init com DSN, environment, release; integra com React Router para breadcrumbs de navegação.
  - **`src/main.tsx`:** chama `initSentry()` antes do `ReactDOM.createRoot`.
  - **`src/components/ErrorBoundary.tsx` refactor:** `componentDidCatch` chama `Sentry.captureException(error, { contexts: { react: { componentStack } } })`.
  - **Nova rota `/app/settings/ops` (dentro da Unit 15 Family tab, só role=owner):** tabela simples de `job_runs` com filtros por job_name/status, expansível para ver `error_detail`.
  - **`src/contexts/LocaleProvider.tsx` + novo `src/hooks/useLocale.ts`:** único ponto de acesso a `{language, currency}`; todos os `toLocale*` calls migram para helpers `formatDate(date)`, `formatCurrency(cents)`, `formatNumber(n)` que leem do context.
  - **Remover:** `cypress/`, `cypress.config.ts`, deps `cypress` + `@cypress/*`, script `test:e2e` (Cypress).
- **Evidência a preservar:**
  - Apagar: Cypress inteiro (`cypress/`, `cypress.config.ts`, `@cypress/*` deps), `@axe-core/react` dev-only import (substituído por `@axe-core/playwright`), hardcodes `'pt-PT'` em componentes (20+ ocorrências).
  - Refactor: `src/components/ErrorBoundary.tsx` (Sentry), `src/main.tsx` (initSentry), `src/shared/lib/logger.ts` (mantém para browser, adiciona bridge Sentry), `src/contexts/LocaleProvider.tsx` (helpers centralizados), todos os 14 EFs + 5 novos (helpers `_shared/*`), `.husky/*`, `.github/workflows/ci.yml`, `.github/workflows/security.yml`, `package.json` (engines + lint-staged + scripts), `.eslintrc*` (jsx-a11y + no-restricted-syntax regra i18n).
  - Criar: `supabase/migrations/NNNN_plumbing.sql` (tabelas `job_runs` + `edge_rate_limits` + funções + cleanup crons), `supabase/functions/_shared/{logger,cron-wrapper,rate-limit,cors}.ts`, `supabase/schema-snapshot.sql`, `src/lib/sentry.ts`, `src/hooks/useLocale.ts`, `src/features/settings/tabs/OpsTab.tsx`, `scripts/validate-env.ts`, `scripts/check-types-drift.sh`, `scripts/update-schema-snapshot.sh`, `.nvmrc`, `.github/dependabot.yml`, `.github/workflows/a11y.yml`, `tests/integration/rls/_template.ts`, `tests/e2e/playwright/*.spec.ts` (8 flows), `docs/runbooks/rotate-secrets.md`, `docs/runbooks/cron-dlq-troubleshooting.md`.
  - Testes novos: `job_runs` regista start/end; `run_cron_job` falha → 3 retries + status `failed` + Sentry event mockado; `check_rate_limit` devolve false ao exceder; `edgeLogger` emite correlation_id consistente; Sentry ErrorBoundary captura error com contexto; 8 flows E2E Playwright passam; 25 tabelas RLS isolamento cross-user+cross-family; `types:gen` sem diff; `pg_dump --schema-only` igual ao snapshot; ESLint falha em hardcode `'pt-PT'`; `@axe-core/playwright` em 5 páginas → 0 violations sériias; coverage thresholds enforced; `npm audit --audit-level=high` limpo; `scripts/validate-env.ts` falha com `.env` faltoso.
- **Estado:** decidido

---

## 7. Histórico do documento

- **2026-04-18** — Criação. Processo, mapa e formato acordados. Decision log vazio.
- **2026-04-18** — Revisão pós-reviewer: adicionados estados `parked-aceite` e `superseded`; protocolos de revisão de decisões anteriores, retoma de `parked`, e retoma de sessão; campos `Depende de / Afeta`, `Evidência a preservar` e `Supersedes / Superseded by` no decision log.
- **2026-04-19** — Decisões registadas: Unit 1 (scope como estado), Unit 2 (refactor incremental do modelo de dados), Unit 3 (flat sidebar + scope toggle), Unit 4 (cleanup auth + onboarding híbrido + OAuth em breve), Unit 5 (separar `credit_cards` de `accounts`, nível avançado, FK dupla + CHECK, currency/order/soft-delete), Unit 6 (transfers como tabela própria + trigger, splits, anexos, hierarquia 1-nível em categorias, sem datas futuras, idempotência obrigatória + reversão universal), Unit 7 (alocação como reserva via `goal_ledger`, funding rules completas com cron + 3 tipos, amortização genérica, prioridades + cascata, cálculo de prazo, contribuições multi-user, fluxo de completion; supersedes parcialmente Unit 2 quanto a `goal_funding_rules`), Unit 8 (budgets mensal+anual, templates recorrentes, rollover por budget, hierarquia pai/filho simultâneos, flexível soft-cap, família agregado + meta pessoal opt-in, projection linear, notificações in-app + email opt-in), Unit 9 (motor híbrido auto/confirm com `execution_mode`, `amount_mode` variable força confirm, `schedule_type` expandido com day_of_month/weekday_ordinal, `reminders` substituído por `inbox_items` unificado, tipo `credit_card_payment`, cron único `daily-scheduler` Europe/Lisbon, rota `/app/inbox`, dedup fuzzy no importador para Unit 14, apagar `fixed_expenses` + crons antigos), Unit 10 (Dashboard scope-aware via Unit 1, Insights absorvido no Dashboard como `<DashboardInsights />`, Cashflow como timeline unificada −30d/+90d com slider e linha "agora", unificar RPCs em `get_kpis`/`get_category_breakdown`/`get_dashboard_insights`/`get_cashflow_timeline`, tab "Análise anual" em Reports, exportService único, apagar `pages/Insights.tsx` e `PersonalInsights.tsx`, sem materialized views por agora), Unit 11 (Payroll Core: tabelas IRS 2026 PT via nova `tax_tables`, uma transação de income líquido por payslip com source_type=payroll, salário como recurring_rule Unit 9 com auto/confirm, posting dispara run_funding_rules Unit 7, scope-aware com view `family_income`, um contrato ativo no Core, ambos modos de subsídio full/duodecimos, meal tax-free caps €6,15/€10,46, upload manual de PDF, consolidar rotas em `/app/payroll`; valores PT 2026 confirmados: salário mínimo €920 DL 139/2025, SS 11%/23,75%, IRS Despacho 233-A/2026 mínimo existência €12.880), Unit 12 (Payroll Advanced: OT com duas escalas Art. 268.º CT — até 100h/ano +25%/+37,5%/+50% e acima +50%/+75%/+100%; trabalho noturno +25%; leaves com tratamento fiscal correto; mileage €0,40/km; bonuses tipificados; retroativos tributados pela tabela IRS do ano de competência; múltiplos contratos com alerta bracket; PDF automático via react-pdf; ajudas de custo com caps 2026 nacional €65,89/€72,65 e estrangeiro €156,36/€175,42; limites anuais OT 175h MPE / 150h ≥50 trabalhadores; IRS em OT = 50% taxa base desde 1/1/2025; turnos rotativos e regras fiscais específicas de bónus parked-aceite), Unit 13 (Family Sharing: unificação real de UI com rotas `/personal/*` e `/family/*` a virar redirects para `/app/*`, Edge Function `send-family-invite` com Resend e rate limit, roles owner/admin/member/viewer com min-1-owner, soft-remove de members com reassign, tracking de contribuição individual via transactions.user_id e goal_ledger.user_id, splits intra-família com expense_splits e settle_member_balance, inbox recebe family_events Unit 9, audit log 180d só owner/admin, N famílias por user via dropdown de scope, RLS fortification via triggers BEFORE INSERT em todas as tabelas com family_id, fluxo de invite completo com onboarding Unit 4 a detetar pending; materializa Unit 1; splits para grupos não-família parked-aceite), Unit 14 (Importer: 6 templates PT — Millennium BCP, Santander Totta, CGD, Novo Banco, ActivoBank, Montepio + BPI; OCR parked-aceite com remoção do stub; dedup fuzzy Levenshtein contra `transactions` E contra `recurring_instances` Unit 9 que marca `posted` sem duplicar — fecha loop Unit 9; rules engine `import_categorization_rules` com seed ~30 regras PT; OFX via `ofx-js`, MT940/CAMT parked; auto-deteção de formato por extensão + content sniff; remover cap 1000 linhas, batches 100 com progress; consolidar em `/app/import` scope-aware; per-row error badges ok/warning/error; tests ≥80% com fixtures dos 6 bancos; retenção 180d com soft-delete).
- **2026-04-20** — Decisão registada: Unit 15 (Settings & Profile: rota unificada `/app/settings` scope-aware com 5 tabs, eliminar duplicação `SettingsForm.tsx`/`PersonalSettings.tsx`/`FamilySettings.tsx`, migrar JSONB `personal_settings` → tabela tipada `user_preferences` com colunas por evento×canal para Edge Functions queryarem SQL direto, timezone forçado Europe/Lisbon no MVP, password change real via `supabase.auth.updateUser`, MFA parked pós-SaaS, avatar upload bucket `avatars` com crop 2MB, onboarding geral + botão "Rever onboarding" Unit 4, GDPR account deletion com cooling-off 30d via `deletion_tokens` + Edge Function `process-account-deletion` no daily-scheduler, GDPR data export via Edge Function `export-user-data` com ZIP + rate limit 1/semana, matriz notificações 11 eventos × 2 canais email+inbox (push parked), rule management UI fecha Unit 14, dashboard widget custom parked, family tab só owner/admin com Info/Membros/Audit/Danger — fecha UI dispersa Unit 13, ThemeProvider real, pt-PT+en-US só, currency user-level = display fallback).
- **2026-04-20** — Decisão registada: Unit 16 (Plumbing Cross-Cutting: Sentry frontend+EFs blocker friends beta, `edgeLogger` unificado com correlation_id em todas EFs, `job_runs` table + DLQ com `run_cron_job` retry 3× + Sentry alert, `edge_rate_limits` partilhado para `send-family-invite`/`export-user-data`/`ingest_csv`/`process-account-deletion`, RLS tests template completos em ~25 tabelas como CI gate, E2E Playwright abandonando Cypress com 8 flows críticos em CI, coverage thresholds unit 70%/services 85%/validation 95%/money math 100%, `eslint-plugin-jsx-a11y` + `@axe-core/playwright` em 5 páginas chave, i18n hardcoded cleanup via ESLint regra + `useLocale` centralizado, CSP meta Vite plugin, type drift + schema snapshot em CI como PR gates, `.nvmrc` + engines + Husky lint-staged, Dependabot + `npm audit --audit-level=high` gate, `scripts/validate-env.ts` em predev/prebuild; parked-aceite Lighthouse CI gate, Grafana/Prometheus, MFA admins, OTel tracing, chaos/load testing). **Todas as 16 units decididas — brainstorming completo.**
