# Cobertura de Testes

## Runners

- `npm run test` / `npm run test:run`: suite principal Vitest com jsdom para unit tests e component tests leves.
- `npm run test:integration`: suite Vitest separada para testes com dependências de integração.
- `npm run cy:run`: Cypress para fluxos E2E legados.
- `npm run test:e2e:pw`: Playwright para fluxos E2E modernos.

## Localização dos Testes

- `src/**/__tests__/` e `src/**/*.{test,spec}.*`: testes unitários puros e testes co-localizados ao código.
- `tests/integration/`: testes de integração e suites dependentes de serviços externos/DB.
- `tests/utils/`: helpers partilhados de teste.

## Cobertura Actual

Medição de referência da Phase 2 (`npm run test:coverage`):

- `Branches`: `56.68%`
- `Functions`: `32.66%`
- `Lines`: `15.56%`
- `Statements`: `15.56%`

O directório `src/validation/` está neste momento em:

- `Branches`: `100%`
- `Functions`: `89.18%`
- `Lines`: `100%`
- `Statements`: `100%`

## Ratchet Actual

Os thresholds em `tests/config/vitest.config.ts` foram alinhados com a cobertura medida e arredondados para baixo ao múltiplo de `5` mais próximo:

- `global.branches`: `55`
- `global.functions`: `30`
- `global.lines`: `15`
- `global.statements`: `15`
- `src/validation/**`: `branches 80`, `functions 90`, `lines 90`, `statements 90`

## Relatórios

- Terminal: resumo textual no fim de `npm run test:coverage`
- JSON: `coverage/coverage-final.json`
- HTML: `coverage/index.html`

## Phase 2 Highlights

- `Auth`: `LoginForm` e `RegisterForm` agora cobertos com submit válido, validações, estados de erro e pending.
- `Serviços`: `src/services/goals.ts` cobre happy/error paths em toda a superfície exportada.
- `Componentes críticos`: `FamilyInviteForm`, `CreditCardForm`, `ReminderForm` e `Dashboard` já têm cobertura de regressão/smoke.

## Phase 4 Highlights

- `Cypress support`: `cypress/support/e2e.ts` e `cypress/support/commands.ts` activam `cy.login()` e isolamento básico por teste.
- `E2E auth`: `auth.cy.ts` cobre redirect de protegidas, login válido, erro de credenciais e logout.
- `E2E personal area`: `accounts.cy.ts`, `transactions.cy.ts`, `goals.cy.ts` e `navigation.cy.ts` cobrem fluxos críticos de UI.
- `E2E legacy smoke`: `recurrents_smoke.cy.ts` foi migrado para `cy.login()` e selectors estáveis.
- `Baseline Cypress`: `6 specs`, `15 testes`, `15 passing` em `npm run cy:run`.

## Próximas Fases

- `Playwright / browser parity`: adicionar smoke coverage equivalente para o runner Playwright.
- `Journeys completos`: expandir fluxos E2E multi-passo família/meta/cartão com assertions de persistência cross-page.
