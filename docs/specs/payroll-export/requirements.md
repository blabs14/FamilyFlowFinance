Requirements — Payroll Export & DEV Preview (Fase 1)

Introdução
- Valor de negócio: validar visualmente e funcionalmente os fluxos de Payroll (Resumo, Calculadora, Histórico) em DEV, e preparar exportação de recibos (CSV/PDF) com segurança e auditoria antes de integrar em produção.
- Escopo: DEV wrappers (Summary/Calculator/History) e definição da exportação; integração em produção será gated por toggle após testes.
- Fora de escopo: cálculo fiscal completo real (preview usa regra simplificada), branding complexo de PDF.

Requisitos funcionais (EARS) — numerados (X.Y)
1.1 Resumo de Payroll
- WHEN o utilizador autenticado abre “/app/payroll” THE SYSTEM SHALL mostrar o título “Resumo do Payroll” e estado de carregamento.
- IF ocorrer erro ao carregar dados THEN THE SYSTEM SHALL mostrar “Erro ao carregar dados do payroll”.
- IF não existirem dados THEN THE SYSTEM SHALL mostrar “Nenhum dado de payroll encontrado”.
- IF existirem totais mensais THEN THE SYSTEM SHALL mostrar Bruto/Líquido/Impostos com valores formatados.
- IF existirem payslips THEN THE SYSTEM SHALL listar linhas por período (YYYY-MM ou mês/ano em PT-PT).

1.2 Calculadora de Payroll com bónus de pontualidade
- WHEN o utilizador preenche Salário Base e Horas Trabalhadas e submete THE SYSTEM SHALL calcular bruto, impostos (~20%) e líquido.
- IF “Bónus de pontualidade” estiver ativado THEN THE SYSTEM SHALL somar o bónus ao bruto e refletir no líquido.
- ON sucesso THE SYSTEM SHALL apresentar os valores e permitir navegar para Histórico.
- ON erro THE SYSTEM SHALL mostrar “Erro no cálculo do payroll”.

1.3 Histórico de Payroll com filtro e export
- WHEN o utilizador seleciona um Ano THE SYSTEM SHALL filtrar a lista de payslips por esse ano.
- WHILE o utilizador marca checkboxes THE SYSTEM SHALL manter o conjunto de IDs selecionados.
- ON “Exportar” THE SYSTEM SHALL iniciar exportação e, em sucesso, mostrar “Payslips exportados com sucesso”.
- ON erro THE SYSTEM SHALL apresentar mensagem clara e código (mapeado do backend).

2.1 Exportação CSV/PDF com sanitização
- WHEN o utilizador exporta em CSV THE SYSTEM SHALL incluir por defeito: id, período (YYYY-MM), bruto, líquido, impostos.
- IF o utilizador escolher PDF THEN THE SYSTEM SHALL gerar PDF simples com cabeçalho, totais e itens principais.
- IF o pedido exceder limites (por quantidade/tamanho) THEN THE SYSTEM SHALL bloquear com erro apropriado (413) e mensagem “Export demasiado grande; aplique filtros”.
- ON export THE SYSTEM SHALL registar auditoria (user_id, timestamp, count, formato, parâmetros).

2.2 RBAC e rate limiting de export
- WHEN a função de export é chamada THE SYSTEM SHALL verificar papéis autorizados (finance_manager/admin) e aplicar rate limiting (ex.: 10 exports/hora/utilizador).
- IF o utilizador não tiver permissão THEN THE SYSTEM SHALL devolver 403 FORBIDDEN.
- IF o limite por hora for atingido THEN THE SYSTEM SHALL devolver 429 RATE_LIMITED.

Edge cases
- Nenhum payslip no sistema → mensagens de vazio.
- IDs duplicados na export → validação e deduplicação antes de processar.
- Períodos inválidos ou formato inválido → 400 VALIDATION_ERROR.
- Falhas de fecho do PDF/CSV → 500 INTERNAL_ERROR com logging.

Requisitos de segurança
- Validação e sanitização de inputs (Zod) na função (ids, formato, período, includeFields).
- Remover dados sensíveis dos ficheiros por omissão (IBAN, NIF, morada).
- RBAC/ABAC para export; URLs assinados com expiração curta; CORS correcto.
- Auditoria de exportações em export_audit (RLS com auth.uid()).
- Segredos em variáveis de ambiente; nunca no repositório.

Requisitos de performance
- CSV até 500 recibos gerado em < 2s no ambiente DEV; PDF simples < 3s.
- UI responsiva com estados previsíveis; sem bloqueios longos.

Traceabilidade
- 1.1 → Resumo de Payroll
- 1.2 → Calculadora com bónus
- 1.3 → Histórico com filtro + export
- 2.1 → Export CSV/PDF + sanitização + auditoria
- 2.2 → RBAC + rate limiting