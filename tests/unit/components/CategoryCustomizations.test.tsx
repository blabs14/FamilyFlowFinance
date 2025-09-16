import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import CategoryForm from '@/components/CategoryForm';
import { useAuth } from '@/contexts/AuthContext';
import * as categoriesHooks from '@/hooks/useCategoriesQuery';
import * as customizationsHooks from '@/hooks/useCategoryCustomizationsQuery';

// Mock dos módulos
vi.mock('@/contexts/AuthContext');
vi.mock('@/hooks/useCategoriesQuery');
vi.mock('@/hooks/useCategoryCustomizationsQuery');

const mockUseAuth = vi.mocked(useAuth);
const mockCategoriesHooks = vi.mocked(categoriesHooks);
const mockCustomizationsHooks = vi.mocked(customizationsHooks);

// Mock do logger
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }
}));

// Mock do toast
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('CategoryForm - Personalizações de Categorias Padrão', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock do useAuth
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
    } as any);

    // Mock dos hooks de categorias
    mockCategoriesHooks.useCreateCategory.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);

    mockCategoriesHooks.useUpdateCategory.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);

    // Mock dos hooks de personalizações
    mockCustomizationsHooks.useUpsertCategoryCustomization.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);

    mockCustomizationsHooks.useDeleteCategoryCustomization.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any);
  });

  describe('Categoria Padrão - Edição', () => {
    const defaultCategory = {
      id: 'default-category-1',
      nome: 'Alimentação',
      tipo: 'despesa' as const,
      cor: '#FF6B6B',
      icone: '🍔',
      user_id: null, // Categoria padrão
      created_at: '2024-01-20T10:00:00Z',
    };

    it('deve desabilitar o campo nome para categorias padrão', () => {
      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const nomeInput = screen.getByDisplayValue('Alimentação');
      expect(nomeInput).toBeDisabled();
    });

    it('deve mostrar texto explicativo para categorias padrão', () => {
      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/O nome das categorias padrão não pode ser alterado/)).toBeInTheDocument();
      expect(screen.getByText(/Apenas a cor e ícone podem ser personalizados/)).toBeInTheDocument();
    });

    it('deve permitir editar cor e ícone de categoria padrão', () => {
      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const corInput = screen.getByLabelText(/cor/i);
      const iconeInput = screen.getByDisplayValue('🍔');

      expect(corInput).not.toBeDisabled();
      expect(iconeInput).not.toBeDisabled();

      fireEvent.change(corInput, { target: { value: '#00FF00' } });
      fireEvent.change(iconeInput, { target: { value: '🥗' } });

      expect(corInput).toHaveValue('#00ff00');
      expect(iconeInput).toHaveValue('🥗');
    });

    it('deve usar upsertCustomization ao submeter categoria padrão', async () => {
      const mockUpsertMutation = vi.fn().mockResolvedValue({});
      mockCustomizationsHooks.useUpsertCategoryCustomization.mockReturnValue({
        mutateAsync: mockUpsertMutation,
        isPending: false,
        isError: false,
        error: null,
      } as any);

      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      // Alterar cor e ícone
      fireEvent.change(screen.getByLabelText(/cor/i), { target: { value: '#00FF00' } });
      fireEvent.change(screen.getByDisplayValue('🍔'), { target: { value: '🥗' } });

      // Submeter
      fireEvent.click(screen.getByRole('button', { name: /personalizar/i }));

      await waitFor(() => {
        expect(mockUpsertMutation).toHaveBeenCalledWith({
          category_id: 'default-category-1',
          custom_color: '#00ff00',
          custom_icon: '🥗'
        });
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('deve mostrar botão "Personalizar" para categorias padrão', () => {
      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('button', { name: /personalizar/i })).toBeInTheDocument();
    });

    it('deve mostrar botão "Resetar Personalização" para categorias padrão', () => {
      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByRole('button', { name: /resetar personalização/i })).toBeInTheDocument();
    });

    it('deve resetar personalização ao clicar no botão reset', async () => {
      const mockDeleteMutation = vi.fn().mockResolvedValue({});
      mockCustomizationsHooks.useDeleteCategoryCustomization.mockReturnValue({
        mutateAsync: mockDeleteMutation,
        isPending: false,
        isError: false,
        error: null,
      } as any);

      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      fireEvent.click(screen.getByRole('button', { name: /resetar personalização/i }));

      await waitFor(() => {
        expect(mockDeleteMutation).toHaveBeenCalledWith('default-category-1');
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  describe('Categoria do Utilizador - Edição Normal', () => {
    const userCategory = {
      id: 'user-category-1',
      nome: 'Categoria Personalizada',
      tipo: 'receita' as const,
      cor: '#4ECDC4',
      icone: '💰',
      user_id: 'user-123', // Categoria do utilizador
      created_at: '2024-01-20T10:00:00Z',
    };

    it('deve permitir editar nome para categorias do utilizador', () => {
      render(
        <CategoryForm
          initialData={userCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const nomeInput = screen.getByDisplayValue('Categoria Personalizada');
      expect(nomeInput).not.toBeDisabled();
    });

    it('deve usar updateCategory ao submeter categoria do utilizador', async () => {
      const mockUpdateMutation = vi.fn().mockResolvedValue({});
      mockCategoriesHooks.useUpdateCategory.mockReturnValue({
        mutateAsync: mockUpdateMutation,
        isPending: false,
        isError: false,
        error: null,
      } as any);

      render(
        <CategoryForm
          initialData={userCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      // Alterar nome
      fireEvent.change(screen.getByDisplayValue('Categoria Personalizada'), { 
        target: { value: 'Categoria Atualizada' } 
      });

      // Submeter
      fireEvent.click(screen.getByText('Atualizar'));

      await waitFor(() => {
        expect(mockUpdateMutation).toHaveBeenCalledWith({
          id: 'user-category-1',
          data: {
            nome: 'Categoria Atualizada',
            tipo: 'receita',
            cor: '#4ECDC4',
            icone: '💰'
          }
        });
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('deve mostrar botão "Atualizar" para categorias do utilizador', () => {
      render(
        <CategoryForm
          initialData={userCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Atualizar')).toBeInTheDocument();
    });

    it('não deve mostrar botão "Resetar Personalização" para categorias do utilizador', () => {
      render(
        <CategoryForm
          initialData={userCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Resetar Personalização')).not.toBeInTheDocument();
    });
  });

  describe('Estados de Loading', () => {
    const defaultCategory = {
      id: 'default-category-1',
      nome: 'Alimentação',
      tipo: 'despesa' as const,
      cor: '#FF6B6B',
      icone: '🍔',
      user_id: null,
      created_at: '2024-01-20T10:00:00Z',
    };

    it('deve desabilitar botões durante upsert de personalização', () => {
      mockCustomizationsHooks.useUpsertCategoryCustomization.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any);

      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const personalizarButton = screen.getByRole('button', { name: /personalizar/i });
      const resetButton = screen.getByRole('button', { name: /resetar personalização/i });

      expect(personalizarButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
    });

    it('deve desabilitar botões durante delete de personalização', () => {
      mockCustomizationsHooks.useDeleteCategoryCustomization.mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any);

      render(
        <CategoryForm
          initialData={defaultCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />,
        { wrapper: createWrapper() }
      );

      const personalizarButton = screen.getByRole('button', { name: /personalizar/i });
      const resetButton = screen.getByRole('button', { name: /resetar personalização/i });

      expect(personalizarButton).toBeDisabled();
      expect(resetButton).toBeDisabled();
    });
  });
});