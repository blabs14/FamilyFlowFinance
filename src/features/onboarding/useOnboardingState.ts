import { useState } from 'react';
import { useUpdateUserPreferences } from '../../hooks/useUserPreferences';

export const ONBOARDING_TOTAL_STEPS = 4;

export interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  nextStep: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useOnboardingState = (): OnboardingState => {
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const updatePrefs = useUpdateUserPreferences();

  const completeOnboarding = async () => {
    await updatePrefs.mutateAsync({ onboarding_completed_at: new Date().toISOString() });
    setShowWizard(false);
  };

  const skipOnboarding = async () => {
    await completeOnboarding();
  };

  const nextStep = async () => {
    if (currentStep >= ONBOARDING_TOTAL_STEPS) {
      await completeOnboarding();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return { showWizard, currentStep, nextStep, skipOnboarding, completeOnboarding };
};
