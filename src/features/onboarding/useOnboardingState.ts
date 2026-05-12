import { useState } from 'react';
import { useUpdateUserPreferences } from '../../hooks/useUserPreferences';

const STORAGE_KEY = 'fff_onboarding_done';

export interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => Promise<void>;
}

const isDone = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useOnboardingState = (): OnboardingState => {
  const [showWizard, setShowWizard] = useState<boolean>(!isDone());
  const [currentStep, setCurrentStep] = useState<number>(1);
  const updatePrefs = useUpdateUserPreferences();

  const TOTAL_STEPS = 4;

  const completeOnboarding = async () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage unavailable — continue silently
    }
    await updatePrefs.mutateAsync({ onboarding_completed_at: new Date().toISOString() });
    setShowWizard(false);
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const nextStep = () => {
    if (currentStep >= TOTAL_STEPS) {
      completeOnboarding();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return { showWizard, currentStep, nextStep, skipOnboarding, completeOnboarding };
};
