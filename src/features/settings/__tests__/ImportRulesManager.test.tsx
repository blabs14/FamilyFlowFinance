import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImportRulesManager } from '../ImportRulesManager';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({
            data: [
              { id: '1', scope: 'system_seed', pattern: 'LIDL', match_type: 'contains', match_field: 'description', priority: 1000, active: true, category_id: null },
              { id: '2', scope: 'user', pattern: 'NETFLIX', match_type: 'contains', match_field: 'description', priority: 100, active: true, category_id: null },
            ],
            error: null,
          }),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../features/scope', () => ({ useScope: () => ({ activeFamily: null }) }));

const toastCalls: { title: string; variant?: string }[] = [];
vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: (args: { title: string; variant?: string }) => {
      toastCalls.push(args);
    },
  }),
}));

describe('ImportRulesManager', () => {
  beforeEach(() => {
    toastCalls.length = 0;
  });

  it('shows both system and user rules', async () => {
    render(<QueryClientProvider client={new QueryClient()}><ImportRulesManager /></QueryClientProvider>);
    expect(await screen.findByText('LIDL')).toBeInTheDocument();
    expect(await screen.findByText('NETFLIX')).toBeInTheDocument();
  });

  it('system_seed rules have no delete button', async () => {
    render(<QueryClientProvider client={new QueryClient()}><ImportRulesManager /></QueryClientProvider>);
    await screen.findByText('LIDL'); // wait for load
    // User rule (NETFLIX) has a delete button
    expect(screen.getByLabelText('Eliminar regra NETFLIX')).toBeInTheDocument();
    // System seed rule (LIDL) has NO delete button
    expect(screen.queryByLabelText('Eliminar regra LIDL')).toBeNull();
  });

  it('opens create dialog when "Nova regra" is clicked', async () => {
    render(<QueryClientProvider client={new QueryClient()}><ImportRulesManager /></QueryClientProvider>);
    await screen.findByText('NETFLIX'); // wait for load
    fireEvent.click(screen.getByRole('button', { name: /nova regra/i }));
    expect(await screen.findByText('Nova regra de categorização')).toBeInTheDocument();
  });

  it('shows validation error when pattern is empty on create', async () => {
    render(<QueryClientProvider client={new QueryClient()}><ImportRulesManager /></QueryClientProvider>);
    await screen.findByText('NETFLIX');
    fireEvent.click(screen.getByRole('button', { name: /nova regra/i }));
    await screen.findByText('Nova regra de categorização');
    fireEvent.click(screen.getByRole('button', { name: /criar regra/i }));
    // Wait briefly for state to update
    await new Promise(r => setTimeout(r, 50));
    expect(toastCalls.some(c => /padrão obrigatório/i.test(c.title))).toBe(true);
  });
});
