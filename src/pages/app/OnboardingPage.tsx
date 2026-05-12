import { useNavigate } from 'react-router-dom';
import { OnboardingWizard } from '../../features/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <OnboardingWizard onComplete={() => navigate('/app')} />
    </div>
  );
}
