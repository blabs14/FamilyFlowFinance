import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender, setupIntegrationTest, typeIntoInput, submitForm, waitForLoadingToFinish } from '../utils/test-utils';
import { createPayslipData, createMonthlyTotals, createPayrollCalculationResult, createMockPayrollService } from '../factories/payroll-factories';
import { createMockContract, createMockUser } from '../utils/test-utils';
import PayrollSummaryPage from '@/features/payroll/components/PayrollSummaryPage';
import PayrollCalculatorPage from '@/features/payroll/components/PayrollCalculatorPage';
import PayrollHistoryPage from '@/features/payroll/components/PayrollHistoryPage';

// Mock do serviço de payroll
const mockPayrollService = createMockPayrollService();

// Mock do router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/payroll',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock do contexto de contrato ativo
let mockActiveContract = createMockContract();

vi.mock('@/contexts/ActiveContractContext', () => ({
  useActiveContract: () => ({
    contract: mockActiveContract,
    loading: false,
    error: null,
    setActiveContract: vi.fn(),
  }),
  ActiveContractProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock do hook de payroll
let mockPayrollData = {
  payslips: [],
  monthlyTotals: null,
  loading: false,
  error: null,
  calculatePayroll: vi.fn(),
  getPayrollHistory: vi.fn(),
  getMonthlyTotals: vi.fn(),
};

vi.mock('@/features/payroll/hooks/usePayroll', () => ({
  usePayroll: () => mockPayrollData,
}));

// Mock do React Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  }),
}));

describe('Fluxo de Payroll - Integração', () => {
  const testEnv = setupIntegrationTest();
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset dos dados de payroll
    mockPayrollData = {
      payslips: [],
      monthlyTotals: null,
      loading: false,
      error: null,
      calculatePayroll: vi.fn(),
      getPayrollHistory: vi.fn(),
      getMonthlyTotals: vi.fn(),
    };

    // Reset do contrato ativo
    mockActiveContract = createMockContract();

    // Reset dos mocks
    vi.clearAllMocks();
  });

  describe('Resumo do Payroll', () => {
    it('deve mostrar resumo mensal do payroll', async () => {
      const monthlyTotals = createMonthlyTotals();
      const payslips = [
        createPayslipData({ month: 1, year: 2024 }),
        createPayslipData({ month: 2, year: 2024 }),
        createPayslipData({ month: 3, year: 2024 }),
      ];

      // Mock dos dados carregados
      mockPayrollData.monthlyTotals = monthlyTotals;
      mockPayrollData.payslips = payslips;
      mockPayrollData.loading = false;

      customRender(<PayrollSummaryPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se o título está presente
      expect(screen.getByText(/resumo do payroll/i)).toBeInTheDocument();

      // Verificar se os totais mensais são mostrados
      expect(screen.getByText(monthlyTotals.totalGross.toString())).toBeInTheDocument();
      expect(screen.getByText(monthlyTotals.totalNet.toString())).toBeInTheDocument();
      expect(screen.getByText(monthlyTotals.totalTax.toString())).toBeInTheDocument();

      // Verificar se os payslips são listados
      expect(screen.getByText(/janeiro 2024/i)).toBeInTheDocument();
      expect(screen.getByText(/fevereiro 2024/i)).toBeInTheDocument();
      expect(screen.getByText(/março 2024/i)).toBeInTheDocument();
    });

    it('deve mostrar estado de carregamento', async () => {
      // Mock do estado de carregamento
      mockPayrollData.loading = true;
      mockPayrollData.monthlyTotals = null;
      mockPayrollData.payslips = [];

      customRender(<PayrollSummaryPage />);

      // Verificar se o loading é mostrado
      expect(screen.getByText(/a carregar dados do payroll/i)).toBeInTheDocument();
    });

    it('deve mostrar mensagem quando não há dados', async () => {
      // Mock sem dados
      mockPayrollData.loading = false;
      mockPayrollData.monthlyTotals = null;
      mockPayrollData.payslips = [];

      customRender(<PayrollSummaryPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar mensagem de sem dados
      expect(screen.getByText(/nenhum dado de payroll encontrado/i)).toBeInTheDocument();
    });

    it('deve mostrar erro quando falha o carregamento', async () => {
      // Mock do erro
      mockPayrollData.loading = false;
      mockPayrollData.error = 'Erro ao carregar dados do payroll';
      mockPayrollData.monthlyTotals = null;
      mockPayrollData.payslips = [];

      customRender(<PayrollSummaryPage />);

      // Verificar se o erro é mostrado
      expect(screen.getByText(/erro ao carregar dados do payroll/i)).toBeInTheDocument();
    });
  });

  describe('Calculadora de Payroll', () => {
    it('deve calcular payroll com dados válidos', async () => {
      const calculationResult = createPayrollCalculationResult();
      
      // Mock do cálculo bem-sucedido
      mockPayrollData.calculatePayroll = vi.fn().mockResolvedValue({
        success: true,
        data: calculationResult,
      });

      customRender(<PayrollCalculatorPage />);

      // Verificar se o formulário está presente
      expect(screen.getByText(/calculadora de payroll/i)).toBeInTheDocument();

      // Preencher o formulário
      const baseSalaryInput = screen.getByLabelText(/salário base/i);
      const hoursWorkedInput = screen.getByLabelText(/horas trabalhadas/i);
      const overtimeHoursInput = screen.getByLabelText(/horas extra/i);
      
      await typeIntoInput(baseSalaryInput, '1500');
      await typeIntoInput(hoursWorkedInput, '160');
      await typeIntoInput(overtimeHoursInput, '10');

      // Submeter o formulário
      const calculateButton = screen.getByRole('button', { name: /calcular/i });
      await user.click(calculateButton);

      // Verificar se o cálculo foi chamado
      await waitFor(() => {
        expect(mockPayrollData.calculatePayroll).toHaveBeenCalledWith({
          baseSalary: 1500,
          hoursWorked: 160,
          overtimeHours: 10,
          contractId: mockActiveContract.id,
        });
      });

      // Verificar se os resultados são mostrados
      await waitFor(() => {
        expect(screen.getByText(/resultado do cálculo/i)).toBeInTheDocument();
        expect(screen.getByText(calculationResult.grossSalary.toString())).toBeInTheDocument();
        expect(screen.getByText(calculationResult.netSalary.toString())).toBeInTheDocument();
      });
    });

    it('deve validar campos obrigatórios', async () => {
      customRender(<PayrollCalculatorPage />);

      // Tentar submeter sem preencher campos
      const calculateButton = screen.getByRole('button', { name: /calcular/i });
      await user.click(calculateButton);

      // Verificar mensagens de validação
      await waitFor(() => {
        expect(screen.getByText(/salário base é obrigatório/i)).toBeInTheDocument();
        expect(screen.getByText(/horas trabalhadas é obrigatório/i)).toBeInTheDocument();
      });

      // Verificar que o cálculo não foi chamado
      expect(mockPayrollData.calculatePayroll).not.toHaveBeenCalled();
    });

    it('deve mostrar erro quando cálculo falha', async () => {
      // Mock do erro no cálculo
      mockPayrollData.calculatePayroll = vi.fn().mockResolvedValue({
        success: false,
        error: 'Erro no cálculo do payroll',
      });

      customRender(<PayrollCalculatorPage />);

      // Preencher o formulário
      const baseSalaryInput = screen.getByLabelText(/salário base/i);
      const hoursWorkedInput = screen.getByLabelText(/horas trabalhadas/i);
      
      await typeIntoInput(baseSalaryInput, '1500');
      await typeIntoInput(hoursWorkedInput, '160');

      // Submeter o formulário
      const calculateButton = screen.getByRole('button', { name: /calcular/i });
      await user.click(calculateButton);

      // Verificar se o erro é mostrado
      await waitFor(() => {
        expect(screen.getByText(/erro no cálculo do payroll/i)).toBeInTheDocument();
      });
    });

    it('deve permitir adicionar bónus de pontualidade', async () => {
      const calculationResult = createPayrollCalculationResult({
        punctualityBonus: 100,
      });
      
      mockPayrollData.calculatePayroll = vi.fn().mockResolvedValue({
        success: true,
        data: calculationResult,
      });

      customRender(<PayrollCalculatorPage />);

      // Preencher campos básicos
      const baseSalaryInput = screen.getByLabelText(/salário base/i);
      const hoursWorkedInput = screen.getByLabelText(/horas trabalhadas/i);
      
      await typeIntoInput(baseSalaryInput, '1500');
      await typeIntoInput(hoursWorkedInput, '160');

      // Ativar bónus de pontualidade
      const punctualityCheckbox = screen.getByLabelText(/bónus de pontualidade/i);
      await user.click(punctualityCheckbox);

      // Verificar se o campo de valor do bónus aparece
      const bonusAmountInput = screen.getByLabelText(/valor do bónus/i);
      await typeIntoInput(bonusAmountInput, '100');

      // Submeter o formulário
      const calculateButton = screen.getByRole('button', { name: /calcular/i });
      await user.click(calculateButton);

      // Verificar se o cálculo incluiu o bónus
      await waitFor(() => {
        expect(mockPayrollData.calculatePayroll).toHaveBeenCalledWith({
          baseSalary: 1500,
          hoursWorked: 160,
          overtimeHours: 0,
          punctualityBonus: 100,
          contractId: mockActiveContract.id,
        });
      });

      // Verificar se o bónus é mostrado no resultado
      await waitFor(() => {
        expect(screen.getByText(/bónus de pontualidade.*100/i)).toBeInTheDocument();
      });
    });
  });

  describe('Histórico de Payroll', () => {
    it('deve mostrar lista de payslips históricos', async () => {
      const payslips = [
        createPayslipData({ month: 1, year: 2024, grossSalary: 1500 }),
        createPayslipData({ month: 2, year: 2024, grossSalary: 1600 }),
        createPayslipData({ month: 3, year: 2024, grossSalary: 1550 }),
      ];

      // Mock dos dados históricos
      mockPayrollData.payslips = payslips;
      mockPayrollData.loading = false;

      customRender(<PayrollHistoryPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se o título está presente
      expect(screen.getByText(/histórico de payroll/i)).toBeInTheDocument();

      // Verificar se todos os payslips são mostrados
      expect(screen.getByText(/janeiro 2024/i)).toBeInTheDocument();
      expect(screen.getByText(/fevereiro 2024/i)).toBeInTheDocument();
      expect(screen.getByText(/março 2024/i)).toBeInTheDocument();

      // Verificar valores
      expect(screen.getByText('1500')).toBeInTheDocument();
      expect(screen.getByText('1600')).toBeInTheDocument();
      expect(screen.getByText('1550')).toBeInTheDocument();
    });

    it('deve permitir filtrar por ano', async () => {
      const payslips2023 = [
        createPayslipData({ month: 11, year: 2023 }),
        createPayslipData({ month: 12, year: 2023 }),
      ];
      const payslips2024 = [
        createPayslipData({ month: 1, year: 2024 }),
        createPayslipData({ month: 2, year: 2024 }),
      ];

      // Mock inicial com todos os payslips
      mockPayrollData.payslips = [...payslips2023, ...payslips2024];
      mockPayrollData.getPayrollHistory = vi.fn();

      customRender(<PayrollHistoryPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se todos os payslips são mostrados inicialmente
      expect(screen.getByText(/novembro 2023/i)).toBeInTheDocument();
      expect(screen.getByText(/janeiro 2024/i)).toBeInTheDocument();

      // Filtrar por 2024
      const yearFilter = screen.getByLabelText(/filtrar por ano/i) || screen.getByRole('combobox');
      await user.selectOptions(yearFilter, '2024');

      // Verificar se apenas payslips de 2024 são mostrados
      await waitFor(() => {
        expect(screen.queryByText(/novembro 2023/i)).not.toBeInTheDocument();
        expect(screen.getByText(/janeiro 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/fevereiro 2024/i)).toBeInTheDocument();
      });
    });

    it('deve permitir ver detalhes de um payslip', async () => {
      const payslip = createPayslipData({ 
        month: 1, 
        year: 2024,
        grossSalary: 1500,
        netSalary: 1200,
        tax: 300,
      });

      mockPayrollData.payslips = [payslip];
      mockPayrollData.loading = false;

      customRender(<PayrollHistoryPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no payslip para ver detalhes
      const payslipRow = screen.getByText(/janeiro 2024/i).closest('tr') || 
                        screen.getByTestId(`payslip-${payslip.id}`);
      await user.click(payslipRow);

      // Verificar se os detalhes são mostrados
      await waitFor(() => {
        expect(screen.getByText(/detalhes do payslip/i)).toBeInTheDocument();
        expect(screen.getByText(/salário bruto.*1500/i)).toBeInTheDocument();
        expect(screen.getByText(/salário líquido.*1200/i)).toBeInTheDocument();
        expect(screen.getByText(/impostos.*300/i)).toBeInTheDocument();
      });
    });

    it('deve permitir exportar payslips', async () => {
      const payslips = [
        createPayslipData({ month: 1, year: 2024 }),
        createPayslipData({ month: 2, year: 2024 }),
      ];

      mockPayrollData.payslips = payslips;
      mockPayrollData.exportPayslips = vi.fn().mockResolvedValue({ success: true });

      customRender(<PayrollHistoryPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Selecionar payslips para exportar
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]); // Selecionar primeiro payslip
      await user.click(checkboxes[1]); // Selecionar segundo payslip

      // Clicar no botão de exportar
      const exportButton = screen.getByRole('button', { name: /exportar/i });
      await user.click(exportButton);

      // Verificar se a exportação foi chamada
      await waitFor(() => {
        expect(mockPayrollData.exportPayslips).toHaveBeenCalledWith([
          payslips[0].id,
          payslips[1].id,
        ]);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/payslips exportados com sucesso/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integração entre Componentes', () => {
    it('deve navegar da calculadora para o histórico após cálculo', async () => {
      const calculationResult = createPayrollCalculationResult();
      
      mockPayrollData.calculatePayroll = vi.fn().mockResolvedValue({
        success: true,
        data: calculationResult,
      });

      customRender(<PayrollCalculatorPage />);

      // Fazer um cálculo
      const baseSalaryInput = screen.getByLabelText(/salário base/i);
      const hoursWorkedInput = screen.getByLabelText(/horas trabalhadas/i);
      
      await typeIntoInput(baseSalaryInput, '1500');
      await typeIntoInput(hoursWorkedInput, '160');

      const calculateButton = screen.getByRole('button', { name: /calcular/i });
      await user.click(calculateButton);

      // Aguardar resultado
      await waitFor(() => {
        expect(screen.getByText(/resultado do cálculo/i)).toBeInTheDocument();
      });

      // Clicar no botão para ver histórico
      const viewHistoryButton = screen.getByRole('button', { name: /ver histórico/i });
      await user.click(viewHistoryButton);

      // Verificar navegação
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/payroll/history');
      });
    });

    it('deve atualizar resumo após novo cálculo', async () => {
      const calculationResult = createPayrollCalculationResult();
      const updatedTotals = createMonthlyTotals({
        totalGross: 4500, // Valor atualizado
        totalNet: 3600,
        totalTax: 900,
      });
      
      mockPayrollData.calculatePayroll = vi.fn().mockResolvedValue({
        success: true,
        data: calculationResult,
      });
      
      // Mock da atualização dos totais
      mockPayrollData.getMonthlyTotals = vi.fn().mockResolvedValue(updatedTotals);

      customRender(<PayrollCalculatorPage />);

      // Fazer um cálculo
      const baseSalaryInput = screen.getByLabelText(/salário base/i);
      const hoursWorkedInput = screen.getByLabelText(/horas trabalhadas/i);
      
      await typeIntoInput(baseSalaryInput, '1500');
      await typeIntoInput(hoursWorkedInput, '160');

      const calculateButton = screen.getByRole('button', { name: /calcular/i });
      await user.click(calculateButton);

      // Aguardar cálculo
      await waitFor(() => {
        expect(mockPayrollData.calculatePayroll).toHaveBeenCalled();
      });

      // Verificar se os totais mensais foram atualizados
      await waitFor(() => {
        expect(mockPayrollData.getMonthlyTotals).toHaveBeenCalled();
      });
    });
  });
});