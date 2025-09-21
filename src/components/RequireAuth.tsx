import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from './ui/loading-states';

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only redirect if not loading, no user, and haven't redirected yet
    if (!loading && user === null && !hasRedirected) {
      console.log('🔐 RequireAuth - Redirecting to login from:', location.pathname);
      setHasRedirected(true);
      navigate('/login', { 
        replace: true,
        state: { from: location.pathname }
      });
    }
    
    // Reset redirect flag when user becomes available
    if (user && hasRedirected) {
      setHasRedirected(false);
    }
  }, [user, loading, navigate, location.pathname, hasRedirected]);

  // Show loading while auth is initializing
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  // Don't render anything if no user (will redirect)
  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  return <>{children}</>;
};

export default RequireAuth;