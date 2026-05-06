// src/components/inbox/__tests__/InboxItem.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InboxItem from '../InboxItem';
import type { InboxItem as InboxItemType } from '@/services/inbox';

const baseItem: InboxItemType = {
  id: 'item-1',
  user_id: 'u-1',
  family_id: null,
  source_type: 'recurring_instance',
  source_id: 'inst-1',
  title: 'Confirmar: Netflix',
  body: null,
  due_at: '2026-05-01T00:00:00Z',
  status: 'pending',
  snoozed_until: null,
  completed_at: null,
  created_at: '2026-04-25T00:00:00Z',
};

describe('InboxItem', () => {
  it('renders item title', () => {
    render(<InboxItem item={baseItem} onDone={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Confirmar: Netflix')).toBeInTheDocument();
  });

  it('calls onDone when confirm button clicked', () => {
    const onDone = vi.fn();
    render(<InboxItem item={baseItem} onDone={onDone} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onDone).toHaveBeenCalledWith(baseItem);
  });

  it('calls onDismiss when skip button clicked', () => {
    const onDismiss = vi.fn();
    render(<InboxItem item={baseItem} onDone={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /saltar/i }));
    expect(onDismiss).toHaveBeenCalledWith(baseItem);
  });

  it('shows "Resolver" for non-recurring source types', () => {
    render(
      <InboxItem
        item={{ ...baseItem, source_type: 'manual' }}
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /resolver/i })).toBeInTheDocument();
  });
});
