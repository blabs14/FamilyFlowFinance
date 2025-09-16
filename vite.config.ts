import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import { componentTagger } from "lovable-tagger"; // Removido para resolver vulnerabilidades
import { VitePWA } from "vite-plugin-pwa";
import visualizer from 'vite-bundle-visualizer';

// Função removida - componentTagger desabilitado para resolver vulnerabilidades

/// <reference types="vitest" />

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const supabaseUrl = env.VITE_SUPABASE_URL || "";
  const isDev = mode === "development";

  let supabasePattern = /^https:\/\/.*supabase\.co\/.*$/i;
  try {
    if (supabaseUrl) {
      const host = new URL(supabaseUrl).host.replace(/\./g, "\\.");
      supabasePattern = new RegExp(`^https://${host}/.*`, "i");
    }
  } catch {
    // fallback mantém o padrão genérico *.supabase.co
  }

  // Base dinâmica para suportar GitHub Pages (ex.: /repo/) ou domínio próprio ("/")
  const viteBase = env.VITE_BASE_PATH && env.VITE_BASE_PATH.trim() !== ""
    ? env.VITE_BASE_PATH
    : "/";

  return {
    base: viteBase,
    server: {
      host: "::",
      port: 8080,
      open: true,
    },
    plugins: [
      react(),
      // mode === "development" && createSafeComponentTagger(), // Desabilitado para resolver vulnerabilidades
      VitePWA({
        registerType: "autoUpdate",
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        devOptions: {
          enabled: !isDev && true, // desativa SW no dev para evitar cache entre portas
          suppressWarnings: true,
          type: 'module',
        },
        manifest: {
          name: "Family Flow Finance",
          short_name: "PortaLinda",
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#2563eb",
          icons: [
            { src: "/favicon.ico", sizes: "64x64 32x32 24x24 16x16", type: "image/x-icon" },
          ],
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: supabasePattern,
              handler: "NetworkFirst",
              method: "GET",
              options: { cacheName: "supabase-calls" },
            },
          ],
        },
      }),
      // Visualizador de bundle (ativar com VISUALIZE=1)
      process.env.VISUALIZE === '1' && ((visualizer as any)({ template: 'treemap' }) as any),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Bibliotecas grandes que devem ser separadas
            if (id.includes('/node_modules/exceljs')) return 'exceljs';
            if (id.includes('/node_modules/recharts')) return 'charts';
            if (id.includes('/node_modules/jspdf')) return 'pdf';
            if (id.includes('/node_modules/xlsx')) return 'excel';
            if (id.includes('/node_modules/html2canvas')) return 'html2canvas';

            // Dividir vendor em subgrupos
            if (id.includes('/node_modules/@tanstack/react-query')) return 'react-query';
            if (id.includes('/node_modules/@supabase/')) return 'supabase';
            
            // Dividir lucide-react em chunks menores por categoria
            if (id.includes('/node_modules/lucide-react')) {
              // Separar ícones por funcionalidade para reduzir tamanho
              if (id.includes('chart') || id.includes('bar') || id.includes('pie') || id.includes('trending')) return 'icons-charts';
              if (id.includes('wallet') || id.includes('credit') || id.includes('dollar') || id.includes('piggy')) return 'icons-finance';
              if (id.includes('user') || id.includes('settings') || id.includes('gear') || id.includes('cog')) return 'icons-ui';
              return 'icons-core';
            }
            
            if (id.includes('/node_modules/react-router-dom') || id.includes('/node_modules/react-router')) return 'router';
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';

            if (id.includes('/src/pages/reports.tsx') || id.includes('/src/components/ReportExport.tsx') || id.includes('/src/components/ReportChart.tsx')) return 'reports';
            
            // Payroll: dividir em chunks menores
            if (id.includes('/src/features/payroll/')) {
              if (id.includes('PayrollModule.tsx') || id.includes('PayrollNavigation')) return 'payroll-core';
              if (id.includes('PayrollConfig') || id.includes('PayrollContract') || id.includes('PayrollSetup')) return 'payroll-config';
              if (id.includes('PayrollBonus') || id.includes('PayrollMileage') || id.includes('PayrollSubsidies')) return 'payroll-benefits';
              if (id.includes('PayrollVacation') || id.includes('PayrollLeaves') || id.includes('PayrollTimesheet')) return 'payroll-time';
              return 'payroll-misc';
            }
            
            // Family: chunks por sub-rotas
            if (id.includes('/src/pages/Family.tsx')) return 'family-shell';
            if (id.includes('/src/features/family/FamilyDashboard.tsx')) return 'family-dashboard';
            if (id.includes('/src/features/family/FamilyAccounts.tsx')) return 'family-accounts';
            if (id.includes('/src/features/family/FamilyTransactions.tsx')) return 'family-transactions';
            if (id.includes('/src/features/family/FamilyGoals.tsx')) return 'family-goals';
            if (id.includes('/src/features/family/FamilyBudgets.tsx')) return 'family-budgets';
            if (id.includes('/src/features/family/FamilyMembers.tsx')) return 'family-members';
            if (id.includes('/src/features/family/FamilySettings.tsx')) return 'family-settings';
            if (id.includes('/src/features/personal/') || id.includes('/src/pages/Personal')) return 'personal';
            if (id.includes('/src/pages/Insights.tsx')) return 'insights';
            if (id.includes('/src/features/personal/PersonalSettings')) return 'settings';
          },
        },
      },
      // Hints simples de budget (não falham o build): logar quando chunks excedem valores alvo
      chunkSizeWarningLimit: 700, // ~700KB por chunk (antes de gzip)
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/setupTests.ts"],
      css: true,
      reporters: ["verbose"],
      coverage: {
        reporter: ["text", "json", "html"],
        exclude: ["node_modules/", "src/setupTests.ts"],
      },
      env: loadEnv(mode, process.cwd(), ''),
    },
  };
});
