import { useState } from 'react';

const STORAGE_KEY = 'fff_onboarding_done';
const TOTAL_STEPS = 3;

export interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  nextStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
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

  const completeOnboarding = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage unavailable — continue silently
    }
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
