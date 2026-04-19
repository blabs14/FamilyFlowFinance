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
  - **Fase 1 — Kill dead code:** apagar tabelas `fixed_expenses`, `goal_contributions`, `goal_deallocations`, `goal_funding_rules`; apagar colunas `accounts.is_goals`, possivelmente `goals.account_id` (após ledger). Reminders decide-se na Unit 9.
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

*(nenhuma decisão ainda)*

---

## 7. Histórico do documento

- **2026-04-18** — Criação. Processo, mapa e formato acordados. Decision log vazio.
- **2026-04-18** — Revisão pós-reviewer: adicionados estados `parked-aceite` e `superseded`; protocolos de revisão de decisões anteriores, retoma de `parked`, e retoma de sessão; campos `Depende de / Afeta`, `Evidência a preservar` e `Supersedes / Superseded by` no decision log.
- **2026-04-19** — Decisões registadas: Unit 1 (scope como estado), Unit 2 (refactor incremental do modelo de dados), Unit 3 (flat sidebar + scope toggle), Unit 4 (cleanup auth + onboarding híbrido + OAuth em breve).
