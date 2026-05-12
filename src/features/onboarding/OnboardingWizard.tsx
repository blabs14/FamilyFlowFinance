import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { useOnboardingState, ONBOARDING_TOTAL_STEPS } from './useOnboardingState';

interface OnboardingWizardProps {
  onComplete?: () => void;
}

const STEPS = [
  {
    title: 'Bem-vindo ao FamilyFlow',
    description: 'Começa por criar a tua primeira conta bancária para registar transações.',
    cta: 'Criar primeira conta',
    skippable: false,
  },
  {
    title: 'Primeira conta',
    description: 'Regista a tua conta bancária principal (ex: conta-ordenado).',
    cta: 'Criar conta',
    skippable: true,
  },
  {
    title: 'Convidar família',
    description: 'Convida o teu parceiro/a ou família para partilhar finanças.',
    cta: 'Convidar',
    skippable: true,
  },
  {
    title: 'Configurar salário',
    description: 'Regista o teu contrato de trabalho para calcular o teu salário líquido automaticamente.',
    cta: 'Configurar',
    skippable: true,
  },
];

const TOTAL_STEPS = ONBOARDING_TOTAL_STEPS;

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { currentStep, nextStep, completeOnboarding } = useOnboardingState();
  const { toast } = useToast();

  const stepIndex = Math.max(0, Math.min(currentStep - 1, TOTAL_STEPS - 1));
  const step = STEPS[stepIndex];
  const isLastStep = currentStep >= TOTAL_STEPS;

  const handleNext = async () => {
    if (isLastStep) {
      try {
        await completeOnboarding();
        onComplete?.();
      } catch {
        toast({ title: 'Erro ao concluir configuração', description: 'Tenta novamente.', variant: 'destructive' });
      }
    } else {
      nextStep();
    }
  };

  const handleSkip = async () => {
    try {
      await completeOnboarding();
      onComplete?.();
    } catch {
      toast({ title: 'Erro ao saltar configuração', description: 'Tenta novamente.', variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{step.title}</CardTitle>
        {/* Progress dots */}
        <div className="flex gap-1.5 pt-2" aria-label={`Passo ${currentStep} de ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i < currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </CardContent>

      <CardFooter className="flex justify-between gap-2">
        {step.skippable && (
          <Button variant="ghost" onClick={handleSkip}>
            Saltar
          </Button>
        )}
        <Button className="ml-auto" onClick={handleNext}>
          {isLastStep ? 'Concluir' : step.cta}
        </Button>
      </CardFooter>
    </Card>
  );
}
