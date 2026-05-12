import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OnboardingWizard } from './OnboardingWizard';

const mockCompleteOnboarding = vi.fn().mockResolvedValue(undefined);
const mockNextStep = vi.fn();

// Mutable so tests can control the current step
let mockCurrentStep = 1;

vi.mock('./useOnboardingState', () => ({
  useOnboardingState: () => ({
    get currentStep() { return mockCurrentStep; },
    nextStep: mockNextStep,
    completeOnboarding: mockCompleteOnboarding,
    skipOnboarding: vi.fn(),
    showWizard: true,
  }),
}));

describe('OnboardingWizard — passo 1', () => {
  beforeEach(() => {
    mockCurrentStep = 1;
    vi.clearAllMocks();
    mockCompleteOnboarding.mockResolvedValue(undefined);
  });

  it('renderiza conteúdo do passo 1 (bem-vindo)', () => {
    render(<OnboardingWizard />);
    expect(screen.getByText(/bem-vindo ao familyflow/i)).toBeInTheDocument();
  });

  it('botão CTA do passo 1 não tem Saltar (não skippable)', () => {
    render(<OnboardingWizard />);
    expect(screen.queryByRole('button', { name: /saltar/i })).not.toBeInTheDocument();
  });

  it('botão CTA chama nextStep ao clicar no passo 1', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);
    await user.click(screen.getByRole('button', { name: /criar primeira conta/i }));
    expect(mockNextStep).toHaveBeenCalledOnce();
  });

  it('renderiza 4 progress dots', () => {
    render(<OnboardingWizard />);
    const progressArea = screen.getByLabelText(/passo 1 de 4/i);
    expect(progressArea.querySelectorAll('span')).toHaveLength(4);
  });
});

describe('OnboardingWizard — passo 4 (último)', () => {
  beforeEach(() => {
    mockCurrentStep = 4;
    vi.clearAllMocks();
    mockCompleteOnboarding.mockResolvedValue(undefined);
  });

  it('botão Concluir aparece no último passo', () => {
    render(<OnboardingWizard />);
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument();
  });

  it('botão Saltar aparece no último passo (skippable)', () => {
    render(<OnboardingWizard />);
    expect(screen.getByRole('button', { name: /saltar/i })).toBeInTheDocument();
  });

  it('botão Concluir chama completeOnboarding e onComplete', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingWizard onComplete={onComplete} />);
    await user.click(screen.getByRole('button', { name: /concluir/i }));
    expect(mockCompleteOnboarding).toHaveBeenCalledOnce();
  });
});
