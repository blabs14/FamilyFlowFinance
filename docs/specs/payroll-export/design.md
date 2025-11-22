Design — Payroll Export & DEV Preview (Fase 2)

Stack alinhado (dev = prod)
- Frontend: Vite + React + react-router-dom
- Backend: Supabase (Auth, Postgres, Storage, Edge Functions)
- Testes: Vitest/Jest + Testing Library + Playwright
- Lint/format: ESLint + Prettier

Objetivos (Traceability)
- 1.1 Resumo de Payroll (visualização de totais e lista)
- 1.2 Calculadora com bónus de pontualidade (validação e feedback)
- 1.3 Histórico com filtro por ano e export
- 2.1 Exportação CSV/PDF com limites e sanitização
- 2.2 RBAC e rate limiting na export

Arquitetura e componentes
- UI DEV-only wrappers: Summary, Calculator, History para validação visual.
- Serviço de Export (Edge Function Supabase):
  - Função: export-payslips
  - Entrada: lista de IDs de payslips, formato (csv|pdf), parâmetros opcionais (período, campos)
  - Saída: URL assinado (Supabase Storage) para download do ficheiro gerado
  - Auditoria: gravação em tabela export_audit
- Storage bucket: exports (privado)
  - Nomes de ficheiro: payslips_<YYYY-MM|range>_<count>_<timestamp>.csv/pdf
- Rate limiting: cálculo via export_audit (última hora)
- RBAC/ABAC: verificação na função (claims do utilizador) + RLS na tabela de auditoria

Data Models & Migrations (SQL real)
1) Tabela de auditoria de exportações

-- Requer extensão pgcrypto para gen_random_uuid(); Supabase tem por defeito.
create table if not exists public.export_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  family_id uuid null,
  format text not null check (format in ('csv','pdf')),
  item_count integer not null check (item_count >= 1),
  period_from date null,
  period_to date null,
  params_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists export_audit_created_at_idx on public.export_audit (created_at desc);
create index if not exists export_audit_user_id_created_idx on public.export_audit (user_id, created_at desc);

alter table public.export_audit enable row level security;

-- Política: o próprio pode consultar os seus registos; admin pode consultar todos.
-- Nota: se existir tabela user_roles, usar; caso contrário, filtrar por user_id e permitir admin via função custom (a definir na Edge Function).
create policy if not exists export_audit_owner_select on public.export_audit
for select using (auth.uid() = user_id);

-- Admin (opcional; requer modelo de roles). Exemplo minimalista: permitir admins via claim custom (tratado pela Edge Function); não criar política extra por agora.

2) Bucket de Storage (manual via Supabase UI/API)
- Nome: exports
- Visibilidade: privada
- Regras: gerar URLs assinados com expiração curta para download

API Contracts — export-payslips (Edge Function)
Endpoint
- POST /functions/v1/export-payslips

Request (JSON)
{
  "ids": string[]; // máximo 500; únicos
  "format": "csv" | "pdf";
  "period"?: { "from": string; "to": string }; // YYYY-MM-DD
  "includeFields"?: string[]; // campos adicionais (ex.: contrato_id)
  "locale"?: "pt-PT"; // default pt-PT
  "timezone"?: "Europe/Lisbon" // default
}

Response — sucesso (200)
{
  "success": true,
  "url": "https://<storage-signed-url>",
  "count": number,
  "format": "csv" | "pdf",
  "expiresAt": string // ISO
}

Erro — exemplos
- 400 VALIDATION_ERROR: ids vazios/duplicados, tamanho > 500, formato inválido
- 403 FORBIDDEN: utilizador sem permissão (RBAC)
- 413 PAYLOAD_TOO_LARGE: seleção/ficheiro demasiado grande
- 429 RATE_LIMITED: limite de exports por hora atingido
- 500 INTERNAL_ERROR: erro inesperado

Error taxonomy (código → mensagem user-facing)
- VALIDATION_ERROR → "Dados de exportação inválidos"
- FORBIDDEN → "Sem permissão para exportar"
- PAYLOAD_TOO_LARGE → "Export demasiado grande; aplique filtros"
- RATE_LIMITED → "Demasiadas exportações; tente mais tarde"
- INTERNAL_ERROR → "Erro interno; tente novamente"

Estratégia de erros & logs
- Edge Function
  - Validação com Zod (tipos, limites, campos permitidos)
  - RBAC: verificar role/claim do utilizador
  - Rate limit: query export_audit na última hora por user_id; se >= limite (ex.: 10), retornar 429
  - Auditoria: inserir linha com user_id, count, formato, período
  - Logging: contexto (user_id, params, item_count), stack, correlação de request
- Frontend
  - Mensagens acessíveis (aria-live) e visíveis; estados de loading/erro/sucesso consistentes

Estados UX (loading/empty/error/retry)
- Resumo: "A carregar dados do payroll" | "Erro ao carregar dados do payroll" | "Nenhum dado de payroll encontrado"
- Calculadora: feedback imediato em erro; resultados apresentados com possibilidade de navegar para Histórico
- Histórico: loading ao preparar export; sucesso com mensagem; erro com códigos normalizados

Test Approach
- Unit
  - Zod schema da função export-payslips (EN)
  - Helpers de formatação CSV/PDF
- Integração
  - Frontend wrappers: submissão de cálculo, visualização de totals, filtro por ano, export com sucesso (EN)
  - Edge Function: chamada com inputs válidos/ inválidos; rate limiting; RBAC
- E2E (Playwright)
  - Fluxo completo: Calculadora → Resumo → Histórico → Export
  - Acessibilidade: labels, navegação por teclado, foco e mensagens

Performance
- Limites iniciais
  - CSV: até 500 recibos, geração < 2s
  - PDF: geração < 3s; lote pequeno; utilização de streaming se necessário
- Cache
  - Evitar recomputação; gerar diretamente a partir de dados persistidos de payslips

Segurança
- Inputs validados (Zod); sanitização
- Remover dados sensíveis dos ficheiros por omissão (IBAN, morada, NIF)
- RBAC/ABAC: apenas papéis autorizados podem exportar (finance_manager/admin)
- Rate limiting por utilizador; CORS correto; URLs assinados com expiração
- Dados e segredos em env vars; nunca em repositório

Mapeamento Requisitos → Design
- 1.1 → UI Summary + estados + formatação período
- 1.2 → Calculadora com validações, feedback e bónus pontualidade
- 1.3 → Histórico: filtro por ano, seleção múltipla, Export
- 2.1 → Edge Function + CSV/PDF + Storage + auditoria + sanitização
- 2.2 → RBAC na função + Rate limiting baseado em export_audit

Notas de implementação
- Fonte de dados de payslips: reutilizar serviços existentes; se inexistente, definir contrato getPayslipsByIds(ids) no serviço de payroll.
- Toggle DEV/PROD: wrappers ativos apenas em DEV; produção usa páginas reais.
- Nomes de ficheiro e schema CSV: configuráveis via includeFields; defaults pt-PT.

Pendentes para confirmação
- Campos extra em CSV/PDF (contrato_id, nome colaborador, departamento)
- Limite por export (proposta: 500) e por período (proposta: 12 meses)
- Papéis com permissão de export (finance_manager, admin)
- Rate limit (proposta: 10/hora/utilizador) e diferenças entre CSV/PDF
- Branding e metadados do PDF (logo, notas legais)