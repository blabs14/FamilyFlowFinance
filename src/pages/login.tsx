
import LoginForm from '../components/auth/LoginForm';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Login() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-gradient-card">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mb-4">
              <span className="text-primary-foreground font-bold text-xl">F</span>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Iniciar Sessão</CardTitle>
            <CardDescription className="text-muted-foreground">
              Aceda à sua conta para gerir as suas finanças
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <div className="flex items-center justify-between mt-6 text-sm">
              <Link 
                to="/register" 
                className="text-primary hover:text-primary-dark transition-colors font-medium"
              >
                Criar nova conta
              </Link>
              <Link 
                to="/forgot-password" 
                className="text-primary hover:text-primary-dark transition-colors font-medium"
              >
                Recuperar password
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
