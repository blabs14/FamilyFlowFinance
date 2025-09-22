import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';

export default function DirectLoginTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const { login } = useAuth();

  const handleDirectLogin = async () => {
    console.log('[DIRECT-TEST] ==================== INÍCIO DO TESTE DIRETO ====================');
    setIsLoading(true);
    setResult('');

    try {
      // Verificar sessão anterior
      console.log('[DIRECT-TEST] Verificando sessão anterior...');
      
      // Configuração do cliente
      console.log('[DIRECT-TEST] Configuração do cliente Supabase...');
      
      // Dados de login
      const email = 'testetotal@exemplo.com';
      const password = 'teste14';
      
      console.log('[DIRECT-TEST] Payload do login:', { email, password });
      console.log('[DIRECT-TEST] Chamando função login...');
      
      const loginResult = await login(email, password);
      
      console.log('[DIRECT-TEST] Resultado completo:', JSON.stringify(loginResult, null, 2));
      
      if (loginResult?.error) {
        console.error('[DIRECT-TEST] Erro no login:', loginResult.error);
        setResult(`❌ Erro: ${loginResult.error.message}`);
      } else if (loginResult?.data?.user) {
        console.log('[DIRECT-TEST] Login bem-sucedido!');
        setResult(`✅ Sucesso: ${loginResult.data.user.email}`);
      } else {
        console.log('[DIRECT-TEST] Resultado inesperado:', loginResult);
        setResult('⚠️ Resultado inesperado');
      }
    } catch (error) {
      console.error('[DIRECT-TEST] Exceção:', error);
      if (error instanceof Error) {
        console.error('[DIRECT-TEST] Stack trace:', error.stack);
      }
      setResult(`💥 Exceção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
      console.log('[DIRECT-TEST] ==================== FIM DO TESTE DIRETO ====================');
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={handleDirectLogin}
        disabled={isLoading}
        className="w-full"
        variant="outline"
      >
        {isLoading ? 'A testar...' : '🧪 Teste Direto de Login'}
      </Button>
      
      {result && (
        <div className="p-3 rounded-md bg-muted text-sm font-mono">
          {result}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        Este componente testa o login diretamente sem formulário para análise de logs detalhados.
      </div>
    </div>
  );
}