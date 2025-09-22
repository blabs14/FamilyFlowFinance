import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export const DirectLoginTest: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    setLogs(prev => [...prev, logMessage]);
    console.log(logMessage);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testDirectLogin = async () => {
    setIsLoading(true);
    clearLogs();
    
    const email = 'testetotal@exemplo.com';
    const password = 'teste14';
    
    addLog('🔐 Iniciando teste de login direto');
    addLog(`Email: ${email}`);
    addLog(`Password: ${password}`);
    addLog(`Email type: ${typeof email}`);
    addLog(`Password type: ${typeof password}`);
    addLog(`Email length: ${email.length}`);
    addLog(`Password length: ${password.length}`);
    
    try {
      // Verificar sessão atual
      addLog('📋 Verificando sessão atual...');
      const { data: currentSession } = await supabase.auth.getSession();
      addLog(`Sessão atual: ${!!currentSession.session}`);
      
      if (currentSession.session) {
        addLog(`⚠️ Sessão ativa encontrada para: ${currentSession.session.user?.email}`);
        addLog('🚪 Fazendo logout da sessão atual...');
        await supabase.auth.signOut();
        addLog('✅ Logout realizado');
      }
      
      // Verificar configuração
      addLog('🔧 Verificando configuração...');
      addLog(`VITE_SUPABASE_URL: ${import.meta.env.VITE_SUPABASE_URL}`);
      addLog(`VITE_SUPABASE_ANON_KEY length: ${import.meta.env.VITE_SUPABASE_ANON_KEY?.length}`);
      
      // Tentar login
      addLog('📞 Chamando supabase.auth.signInWithPassword...');
      
      const loginPayload = { email, password };
      addLog(`📦 Payload: ${JSON.stringify(loginPayload)}`);
      
      const { data, error } = await supabase.auth.signInWithPassword(loginPayload);
      
      addLog('📋 Resultado do login:');
      addLog(`Data: ${JSON.stringify(data, null, 2)}`);
      addLog(`Error: ${JSON.stringify(error, null, 2)}`);
      
      if (error) {
        addLog(`❌ ERRO: ${error.message}`, 'error');
        addLog(`Tipo do erro: ${typeof error}`, 'error');
        addLog(`Status: ${error.status || 'N/A'}`, 'error');
        addLog(`Propriedades: ${Object.keys(error).join(', ')}`, 'error');
      } else {
        addLog(`✅ SUCESSO!`, 'success');
        addLog(`User ID: ${data.user?.id}`, 'success');
        addLog(`Email: ${data.user?.email}`, 'success');
        addLog(`Session: ${!!data.session}`, 'success');
      }
      
    } catch (err) {
      addLog(`💥 EXCEÇÃO: ${err instanceof Error ? err.message : 'Erro desconhecido'}`, 'error');
      addLog(`Stack: ${err instanceof Error ? err.stack : 'N/A'}`, 'error');
    } finally {
      setIsLoading(false);
      addLog('🏁 Teste finalizado');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🔍 Teste de Login Direto</h2>
      
      <div className="flex gap-4 mb-4">
        <button
          onClick={testDirectLogin}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
        >
          {isLoading ? '⏳ Testando...' : '🔐 Testar Login'}
        </button>
        
        <button
          onClick={clearLogs}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          🧹 Limpar Logs
        </button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">📝 Logs:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500">Nenhum log ainda. Clique em "Testar Login" para começar.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`text-sm font-mono ${
                  log.includes('ERROR') ? 'text-red-600' :
                  log.includes('SUCCESS') ? 'text-green-600' :
                  'text-gray-700'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};