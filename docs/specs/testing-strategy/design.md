# Estratégia de Testes - Design Técnico

## 1. Arquitetura de Testes

### 1.1 Estrutura de Diretórios
```
tests/
├── config/
│   ├── vitest.config.ts          # Configuração principal
│   ├── setup.ts                  # Setup global
│   └── test-utils.tsx            # Utilities React
├── unit/
│   ├── components/               # Testes de componentes
│   ├── hooks/                    # Testes de hooks
│   ├── services/                 # Testes de serviços
│   └── utils/                    # Testes de utilities
├── integration/
│   ├── features/                 # Testes de features completas
│   └── api/                      # Testes de API
├── e2e/
│   └── critical-flows/           # Fluxos críticos apenas
└── utils/
    ├── factories/                # Data factories
    ├── mocks/                    # Mocks reutilizáveis
    └── helpers/                  # Test helpers
```

### 1.2 Camadas de Teste

#### Testes Unitários (70%)
- **Objetivo**: Testar unidades isoladas
- **Escopo**: Componentes, hooks, utils, serviços
- **Mocks**: Mínimos, apenas dependências externas
- **Tempo**: < 10ms por teste

#### Testes de Integração (25%)
- **Objetivo**: Testar interações entre módulos
- **Escopo**: Features completas, fluxos de dados
- **Mocks**: Apenas APIs externas
- **Tempo**: < 100ms por teste

#### Testes E2E (5%)
- **Objetivo**: Testar fluxos críticos completos
- **Escopo**: Login, transações, relatórios
- **Mocks**: Nenhum (ambiente controlado)
- **Tempo**: < 5s por teste

## 2. Configuração Técnica

### 2.1 Vitest Configuration
```typescript
// tests/config/vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./setup.ts'],
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### 2.2 Setup Global
```typescript
// tests/config/setup.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mocks globais mínimos
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));
```

## 3. Padrões de Teste

### 3.1 Estrutura de Teste Unitário
```typescript
// Padrão AAA (Arrange, Act, Assert)
describe('ComponentName', () => {
  // Setup comum
  const defaultProps = {
    // props mínimas necessárias
  };

  it('should render with default props', () => {
    // Arrange
    const props = { ...defaultProps };
    
    // Act
    render(<ComponentName {...props} />);
    
    // Assert
    expect(screen.getByRole('...')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    // Arrange
    const onAction = vi.fn();
    const props = { ...defaultProps, onAction };
    
    // Act
    render(<ComponentName {...props} />);
    await user.click(screen.getByRole('button'));
    
    // Assert
    expect(onAction).toHaveBeenCalledWith(expectedArgs);
  });
});
```

### 3.2 Mocking Strategy

#### Serviços
```typescript
// tests/utils/mocks/payrollService.ts
export const mockPayrollService = {
  calculatePayroll: vi.fn(),
  getTimeEntries: vi.fn(),
  getActiveOTPolicy: vi.fn()
};

// No teste
vi.mock('@/services/payrollService', () => ({
  payrollService: mockPayrollService
}));
```

#### React Query
```typescript
// tests/utils/helpers/queryWrapper.tsx
export const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

## 4. Data Factories

### 4.1 Factory Pattern
```typescript
// tests/utils/factories/payrollFactory.ts
export const createPayrollData = (overrides = {}) => ({
  id: 'payroll-1',
  userId: 'user-1',
  contractId: 'contract-1',
  year: 2024,
  month: 1,
  baseSalary: 150000, // em cêntimos
  overtimePay: 22500,
  totalPay: 172500,
  ...overrides
});

export const createTimesheetEntry = (overrides = {}) => ({
  date: '2024-01-15',
  startTime: '09:00',
  endTime: '17:00',
  breakMinutes: 60,
  isHoliday: false,
  isVacation: false,
  isLeave: false,
  ...overrides
});
```

### 4.2 Builder Pattern para Casos Complexos
```typescript
// tests/utils/factories/contractBuilder.ts
export class ContractBuilder {
  private contract: Partial<Contract> = {};

  withBaseSalary(amount: number) {
    this.contract.baseSalary = amount;
    return this;
  }

  withOvertimePolicy(policy: OvertimePolicy) {
    this.contract.overtimePolicy = policy;
    return this;
  }

  build(): Contract {
    return {
      id: 'contract-1',
      userId: 'user-1',
      baseSalary: 150000,
      startDate: '2024-01-01',
      ...this.contract
    } as Contract;
  }
}
```

## 5. Helpers Reutilizáveis

### 5.1 Render Helpers
```typescript
// tests/utils/helpers/renderHelpers.tsx
export const renderWithProviders = (
  ui: React.ReactElement,
  options: RenderOptions = {}
) => {
  const AllProviders = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider value={mockAuthContext}>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: AllProviders, ...options });
};

export const renderWithAuth = (
  ui: React.ReactElement,
  authState: Partial<AuthState> = {}
) => {
  const mockAuth = { ...defaultAuthState, ...authState };
  return renderWithProviders(ui, { authContext: mockAuth });
};
```

### 5.2 Assertion Helpers
```typescript
// tests/utils/helpers/assertions.ts
export const expectToastMessage = (message: string, variant = 'default') => {
  expect(mockToast).toHaveBeenCalledWith(
    expect.objectContaining({
      title: expect.stringContaining(message),
      variant
    })
  );
};

export const expectLoadingState = () => {
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.getByText(/carregando/i)).toBeInTheDocument();
};

export const expectErrorState = (message?: string) => {
  expect(screen.getByRole('alert')).toBeInTheDocument();
  if (message) {
    expect(screen.getByText(message)).toBeInTheDocument();
  }
};
```

## 6. Estratégia de Migração

### 6.1 Fases de Implementação

#### Fase 1: Infraestrutura (1-2 dias)
1. Criar nova estrutura de diretórios
2. Configurar Vitest otimizado
3. Implementar helpers básicos
4. Criar factories principais

#### Fase 2: Testes Críticos (2-3 dias)
1. Reescrever PayrollSummaryPage.test.tsx
2. Criar testes para serviços principais
3. Implementar testes de componentes críticos

#### Fase 3: Cobertura Completa (3-5 dias)
1. Migrar testes existentes
2. Adicionar testes em falta
3. Otimizar performance
4. Validar cobertura

### 6.2 Critérios de Sucesso
- ✅ Todos os testes passam consistentemente
- ✅ Suite completa executa em < 30s
- ✅ Cobertura > 80% em código crítico
- ✅ Zero dependências circulares
- ✅ Mocks simplificados e focados

## 7. Monitorização e Métricas

### 7.1 Métricas de Qualidade
- **Tempo de execução**: < 30s total
- **Taxa de falhas**: < 1% (flaky tests)
- **Cobertura de código**: > 80%
- **Tempo de debug**: < 5min por falha

### 7.2 Alertas
- Degradação de performance (> 50s)
- Queda de cobertura (< 75%)
- Aumento de testes flaky (> 5%)
- Falhas em CI/CD