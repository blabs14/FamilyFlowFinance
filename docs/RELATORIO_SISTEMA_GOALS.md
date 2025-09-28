# Relatório Detalhado - Sistema de Goals (Objetivos)

## Visão Geral

O sistema de goals (objetivos) do Family Finance é um módulo completo que permite aos utilizadores criar, gerir e acompanhar objetivos financeiros pessoais e familiares. O sistema inclui funcionalidades de alocação de fundos, tracking de progresso, e regras específicas para diferentes cenários.

## Estrutura de Dados

### Tabela `goals`
```sql
- id (uuid, PK)
- user_id (uuid, FK para profiles)
- nome (text, máx 100 caracteres)
- valor_atual (numeric, calculado via view)
- valor_objetivo (numeric, obrigatório, máx 999.999,99)
- valor_meta (numeric, opcional)
- prazo (date, opcional)
- created_at (timestamptz)
- updated_at (timestamptz)
- family_id (uuid, FK para families, opcional)
- ativa (boolean, default true)
- status (text, default 'ativo')
- account_id (uuid, FK para accounts, opcional)
```

### Tabela `goal_allocations`
```sql
- id (uuid, PK)
- goal_id (uuid, FK para goals)
- account_id (uuid, FK para accounts)
- valor (numeric, obrigatório > 0)
- data_alocacao (timestamptz, default now())
- descricao (text, opcional)
- created_at (timestamptz)
- updated_at (timestamptz)
- user_id (uuid, FK para profiles)
```

### View `goal_progress`
Calcula automaticamente o progresso dos objetivos:
```sql
SELECT 
    g.id,
    g.nome,
    g.valor_objetivo,
    COALESCE(SUM(ga.valor), 0) AS total_alocado,
    ROUND(((COALESCE(SUM(ga.valor), 0) / NULLIF(g.valor_objetivo, 0)) * 100), 2) AS progresso_percentual
FROM goals g
LEFT JOIN goal_allocations ga ON (ga.goal_id = g.id)
GROUP BY g.id, g.nome, g.valor_objetivo;
```

## Validações e Regras de Negócio

### Validação de Dados (Zod Schema)
```typescript
export const goalValidationSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome deve ter no máximo 100 caracteres'),
  valor_objetivo: z.number().positive('Valor objetivo deve ser positivo').max(999999.99, 'Valor máximo é 999.999,99'),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Prazo deve estar no formato YYYY-MM-DD').optional(),
  account_id: z.string().uuid('ID da conta deve ser um UUID válido').optional(),
});
```

### Regras de Criação
1. **Nome obrigatório** (1-100 caracteres)
2. **Valor objetivo obrigatório** (> 0, máx 999.999,99€)
3. **Prazo opcional** (formato YYYY-MM-DD)
4. **Valor atual** sempre inicia em 0
5. **Status** default 'ativo'
6. **Ativa** default true

### Regras de Acesso
- **Objetivos pessoais**: apenas o proprietário (user_id)
- **Objetivos familiares**: membros da família com permissões adequadas
- **RLS (Row Level Security)** aplicado em todas as tabelas

## Funcionalidades Principais

### 1. Criação de Objetivos
**Função**: `createGoal()`
- Validação via Zod schema
- Criação automática da conta "Objetivos" se necessário
- Suporte para objetivos pessoais e familiares

### 2. Alocação de Fundos
**Função RPC**: `allocate_to_goal_with_transaction()`

**Parâmetros**:
- `goal_id_param` (uuid)
- `account_id_param` (uuid) - conta de origem
- `amount_param` (numeric) - valor a alocar
- `user_id_param` (uuid)
- `description_param` (text, opcional)

**Processo**:
1. Validação de parâmetros (valor > 0)
2. Verificação de saldo suficiente na conta origem
3. Garantia da existência da conta "Objetivos"
4. Criação/busca da categoria "Objetivos"
5. **Transação atómica**:
   - Dedução do valor da conta origem
   - Adição do valor à conta "Objetivos"
   - Criação do registo em `goal_allocations`
   - Criação de 2 transações (saída da origem, entrada nos objetivos)

**Regras**:
- Valor deve ser positivo
- Conta origem deve ter saldo suficiente
- Cria automaticamente conta "Objetivos" se não existir
- Todas as operações são atómicas (rollback em caso de erro)

### 3. Desalocação de Fundos
**Função RPC**: `deallocate_from_goal_with_transaction()`

**Processo**:
1. Validação de parâmetros
2. Processamento das alocações (mais recentes primeiro)
3. **Regra crítica**: O valor desalocado **desaparece completamente do sistema**
4. Apenas dedução da conta "Objetivos"
5. **NÃO há devolução** à conta de origem

**Diferença importante**:
- **Desalocação**: valor desaparece do sistema
- **Eliminação de objetivo**: valor pode ser devolvido (dependendo do progresso)

### 4. Eliminação de Objetivos
**Função RPC**: `delete_goal_with_restoration()`

**Regras de Restauração**:
- **Progresso < 100%**: Valor total alocado volta para a conta de origem
- **Progresso = 100%**: Valor permanece no sistema (objetivo concluído)

**Processo**:
1. Cálculo do progresso do objetivo
2. Identificação da conta de origem (primeira alocação)
3. Criação de transações de ajuste:
   - Receita na conta origem (restauração)
   - Despesa na conta objetivos (dedução)
4. Eliminação do objetivo e alocações

### 5. Tracking de Progresso
**Função RPC**: `get_user_goal_progress()`
- Retorna progresso calculado via view `goal_progress`
- Percentual baseado em: (total_alocado / valor_objetivo) * 100
- Suporte para filtro por utilizador

## Sistema de Funding Automático

### Tabelas Adicionais
- `goal_funding_rules`: Regras de financiamento automático
- `goal_contributions`: Contribuições automáticas registadas

### Tipos de Regras
1. **Fixed Monthly**: Contribuição fixa mensal
2. **Percentage**: Percentagem de transações
3. **Roundup**: Arredondamento de despesas

### Trigger Automático
**Função**: `handle_goal_funding_on_transaction()`
- Executado após inserção de transações
- Aplica regras de funding automático
- Exclui transferências para evitar loops

## Interface de Utilizador

### Componentes Principais
1. **GoalForm**: Criação/edição de objetivos
2. **PersonalGoals**: Gestão de objetivos pessoais
3. **FamilyGoals**: Gestão de objetivos familiares
4. **GoalAllocationModal**: Interface de alocação
5. **GoalDeallocationModal**: Interface de desalocação
6. **GoalFundingSection**: Configuração de funding automático

### Hooks Disponíveis
- `useGoals`: Operações CRUD básicas
- `useGoalsQuery`: Integração com React Query
- `useGoalAllocations`: Gestão de alocações
- `useGoalFunding`: Gestão de funding automático

## Contas Especiais

### Conta "Objetivos"
**Função**: `ensure_goals_account()`
- Criada automaticamente quando necessário
- Nome: "Objetivos Pessoais" ou "Objetivos Familiares"
- Tipo: "objetivos"
- `saldo_direto`: sempre 0 (usa apenas view `account_balances_v1`)

### Categoria "Objetivos"
- Criada automaticamente durante alocações
- Cor padrão: #3B82F6 (azul)
- Usada para todas as transações relacionadas com objetivos

## Estados e Status

### Status do Objetivo
- **'ativo'**: Objetivo em progresso
- **'concluido'**: Objetivo atingido (100%)
- **'pausado'**: Objetivo temporariamente inativo

### Campo `ativa`
- `true`: Objetivo visível e funcional
- `false`: Objetivo arquivado/inativo

## Segurança e Permissões

### Row Level Security (RLS)
- Aplicado em todas as tabelas relacionadas
- Isolamento por utilizador e família
- Políticas específicas para leitura e escrita

### Validação de Acesso
- Verificação de propriedade do objetivo
- Validação de membership familiar
- Controlo de permissões por role (owner/admin/member)

## Auditoria e Logs

### Tracking de Alterações
- Todos os CRUDs são auditados
- Histórico de alocações/desalocações
- Logs de transações relacionadas

### Integridade de Dados
- Constraints de FK garantem consistência
- Triggers mantêm dados sincronizados
- Validações em múltiplas camadas (frontend, backend, DB)

## Casos de Uso Típicos

### 1. Criar Objetivo Pessoal
```typescript
const objetivo = {
  nome: "Férias no Algarve",
  valor_objetivo: 2000.00,
  prazo: "2025-08-01"
};
```

### 2. Alocar Fundos
```typescript
await allocateToGoal(goalId, accountId, 100.00, userId, "Poupança mensal");
```

### 3. Acompanhar Progresso
```typescript
const progresso = await getUserGoalProgress(userId);
// Retorna: { goal_id, nome, valor_objetivo, total_alocado, progresso_percentual }
```

### 4. Configurar Funding Automático
```typescript
const regra = {
  goal_id: goalId,
  type: "fixed_monthly",
  fixed_cents: 5000, // 50€
  day_of_month: 1
};
```

## Considerações Técnicas

### Performance
- Views materializadas para cálculos complexos
- Índices otimizados para queries frequentes
- Paginação em listas grandes

### Escalabilidade
- Arquitetura modular
- Separação clara de responsabilidades
- Suporte para múltiplas famílias

### Manutenibilidade
- Código bem documentado
- Testes unitários e de integração
- Padrões consistentes de validação

## Limitações Conhecidas

1. **Valor máximo**: 999.999,99€ por objetivo
2. **Desalocação irreversível**: Valor desalocado não pode ser recuperado
3. **Dependência da conta "Objetivos"**: Sistema requer conta especial
4. **Funding automático**: Limitado aos tipos implementados

## Próximos Desenvolvimentos

1. **Objetivos partilhados**: Entre múltiplas famílias
2. **Metas intermédias**: Marcos dentro de um objetivo
3. **Notificações**: Alertas de progresso e prazos
4. **Relatórios avançados**: Analytics de performance
5. **Integração bancária**: Funding automático via Open Banking

---

**Última atualização**: 2 de Fevereiro de 2025
**Versão do sistema**: 1.2.0