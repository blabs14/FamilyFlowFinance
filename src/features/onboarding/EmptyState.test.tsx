import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renderiza title e description', () => {
    render(<EmptyState title="Sem dados" description="Ainda não há nada por aqui." />);
    expect(screen.getByRole('heading', { name: /sem dados/i })).toBeInTheDocument();
    expect(screen.getByText(/ainda não há nada por aqui/i)).toBeInTheDocument();
  });

  it('chama onCta ao clicar no botão CTA', async () => {
    const user = userEvent.setup();
    const handleCta = vi.fn();
    render(
      <EmptyState
        title="Sem dados"
        description="Descrição"
        ctaLabel="Começar"
        onCta={handleCta}
      />
    );
    await user.click(screen.getByRole('button', { name: /começar/i }));
    expect(handleCta).toHaveBeenCalledOnce();
  });

  it('não renderiza botão quando onCta está ausente', () => {
    render(<EmptyState title="Sem dados" description="Descrição" ctaLabel="Começar" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renderiza o icon quando fornecido', () => {
    render(
      <EmptyState
        title="Sem dados"
        description="Descrição"
        icon={<span data-testid="custom-icon">🌟</span>}
      />
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
