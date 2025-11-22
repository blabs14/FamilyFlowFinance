Tasks — Payroll Export & DEV Preview (Fase 3)

Resumo de esforço e riscos
- Estimativa total: ~3–5 dias úteis.
- Dependências: Supabase Edge Functions, Storage privado, migração export_audit, wrappers DEV existentes.
- Riscos: PDF geração (biblioteca/latência), limites de export, consistência de RBAC/RLS.

Checklist por fases (cada tarefa referencia requisitos X.Y)

Fase A — Back-end (Edge Function + Storage)
1) Criar migração SQL para export_audit com RLS
- Refs: 2.1, 2.2
- Descrição: criar tabela public.export_audit (user_id, timestamp, count, formato, filtros), índices e política RLS via auth.uid().
- Dependências: acesso ao schema, Supabase ativo.
- Estimativa: 2h
- Qualidade: reversível, índices verificados, RLS testado.

2) Implementar função Supabase “export-payslips” (CSV/PDF)
- Refs: 2.1, 2.2
- Descrição: validar inputs (Zod); RBAC (finance_manager/admin); rate limit (10/hora/utilizador); gerar CSV (campos: id, período, bruto, líquido, impostos), PDF simples; upload para bucket privado “exports”; devolver signedUrl; auditar em export_audit.
- Dependências: Tarefa 1, bucket “exports”.
- Estimativa: 1.5–2 dias
- Qualidade: logs estruturados, erros normalizados (400/403/413/429/500), tempo <2–3s conforme formato.

3) Criar bucket privado “exports” e política
- Refs: 2.1
- Descrição: configurar bucket Storage (privado), regras de acesso via signed URLs e expiração curta.
- Dependências: Supabase projeto.
- Estimativa: 1h
- Qualidade: verificação de privacidade, expiração testada.

Fase B — Front-end (DEV wrappers + integração)
4) API client para chamar “/functions/v1/export-payslips”
- Refs: 1.3, 2.1, 2.2
- Descrição: criar client com fetch + headers (auth), mapping de erros e tipos; função exportPayslips(ids, formato, filtros).
- Dependências: backend disponível ou mock DEV.
- Estimativa: 4h
- Qualidade: estados de loading/sucesso/erro, mensagens em PT-PT, códigos de erro mapeados.

5) Integrar export no PayrollHistoryPage (DEV)
- Refs: 1.3
- Descrição: substituir stub por chamada real ao client; atualizar UI (checkboxes, filtro ano, botão Exportar com spinner e toasts).
- Dependências: Tarefa 4.
- Estimativa: 4h
- Qualidade: WCAG 2.1 AA, responsivo, navegação previsível.

6) Atualizar wrappers Summary/Calculator com estados UX
- Refs: 1.1, 1.2
- Descrição: garantir loading/empty/error/retry consistentes; form validation de inputs (Zod/React Hook Form);
- Dependências: existentes.
- Estimativa: 3h
- Qualidade: labels PT-PT, aria labels, guardas de navegação.

Fase C — Testes e CI
7) Unit tests (Edge Function e client)
- Refs: 2.1, 2.2
- Descrição: testes de validação (Zod), RBAC, rate limit, erros, CSV/PDF geração (mocks), auditoria escrita.
- Dependências: Tarefa 2 e 4.
- Estimativa: 6h
- Qualidade: cobertura mínima 70% nas novas unidades.

8) Integração e E2E (DEV)
- Refs: 1.3, 2.1
- Descrição: testes de fluxo no PayrollHistoryPage (seleção → export → toast → link download); Playwright para cenários críticos.
- Dependências: Tarefa 5.
- Estimativa: 1 dia
- Qualidade: cross-browser, responsivo, sem erros de console/rede.

9) CI/CD: pipelines com lint, tests e reports
- Refs: 2.2
- Descrição: garantir linters, unit e integration a correrem em PR; reports básicos e dependabot ativo.
- Dependências: setup CI existente.
- Estimativa: 3h
- Qualidade: gates em PR, build limpo.

Fase D — Perf e Segurança
10) Orçamentação de performance e logs
- Refs: 2.1
- Descrição: medir tempos de geração para CSV/PDF, logar métricas (count, duração, tamanho) e alertas simples.
- Dependências: Tarefa 2.
- Estimativa: 3h
- Qualidade: tempos dentro dos budgets (<2–3s), sem timeouts.

11) Revisão de sanitização e campos
- Refs: 2.1
- Descrição: confirmar campos por omissão (id, período, bruto, líquido, impostos) e remover sensíveis; permitir includeFields controlado.
- Dependências: Tarefa 2.
- Estimativa: 2h
- Qualidade: checklist de segurança validada.

Matriz de qualidade (por tarefa)
- WCAG 2.1 AA e responsivo
- Mensagens PT-PT claras e consistentes
- Segurança: validação inputs, RBAC/ABAC, RLS, rate limiting
- Performance: budgets cumpridos, sem regressões
- Testes: unit/integration/E2E conforme
- Revisão de código e documentação

Dependências e ordem sugerida
- A1 → A2 → A3 → B4 → B5 → B6 → C7 → C8 → C9 → D10 → D11

Notas de implementação
- Reutilizar hooks e componentes existentes (React Hook Form/Zod/Toasts).
- Evitar duplicação: centralizar export client/service.
- Configurar envs sem sobrescrever .env (confirmar chaves Supabase).

Entrega e aprovação
- Gate 1: requirements.md (aprovado)
- Gate 2: design.md (aprovado)
- Gate 3: tasks.md (este documento)
- Após aprovação, iniciar implementação faseada conforme ordem acima.