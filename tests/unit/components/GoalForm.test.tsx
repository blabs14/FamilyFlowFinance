import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GoalForm from '@/components/GoalForm';
import { useAuth } from '@/contexts/AuthContext';
import * as goalsService from '@/services/goals';
import { useGoals, useCreateGoal, useUpdateGoal } from '@/hooks/useGoalsQuery';

// Mock dos serviços e hooks
vi.mock('@/contexts/AuthContext');
vi.mock('@/services/goals');
vi.mock('@/hooks/useGoalsQuery');

const mockUseAuth = vi.mocked(useAuth);
const mockGoalsService = vi.mocked(goalsService);
const mockUseGoals = vi.mocked(useGoals);
const mockUseCreateGoal = vi.mocked(useCreateGoal);
const mockUseUpdateGoal = vi.mocked(useUpdateGoal);

// Wrapper para QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('GoalForm', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const mockCreateGoal = vi.fn();
  const mockUpdateGoal = vi.fn();
  const mockMutateAsyncCreate = vi.fn();
  const mockMutateAsyncUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    mockCreateGoal.mockResolvedValue(undefined);
    mockUpdateGoal.mockResolvedValue(undefined);
    mockMutateAsyncCreate.mockResolvedValue(undefined);
    mockMutateAsyncUpdate.mockResolvedValue(undefined);
    
    mockUseGoals.mockReturnValue({
      createGoal: mockCreateGoal,
      updateGoal: mockUpdateGoal,
      isCreating: false,
      isUpdating: false,
    });

    mockUseCreateGoal.mockReturnValue({
      mutate: mockCreateGoal,
      mutateAsync: mockMutateAsyncCreate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      isSuccess: false,
    });

    mockUseUpdateGoal.mockReturnValue({
      mutate: mockUpdateGoal,
      mutateAsync: mockMutateAsyncUpdate,
      isPending: false,
      isError: false,
      error: null,
      data: undefined,
      isSuccess: false,
    });

    mockGoalsService.createGoal.mockResolvedValue({
      data: { 
        id: 'new-goal-id', 
        nome: 'Novo Objetivo', 
        valor_alvo: 5000,
        valor_atual: 0,
        data_limite: '2024-12-31'
      },
      error: null,
    });

    mockGoalsService.updateGoal.mockResolvedValue({
      data: { 
        id: 'goal-1', 
        nome: 'Objetivo Atualizado', 
        valor_alvo: 10000,
        valor_atual: 2500,
        data_limite: '2025-06-30'
      },
      error: null,
    });
  });

  it('should render form fields correctly', () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByPlaceholderText('Ex: Férias no Algarve')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0,00')).toBeInTheDocument();
    expect(screen.getByText('Data Limite (Opcional)')).toBeInTheDocument();
    expect(screen.getByText('Criar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('should handle form submission for new goal', async () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Preencher formulário
    fireEvent.change(screen.getByPlaceholderText('Ex: Férias no Algarve'), {
      target: { value: 'Viagem para Europa' },
    });
    
    fireEvent.change(screen.getByPlaceholderText('0,00'), {
      target: { value: '8000' },
    });

    // Campo de descrição não existe no GoalForm

    // Definir data limite
    const dateInput = screen.getByDisplayValue('');
    fireEvent.change(dateInput, {
      target: { value: '2024-12-31' },
    });

    // Submeter formulário
    fireEvent.click(screen.getByText('Criar'));

    await waitFor(() => {
      expect(mockMutateAsyncCreate).toHaveBeenCalledWith({
        nome: 'Viagem para Europa',
        target_cents: 800000,
        prazo: '2024-12-31',
        valor_atual: 0,
        user_id: 'test-user-id'
      });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should handle form submission for editing goal', async () => {
    const existingGoal = {
      id: 'goal-1',
      nome: 'Objetivo Existente',
      valor_objetivo: 5000,
      valor_atual: 1500,
      prazo: '2024-06-30',
    };

    render(
      <GoalForm 
        initialData={existingGoal}
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />,
      { wrapper: createWrapper() }
    );

    // Verificar se os campos estão preenchidos
    expect(screen.getByDisplayValue('Objetivo Existente')).toBeInTheDocument();
    
    // Verificar o valor objetivo usando o label
    const valorInput = screen.getByLabelText('Valor Objetivo (€)');
    expect(valorInput).toHaveValue('5000');
    
    expect(screen.getByText('Atualizar')).toBeInTheDocument();

    // Alterar valor alvo
    fireEvent.change(screen.getByDisplayValue('5000'), {
      target: { value: '7500' },
    });

    // Submeter formulário
    fireEvent.click(screen.getByText('Atualizar'));

    await waitFor(() => {
      expect(mockMutateAsyncUpdate).toHaveBeenCalledWith({
        id: 'goal-1',
        data: {
          nome: 'Objetivo Existente',
          target_cents: 750000,
          prazo: '2024-06-30'
        }
      });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should handle cancel button click', () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should validate required fields', async () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Garantir que o campo nome está vazio
    const nomeInput = screen.getByPlaceholderText('Ex: Férias no Algarve');
    fireEvent.change(nomeInput, { target: { value: '   ' } }); // Espaços em branco
    
    // Garantir que o valor objetivo é 0
    const valorInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(valorInput, { target: { value: '0' } });
    
    // Tentar submeter sem preencher campos obrigatórios
    fireEvent.click(screen.getByText('Criar'));

    await waitFor(() => {
      expect(screen.getByText('Nome obrigatório')).toBeInTheDocument();
    });

    expect(mockCreateGoal).not.toHaveBeenCalled();
  });

  it('should validate minimum value for valor_alvo', async () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Preencher nome válido
    fireEvent.change(screen.getByPlaceholderText('Ex: Férias no Algarve'), {
      target: { value: 'Objetivo Teste' },
    });

    // Preencher valor inválido (muito baixo)
    fireEvent.change(screen.getByPlaceholderText('0,00'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByText('Criar'));

    await waitFor(() => {
      expect(screen.getByText('Valor objetivo obrigatório')).toBeInTheDocument();
    });

    expect(mockGoalsService.createGoal).not.toHaveBeenCalled();
  });

  it('should handle numeric input for valor_alvo', () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    const valorInput = screen.getByPlaceholderText('0,00');
    
    // Testar input numérico válido
    fireEvent.change(valorInput, { target: { value: '2500.75' } });
    expect(valorInput).toHaveValue('2500.75');

    // Testar input não numérico (deve ser filtrado)
    fireEvent.change(valorInput, { target: { value: 'abc456' } });
    expect(valorInput).toHaveValue('456');
  });

  it('should allow submission with valid date', async () => {
    render(
      <GoalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Preencher campos obrigatórios
    fireEvent.change(screen.getByPlaceholderText('Ex: Férias no Algarve'), {
      target: { value: 'Objetivo Teste' },
    });
    
    fireEvent.change(screen.getByPlaceholderText('0,00'), {
      target: { value: '1000' },
    });

    // Definir data no futuro
    const dateInput = screen.getByDisplayValue('');
    fireEvent.change(dateInput, {
      target: { value: '2025-12-31' },
    });

    fireEvent.click(screen.getByText('Criar'));

    await waitFor(() => {
        expect(mockMutateAsyncCreate).toHaveBeenCalledWith({
           nome: 'Objetivo Teste',
           target_cents: 100000,
           prazo: '2025-12-31',
           valor_atual: 0,
           user_id: 'test-user-id'
         });
      });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});