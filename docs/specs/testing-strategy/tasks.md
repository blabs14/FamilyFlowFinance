# Estratégia de Testes - Plano de Implementação

## Resumo Executivo

**Esforço Total**: 6-8 dias
**Dependências**: Acesso ao código fonte, ambiente de desenvolvimento
**Riscos**: Testes existentes podem ter dependências não documentadas

## Fase 1: Infraestrutura Base (1-2 dias)

### 1.1 Criar Nova Estrutura de Diretórios
- **Descrição**: Reorganizar estrutura de testes para clareza
- **Requisitos**: R1, R4
- **Dependências**: Nenhuma
- **Estimativa**: 2h
- **Tarefas**:
  - [ ] Criar diretórios: `tests/{unit,integration,e2e,utils}`
  - [ ] Mover testes existentes para estrutura correta
  - [ ] Atualizar imports e referências

### 1.2 Otimizar Configuração Vitest
- **Descrição**: Configurar Vitest para performance e paralelização
- **Requisitos**: R5, R10, R11
- **Dependências**: 1.1
- **Estimativa**: 3h
- **Tarefas**:
  - [ ] Atualizar `vitest.config.ts` com threads e cache
  - [ ] Configurar thresholds de cobertura realistas
  - [ ] Otimizar setup global para performance
  - [ ] Testar configuração com suite existente

### 1.3 Implementar Test Utilities Base
- **Descrição**: Criar helpers reutilizáveis fundamentais
- **Requisitos**: R4, R6
- **Dependências**: 1.2
- **Estimativa**: 4h
- **Tarefas**:
  - [ ] Criar `renderWithProviders` helper
  - [ ] Implementar assertion helpers básicos
  - [ ] Criar mock utilities reutilizáveis
  - [ ] Documentar padrões de uso

### 1.4 Criar Data Factories Principais
- **Descrição**: Implementar factories para dados de teste
- **Requisitos**: R4, R6
- **Dependências**: 1.3
- **Estimativa**: 3h
- **Tarefas**:
  - [ ] Factory para dados de payroll
  - [ ] Factory para timesheet entries
  - [ ] Factory para contratos e utilizadores
  - [ ] Builder pattern para casos complexos

## Fase 2: Testes Críticos (2-3 dias)

### 2.1 Reescrever PayrollSummaryPage.test.tsx
- **Descrição**: Simplificar e corrigir teste mais problemático
- **Requisitos**: R2, R6, R8
- **Dependências**: 1.4
- **Estimativa**: 6h
- **Tarefas**:
  - [ ] Analisar funcionalidade atual do componente
  - [ ] Criar mocks simplificados e focados
  - [ ] Implementar testes unitários por responsabilidade
  - [ ] Adicionar testes de integração essenciais
  - [ ] Validar todos os cenários críticos

### 2.2 Testes de Serviços Principais
- **Descrição**: Criar testes unitários para serviços críticos
- **Requisitos**: R2, R7, R9
- **Dependências**: 2.1
- **Estimativa**: 8h
- **Tarefas**:
  - [ ] `payrollService.test.ts` - cálculos e validações
  - [ ] `calculationService.test.ts` - lógica de negócio
  - [ ] `authService.test.ts` - autenticação e autorização
  - [ ] `supabaseService.test.ts` - integração base de dados

### 2.3 Componentes UI Críticos
- **Descrição**: Testar componentes de interface essenciais
- **Requisitos**: R2, R6
- **Dependências**: 2.2
- **Estimativa**: 6h
- **Tarefas**:
  - [ ] Formulários principais (AccountForm, TransactionForm)
  - [ ] Componentes de navegação e layout
  - [ ] Componentes de feedback (Toast, Modal)
  - [ ] Componentes de dados (Tables, Charts)

### 2.4 Hooks Personalizados
- **Descrição**: Testar hooks React personalizados
- **Requisitos**: R2, R6
- **Dependências**: 2.3
- **Estimativa**: 4h
- **Tarefas**:
  - [ ] `useAuth.test.ts` - gestão de autenticação
  - [ ] `usePayroll.test.ts` - lógica de payroll
  - [ ] `useTransactions.test.ts` - gestão de transações
  - [ ] `useContracts.test.ts` - gestão de contratos

## Fase 3: Cobertura e Otimização (3-5 dias)

### 3.1 Migrar Testes Existentes
- **Descrição**: Adaptar testes existentes ao novo padrão
- **Requisitos**: R6, R7
- **Dependências**: 2.4
- **Estimativa**: 8h
- **Tarefas**:
  - [ ] Identificar testes salvaguardáveis
  - [ ] Refatorar para novos padrões
  - [ ] Eliminar duplicações
  - [ ] Atualizar imports e dependências

### 3.2 Testes de Integração
- **Descrição**: Implementar testes de integração entre módulos
- **Requisitos**: R3, R7
- **Dependências**: 3.1
- **Estimativa**: 10h
- **Tarefas**:
  - [ ] Fluxo completo de payroll
  - [ ] Integração timesheet → payroll
  - [ ] Fluxo de autenticação
  - [ ] Gestão de contratos e utilizadores

### 3.3 Testes E2E Essenciais
- **Descrição**: Criar testes end-to-end para fluxos críticos
- **Requisitos**: R3, R7
- **Dependências**: 3.2
- **Estimativa**: 6h
- **Tarefas**:
  - [ ] Login e autenticação
  - [ ] Criação e cálculo de payroll
  - [ ] Gestão de timesheet
  - [ ] Relatórios principais

### 3.4 Otimização de Performance
- **Descrição**: Otimizar velocidade e recursos dos testes
- **Requisitos**: R5, R10, R11
- **Dependências**: 3.3
- **Estimativa**: 4h
- **Tarefas**:
  - [ ] Analisar bottlenecks de performance
  - [ ] Otimizar mocks e setup
  - [ ] Configurar paralelização eficaz
  - [ ] Implementar cache de dependências

### 3.5 Validação e Documentação
- **Descrição**: Validar cobertura e documentar padrões
- **Requisitos**: R6, R7
- **Dependências**: 3.4
- **Estimativa**: 3h
- **Tarefas**:
  - [ ] Executar análise de cobertura completa
  - [ ] Validar métricas de qualidade
  - [ ] Documentar padrões e guidelines
  - [ ] Criar guia de contribuição para testes

## Checklist de Qualidade

### Acessibilidade (WCAG 2.1 AA)
- [ ] Testes incluem verificação de ARIA labels
- [ ] Validação de navegação por teclado
- [ ] Teste de leitores de ecrã (básico)
- [ ] Contraste e visibilidade

### Mobile e Cross-browser
- [ ] Testes responsivos básicos
- [ ] Validação em diferentes viewports
- [ ] Compatibilidade com browsers principais

### Performance
- [ ] Suite completa < 30s
- [ ] Testes unitários < 10s
- [ ] Sem vazamentos de memória
- [ ] Cache eficaz de dependências

### Segurança
- [ ] Nenhuma credencial real em testes
- [ ] Validação de sanitização de inputs
- [ ] Testes de autorização
- [ ] Prevenção de XSS/injection

### Code Review
- [ ] Revisão de padrões implementados
- [ ] Validação de cobertura por módulo
- [ ] Verificação de manutenibilidade
- [ ] Documentação adequada

## Métricas de Sucesso

| Métrica | Objetivo | Atual | Status |
|---------|----------|-------|--------|
| Tempo de Execução | < 30s | ? | 🔄 |
| Cobertura Global | > 80% | ? | 🔄 |
| Cobertura Serviços | > 90% | ? | 🔄 |
| Testes Flaky | < 1% | ? | 🔄 |
| Tempo de Debug | < 5min | ? | 🔄 |

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|----------|
| Dependências circulares não identificadas | Média | Alto | Análise incremental, testes isolados |
| Performance degradada | Baixa | Médio | Benchmarking contínuo |
| Resistência à mudança | Baixa | Baixo | Documentação clara, benefícios evidentes |
| Cobertura insuficiente | Média | Médio | Análise por módulo, priorização |

## Próximos Passos

1. **Aprovação**: Revisar e aprovar este plano
2. **Setup**: Preparar ambiente e ferramentas
3. **Execução**: Implementar fase por fase
4. **Validação**: Testar e ajustar conforme necessário
5. **Documentação**: Finalizar guias e padrões