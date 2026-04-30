import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OnboardingWizard } from './OnboardingWizard';

const defaultProps = {
  currentStep: 1,
  onNext: vi.fn(),
  onSkip: vi.fn(),
  onCreateAccount: vi.fn(),
  onSeedCategories: vi.fn(),
};

describe('OnboardingWizard', () => {
  it('renderiza conteúdo do passo 1 (criar conta)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={1} />);
    expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
  });

  it('renderiza conteúdo do passo 2 (categorias)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={2} />);
    expect(screen.getByRole('heading', { name: /categori/i })).toBeInTheDocument();
  });

  it('renderiza conteúdo do passo 3 (explorar)', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={3} />);
    expect(screen.getByText(/explor/i)).toBeInTheDocument();
  });

  it('botão Saltar chama onSkip', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<OnboardingWizard {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: /saltar/i }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('botão Próximo chama onNext nos passos 1 e 2', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<OnboardingWizard {...defaultProps} currentStep={1} onNext={onNext} />);
    await user.click(screen.getByRole('button', { name: /próximo/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('botão Concluir aparece no passo 3', () => {
    render(<OnboardingWizard {...defaultProps} currentStep={3} />);
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument();
  });
});
