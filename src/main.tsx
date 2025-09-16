import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// Registo do Service Worker (Vite PWA)
import { registerSW } from 'virtual:pwa-register';
import { logger } from './shared/lib/logger';

const isDev = import.meta.env.DEV;

// Em produção, regista o SW; em desenvolvimento, garante que não há SW ativos e limpa caches
if (!isDev) {
  try {
    registerSW({ immediate: true });
  } catch {}
} else if ('serviceWorker' in navigator) {
  (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(k => /(workbox|vite-pwa|supabase)/i.test(k))
            .map(k => caches.delete(k))
        );
      }
      // Limpar apenas tokens expirados/inválidos do Supabase, preservando sessões válidas
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i) ?? '';
          // Preservar tokens de sessão válidos, remover apenas caches e tokens temporários
          if (/^(sb-.*-auth-token-code-verifier|sb-.*-auth-token-pkce|workbox|vite-pwa)/i.test(k)) {
            toDelete.push(k);
          }
          // Verificar se é um token de sessão expirado
          if (/^sb-.*-auth-token$/i.test(k)) {
            try {
              const tokenData = localStorage.getItem(k);
              if (tokenData) {
                const parsed = JSON.parse(tokenData);
                const expiresAt = parsed?.expires_at;
                if (expiresAt && new Date(expiresAt * 1000) < new Date()) {
                  toDelete.push(k);
                }
              }
            } catch {
              // Se não conseguir parsear, remove por segurança
              toDelete.push(k);
            }
          }
        }
        toDelete.forEach(k => localStorage.removeItem(k));
        if (toDelete.length > 0) {
          logger.info(`[dev] Removidos ${toDelete.length} tokens/caches expirados:`, toDelete);
        }
      } catch (e) {
        logger.warn('[dev] Erro ao limpar tokens expirados:', e);
      }

      logger.info('[dev] Service workers desativados, caches e tokens Supabase limpos.');
    } catch (e) {
      logger.warn('[dev] Falha ao desativar service workers ou limpar caches:', e);
    }
  })();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
