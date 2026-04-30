import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';

const TOTAL_STEPS = 3;

interface OnboardingWizardProps {
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  onCreateAccount: () => void;
  onSeedCategories: () => void;
}

const STEPS = [
  {
    title: 'Criar conta',
    description: 'Regista-te para guardar os teus dados de forma segura e aceder em qualquer dispositivo.',
    cta: 'Criar conta',
  },
  {
    title: 'Configurar categorias',
    description: 'Personaliza as categorias de receitas e despesas para refletir a tua vida financeira.',
    cta: 'Adicionar categorias',
  },
  {
    title: 'Explorar a aplicação',
    description: 'Descobre as funcionalidades disponíveis e começa a gerir as tuas finanças.',
    cta: 'Explorar',
  },
];

export function OnboardingWizard({
  currentStep,
  onNext,
  onSkip,
}: OnboardingWizardProps) {
  const stepIndex = Math.max(0, Math.min(currentStep - 1, TOTAL_STEPS - 1));
  const step = STEPS[stepIndex];
  const isLastStep = currentStep >= TOTAL_STEPS;

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
        <Button variant="ghost" onClick={onSkip}>
          Saltar
        </Button>
        <Button onClick={onNext}>
          {isLastStep ? 'Concluir' : 'Próximo'}
        </Button>
      </CardFooter>
    </Card>
  );
}
