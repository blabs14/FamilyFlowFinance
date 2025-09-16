
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, signInWithApple, signInWithFacebook } from '../../services/authProviders';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription } from '../ui/alert';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { showError } from '../../lib/utils';
import { loginSchema, type LoginFormData } from '../../models/authSchema';

export default function LoginForm() {
  const [error, setError] = useState('');
  const { login, loading, user } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitted, touchedFields },
    setError: setFormError,
    clearErrors,
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    console.log('🔐 [LoginForm] Iniciando processo de login...');
    console.log('📧 [LoginForm] Email:', data.email);
    console.log('🔑 [LoginForm] Password length:', data.password?.length);
    

    
    setError('');
    clearErrors();
    try {
      const result = (await login(data.email, data.password)) || {};
      if (result.error) {
        setError(result.error.message);
        showError('Erro ao iniciar sessão: ' + result.error.message);
        setFocus('email');
      } else {
        navigate('/app');
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple' | 'facebook') => {
    console.log(`🔗 [LoginForm] Iniciando login OAuth com ${provider}...`);
    setError('');
    try {
      if (provider === 'google') await signInWithGoogle();
      if (provider === 'apple') await signInWithApple();
      if (provider === 'facebook') await signInWithFacebook();
    } catch (err: any) {
      const errorMessage = 'Erro ao autenticar com ' + provider;
      setError(errorMessage);
      showError(errorMessage);
    }
  };

  useEffect(() => {
    if (user) navigate('/app');
  }, [user, navigate]);

  const showEmailError = (!!errors.email && (touchedFields.email || isSubmitted));
  const showPasswordError = (!!errors.password && (touchedFields.password || isSubmitted));

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(handleLogin)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="exemplo@email.com"
              {...register('email')}
              autoFocus
              className={`pl-10 ${showEmailError ? 'border-red-500 focus:border-red-500' : ''}`}
              aria-invalid={showEmailError}
            />
          </div>
          {showEmailError && (
            <p className="text-sm text-red-600 mt-1">{errors.email?.message}</p>
          )}
          <p className="text-xs text-muted-foreground">O seu email de acesso.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="Password"
              {...register('password')}
              className={`pl-10 ${showPasswordError ? 'border-red-500 focus:border-red-500' : ''}`}
              aria-invalid={showPasswordError}
            />
          </div>
          {showPasswordError && (
            <p className="text-sm text-red-600 mt-1">{errors.password?.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Deve ter pelo menos 6 caracteres.</p>
        </div>

        <Button type="submit" disabled={isSubmitting || loading} className="w-full" variant="default">
          {(isSubmitting || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {(isSubmitting || loading) ? 'A entrar...' : 'Entrar'}
        </Button>
      </form>

      <div className="space-y-4">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button type="button" onClick={() => handleOAuth('google')} disabled={loading} variant="outline" className="w-full">
            <div className="w-4 h-4 mr-2 bg-[#4285f4] rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">G</span>
            </div>
            Entrar com Google
          </Button>

          <Button type="button" onClick={() => handleOAuth('apple')} disabled={loading} variant="outline" className="w-full">
            <div className="w-4 h-4 mr-2 bg-black rounded-sm flex items-center justify-center">
              <span className="text-white text-xs">🍎</span>
            </div>
            Entrar com Apple
          </Button>

          <Button type="button" onClick={() => handleOAuth('facebook')} disabled={loading} variant="outline" className="w-full">
            <div className="w-4 h-4 mr-2 bg-[#1877f2] rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-bold">f</span>
            </div>
            Entrar com Facebook
          </Button>
        </div>
      </div>
    </div>
  );
}
