import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CategoryManagement } from '@/components/CategoryManagement';

const mutateAsync = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();
const mockUseCategoriesDomain = vi.fn();

vi.mock('@/hooks/useCategoriesQuery', () => ({
  useCategoriesDomain: () => mockUseCategoriesDomain(),
  useDeleteCategory: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/components/CategoryForm', () => ({
  default: ({
    onSuccess,
    onCancel,
  }: {
    onSuccess?: () => void;
    onCancel?: () => void;
  }) => (
    <div>
      <button type="button" onClick={onSuccess}>
        Guardar Categoria
      </button>
      <button type="button" onClick={onCancel}>
        Fechar Categoria
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: (message: string) => notifySuccess(message),
  notifyError: (message: string) => notifyError(message),
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return {
    ...actual,
    getCategoryIcon: () => () => <span data-testid="category-icon" />,
  };
});

describe('CategoryManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra estado vazio quando não existem categorias', () => {
    mockUseCategoriesDomain.mockReturnValue({ data: [], isLoading: false });

    render(<CategoryManagement />);

    expect(screen.getByText('Não existem categorias disponíveis.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar Primeira Categoria/i })).toBeInTheDocument();
  });

  it('lista categorias e só permite eliminar as personalizadas', () => {
    mockUseCategoriesDomain.mockReturnValue({
      data: [
        { id: 'sys-1', nome: 'Salário', cor: '#111111', user_id: null },
        { id: 'usr-1', nome: 'Hobbies', cor: '#222222', user_id: 'user-1' },
      ],
      isLoading: false,
    });

    render(<CategoryManagement />);

    expect(screen.getByText('Salário')).toBeInTheDocument();
    expect(screen.getByText('Hobbies')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Eliminar' })).toHaveLength(1);
  });

  it('elimina uma categoria personalizada com feedback de sucesso', async () => {
    mockUseCategoriesDomain.mockReturnValue({
      data: [{ id: 'usr-1', nome: 'Hobbies', cor: '#222222', user_id: 'user-1' }],
      isLoading: false,
    });
    mutateAsync.mockResolvedValue(undefined);

    render(<CategoryManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith('usr-1'));
    expect(notifySuccess).toHaveBeenCalledWith('Categoria "Hobbies" eliminada com sucesso');
  });

  it('mostra erro específico quando a categoria ainda está em uso', async () => {
    mockUseCategoriesDomain.mockReturnValue({
      data: [{ id: 'usr-1', nome: 'Hobbies', cor: '#222222', user_id: 'user-1' }],
      isLoading: false,
    });
    mutateAsync.mockRejectedValue({ code: '23503' });

    render(<CategoryManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(notifyError).toHaveBeenCalledWith(
        'Não é possível eliminar a categoria "Hobbies" porque ainda está a ser utilizada em transações ou orçamentos.'
      );
    });
  });
});
