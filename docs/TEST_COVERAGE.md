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

Medição de referência da Phase 1 (`npm run test:coverage`):

- `Branches`: `54.1%`
- `Functions`: `29.97%`
- `Lines`: `13.07%`
- `Statements`: `13.07%`

O directório `src/validation/` está neste momento em:

- `Branches`: `100%`
- `Functions`: `89.18%`
- `Lines`: `100%`
- `Statements`: `100%`

## Ratchet Actual

Os thresholds em `tests/config/vitest.config.ts` foram alinhados com a cobertura medida e arredondados para baixo ao múltiplo de `5` mais próximo:

- `global.branches`: `50`
- `global.functions`: `25`
- `global.lines`: `10`
- `global.statements`: `10`
- `src/validation/**`: `branches 80`, `functions 90`, `lines 90`, `statements 90`

## Relatórios

- Terminal: resumo textual no fim de `npm run test:coverage`
- JSON: `coverage/coverage-final.json`
- HTML: `coverage/index.html`

## Próximas Fases

- `Phase 2`: component tests críticos com `renderWithProviders`
- `Phase 3`: reactivar as 7 suites com DB real em `tests/integration/`
- `Phase 4`: reforçar fluxos E2E em Cypress/Playwright
