import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReminderForm from '@/components/ReminderForm';
import { setupUser } from '../../utils/testHelpers';

const createReminderMutateAsync = vi.fn();
const updateReminderMutateAsync = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

vi.mock('@/hooks/useRemindersQuery', () => ({
  useCreateReminder: () => ({
    mutateAsync: createReminderMutateAsync,
    isPending: false,
  }),
  useUpdateReminder: () => ({
    mutateAsync: updateReminderMutateAsync,
    isPending: false,
  }),
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
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const ctx = React.useContext(SelectContext);
      return (
        <label>
          <input
            type="radio"
            name="reminder-repeat"
            checked={ctx.value === value}
            onChange={() => ctx.onValueChange?.(value)}
          />
          {children}
        </label>
      );
    },
  };
});

describe('ReminderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createReminderMutateAsync.mockResolvedValue(undefined);
    updateReminderMutateAsync.mockResolvedValue(undefined);
  });

  it('renders the reminder fields and default action button', () => {
    render(<ReminderForm />);

    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^data$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hora/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^criar$/i })).toBeInTheDocument();
  });

  it('defaults recurrence to "nenhuma" and reminder to active', () => {
    render(<ReminderForm />);

    expect(screen.getByLabelText(/não repetir/i)).toBeChecked();
    expect(screen.getByLabelText(/^ativo$/i)).toBeChecked();
  });

  it('shows a validation error when title is missing', async () => {
    const user = setupUser();
    render(<ReminderForm />);
    screen.getByRole('button', { name: /^criar$/i }).closest('form')?.setAttribute('novalidate', 'true');

    await user.click(screen.getByRole('button', { name: /^criar$/i }));

    expect(await screen.findByText('Título obrigatório')).toBeInTheDocument();
    expect(createReminderMutateAsync).not.toHaveBeenCalled();
  });

  it('creates a reminder with monthly recurrence', async () => {
    const user = setupUser();
    render(<ReminderForm />);

    await user.type(screen.getByLabelText(/título/i), 'Pagar renda');
    await user.click(screen.getByLabelText(/mensal/i));
    await user.click(screen.getByRole('button', { name: /^criar$/i }));

    await waitFor(() => {
      expect(createReminderMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Pagar renda',
          repetir: 'mensal',
          ativo: true,
        })
      );
    });
  });

  it('supports selecting each recurrence option', async () => {
    const user = setupUser();
    render(<ReminderForm />);

    for (const label of ['Não repetir', 'Diário', 'Semanal', 'Mensal', 'Anual']) {
      await user.click(screen.getByLabelText(new RegExp(label, 'i')));
      expect(screen.getByLabelText(new RegExp(label, 'i'))).toBeChecked();
    }
  });

  it('updates an existing reminder in edit mode', async () => {
    const user = setupUser();
    render(
      <ReminderForm
        initialData={{
          id: 'rem-1',
          titulo: 'Conta da água',
          descricao: 'Pagar até dia 8',
          data_lembrete: '2026-04-30',
          hora_lembrete: '08:30',
          repetir: 'semanal',
          ativo: false,
        }}
      />
    );

    expect(screen.getByRole('button', { name: /atualizar/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Conta da água')).toBeInTheDocument();
    expect(screen.getByLabelText(/^ativo$/i)).not.toBeChecked();

    await user.clear(screen.getByLabelText(/título/i));
    await user.type(screen.getByLabelText(/título/i), 'Conta da água actualizada');
    await user.click(screen.getByRole('button', { name: /atualizar/i }));

    await waitFor(() => {
      expect(updateReminderMutateAsync).toHaveBeenCalledWith({
        id: 'rem-1',
        data: expect.objectContaining({
          titulo: 'Conta da água actualizada',
          repetir: 'semanal',
          ativo: false,
        }),
      });
    });
  });
});
