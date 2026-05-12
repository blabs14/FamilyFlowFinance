import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserPreferences } from '../hooks/useUserPreferences';

const EXEMPT_PATHS = ['/app/settings', '/app/profile', '/app/onboarding'];

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: prefs, isLoading } = useUserPreferences();
  const location = useLocation();
  if (isLoading) return null;
  if (!prefs?.onboarding_completed_at && !EXEMPT_PATHS.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to="/app/onboarding" replace />;
  }
  return <>{children}</>;
}
