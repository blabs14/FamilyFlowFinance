import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BudgetForm from '@/components/BudgetForm';

const createBudgetMutateAsync = vi.fn();
const updateBudgetMutateAsync = vi.fn();
const mockUseCategoriesDomain = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useBudgetsQuery', () => ({
  useCreateBudget: () => ({
    mutateAsync: createBudgetMutateAsync,
    isPending: false,
  }),
  useUpdateBudget: () => ({
    mutateAsync: updateBudgetMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCategoriesQuery', () => ({
  useCategoriesDomain: () => mockUseCategoriesDomain(),
}));

vi.mock('@/shared/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');

  const SelectContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) => (
      <SelectContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => {
      const ctx = React.useContext(SelectContext);

      return (
        <label>
          <input
            type="radio"
            name={`select-${String(ctx.onValueChange)}`}
            checked={ctx.value === value}
            onChange={() => ctx.onValueChange?.(value)}
          />
          {children}
        </label>
      );
    },
  };
});

describe('BudgetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCategoriesDomain.mockReturnValue({
      data: [
        { id: 'cat-1', nome: 'Casa' },
        { id: 'cat-2', nome: 'Transporte' },
      ],
      isLoading: false,
    });
  });

  it('submete um novo orçamento e chama onSuccess', async () => {
    const onSuccess = vi.fn();
    render(
      <BudgetForm
        onSuccess={onSuccess}
        initialData={{
          categoria_id: 'cat-1',
          valor_limite: 150,
          ano: new Date().getFullYear(),
          mes: new Date().getMonth() + 1,
        }}
      />
    );

    fireEvent.change(screen.getByLabelText('Valor Limite (€)'), {
      target: { value: '250' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Criar' }).closest('form')!);

    await waitFor(() => {
      expect(createBudgetMutateAsync).toHaveBeenCalledWith({
        categoria_id: 'cat-1',
        valor: 250,
        mes: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      });
    });

    expect(updateBudgetMutateAsync).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('mostra erro de validação quando a categoria não é escolhida', async () => {
    render(<BudgetForm />);

    fireEvent.change(screen.getByLabelText('Valor Limite (€)'), {
      target: { value: '250' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Criar' }).closest('form')!);

    expect(await screen.findByText('Categoria obrigatória')).toBeInTheDocument();
    expect(createBudgetMutateAsync).not.toHaveBeenCalled();
  });

  it('chama onCancel quando o utilizador cancela', () => {
    const onCancel = vi.fn();
    render(<BudgetForm onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
