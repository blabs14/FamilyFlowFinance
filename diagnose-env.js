// Diagnóstico completo do ambiente Supabase
// Para usar no console do navegador (F12)

// Variáveis do Supabase (obtidas do .env.local)
const SUPABASE_URL = 'https://ebitcwrrcumsvqjgrapw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaXRjd3JyY3Vtc3ZxamdyYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjcyMTYsImV4cCI6MjA2ODM0MzIxNn0.hLlTeSD2VzVCjvUSXLYQypXNYqthDx0q1N86aOftfEY';

function diagnoseEnvironment() {
  console.log('🔍 [Diagnose] Iniciando diagnóstico do ambiente...');
  console.log('=' .repeat(50));
  
  // 1. Verificar variáveis de ambiente
  console.log('📋 [Env] Verificando variáveis de ambiente...');
  
  // Tentar obter do import.meta.env (se disponível)
  let envUrl, envKey;
  try {
    // Note: import.meta is only available in ES modules, not in regular scripts
    if (typeof window !== 'undefined' && window.import && window.import.meta && window.import.meta.env) {
      envUrl = window.import.meta.env.VITE_SUPABASE_URL;
      envKey = window.import.meta.env.VITE_SUPABASE_ANON_KEY;
      console.log('✅ [Env] import.meta.env disponível');
    }
  } catch (e) {
    console.log('⚠️ [Env] import.meta.env não disponível:', e.message);
  }
  
  // Usar valores hardcoded como fallback
  const finalUrl = envUrl || SUPABASE_URL;
  const finalKey = envKey || SUPABASE_ANON_KEY;
  
  console.log('🌐 [Env] URL:', finalUrl);
  console.log('🔑 [Env] Key:', finalKey ? finalKey.substring(0, 20) + '...' : 'NÃO DEFINIDA');
  
  // 2. Verificar se estamos numa aplicação React
  console.log('\n⚛️ [React] Verificando contexto React...');
  if (typeof window !== 'undefined') {
    console.log('✅ [React] Window disponível');
    
    // Verificar se React está carregado
    if (window.React) {
      console.log('✅ [React] React encontrado:', window.React.version || 'versão desconhecida');
    } else {
      console.log('⚠️ [React] React não encontrado globalmente');
    }
    
    // Verificar elementos React na página
    const reactElements = document.querySelectorAll('[data-reactroot], [data-react-helmet]');
    console.log('📊 [React] Elementos React encontrados:', reactElements.length);
  }
  
  // 3. Verificar localStorage
  console.log('\n💾 [Storage] Verificando localStorage...');
  try {
    const keys = Object.keys(localStorage);
    console.log('📋 [Storage] Chaves encontradas:', keys.length);
    
    // Procurar chaves relacionadas com Supabase
    const supabaseKeys = keys.filter(key => key.includes('supabase'));
    console.log('🔑 [Storage] Chaves Supabase:', supabaseKeys);
    
    supabaseKeys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`📄 [Storage] ${key}:`, value ? value.substring(0, 100) + '...' : 'vazio');
    });
  } catch (e) {
    console.error('❌ [Storage] Erro ao aceder localStorage:', e);
  }
  
  // 4. Verificar cookies
  console.log('\n🍪 [Cookies] Verificando cookies...');
  const cookies = document.cookie.split(';');
  console.log('📊 [Cookies] Total de cookies:', cookies.length);
  
  const supabaseCookies = cookies.filter(cookie => cookie.includes('supabase'));
  console.log('🔑 [Cookies] Cookies Supabase:', supabaseCookies.length);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ [Diagnose] Diagnóstico concluído!');
  console.log('💡 [Diagnose] Para testar login, execute: testLogin()');
}

function testLogin() {
  console.log('🔐 [Login] Iniciando teste de login...');
  console.log('=' .repeat(50));
  
  // Verificar se há formulário de login na página
  const emailInput = document.querySelector('input[type="email"], input[name="email"]');
  const passwordInput = document.querySelector('input[type="password"], input[name="password"]');
  const loginButton = document.querySelector('button[type="submit"], button:contains("Entrar")');
  
  console.log('📋 [Login] Elementos encontrados:');
  console.log('📧 [Login] Campo email:', emailInput ? '✅ Encontrado' : '❌ Não encontrado');
  console.log('🔒 [Login] Campo password:', passwordInput ? '✅ Encontrado' : '❌ Não encontrado');
  console.log('🔘 [Login] Botão login:', loginButton ? '✅ Encontrado' : '❌ Não encontrado');
  
  if (emailInput && passwordInput) {
    console.log('\n🧪 [Login] Preenchendo formulário de teste...');
    
    // Preencher campos
    emailInput.value = 'testetotal@teste.com';
    passwordInput.value = 'teste123';
    
    // Disparar eventos
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    console.log('✅ [Login] Campos preenchidos');
    console.log('💡 [Login] Para submeter, execute: submitLogin()');
  } else {
    console.log('❌ [Login] Formulário não encontrado na página atual');
    console.log('💡 [Login] Navegue para a página de login primeiro');
  }
}

function submitLogin() {
  console.log('🚀 [Submit] Submetendo formulário...');
  
  const loginButton = document.querySelector('button[type="submit"]') || 
                     document.querySelector('button:contains("Entrar")');
  
  if (loginButton) {
    console.log('🔘 [Submit] Clicando no botão...');
    loginButton.click();
    
    // Aguardar e verificar resultado
    setTimeout(() => {
      console.log('🔍 [Submit] Verificando resultado...');
      console.log('📍 [Submit] URL atual:', window.location.href);
      console.log('💾 [Submit] localStorage atualizado:', Object.keys(localStorage).filter(k => k.includes('supabase')));
    }, 2000);
  } else {
    console.log('❌ [Submit] Botão de submit não encontrado');
  }
}

function clearSupabaseSession() {
  console.log('🧹 [Clear] Limpando sessão Supabase...');
  
  // Limpar localStorage
  const keys = Object.keys(localStorage);
  const supabaseKeys = keys.filter(key => key.includes('supabase'));
  
  supabaseKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log('🗑️ [Clear] Removido:', key);
  });
  
  // Limpar cookies (se possível)
  document.cookie.split(';').forEach(cookie => {
    if (cookie.includes('supabase')) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      console.log('🍪 [Clear] Cookie removido:', name);
    }
  });
  
  console.log('✅ [Clear] Sessão limpa!');
  console.log('🔄 [Clear] Recarregue a página para aplicar as alterações');
}

// Função para verificar estado atual
function checkCurrentState() {
  console.log('📊 [State] Estado atual da aplicação:');
  console.log('=' .repeat(50));
  
  console.log('📍 [State] URL:', window.location.href);
  console.log('👤 [State] Utilizador logado:', localStorage.getItem('supabase.auth.token') ? 'Sim' : 'Não');
  
  // Verificar elementos de erro na página
  const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], .text-red-500, .text-danger');
  console.log('❌ [State] Elementos de erro:', errorElements.length);
  
  errorElements.forEach((el, index) => {
    console.log(`🔍 [State] Erro ${index + 1}:`, el.textContent.trim());
  });
  
  // Verificar elementos de loading
  const loadingElements = document.querySelectorAll('[class*="loading"], [class*="Loading"], [class*="spinner"]');
  console.log('⏳ [State] Elementos de loading:', loadingElements.length);
  
  console.log('\n💡 [State] Comandos disponíveis:');
  console.log('   - diagnoseEnvironment() - Diagnóstico completo');
  console.log('   - testLogin() - Testar preenchimento de login');
  console.log('   - submitLogin() - Submeter formulário');
  console.log('   - clearSupabaseSession() - Limpar sessão');
  console.log('   - checkCurrentState() - Verificar estado atual');
}

// Função para testar conectividade direta com Supabase
async function testSupabaseConnectivity() {
  console.log('🌐 [Connectivity] Testando conectividade com Supabase...');
  console.log('=' .repeat(50));
  
  try {
    // Teste 1: Verificar se o endpoint está acessível
    console.log('🔍 [Connectivity] Testando endpoint REST...');
    const restResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log('📊 [Connectivity] REST API Status:', restResponse.status);
    console.log('✅ [Connectivity] REST API:', restResponse.ok ? 'Acessível' : 'Erro');
    
    // Teste 2: Verificar endpoint de autenticação
    console.log('\n🔐 [Connectivity] Testando endpoint de autenticação...');
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log('📊 [Connectivity] Auth API Status:', authResponse.status);
    console.log('✅ [Connectivity] Auth API:', authResponse.ok ? 'Acessível' : 'Erro');
    
    if (authResponse.ok) {
      const authSettings = await authResponse.json();
      console.log('⚙️ [Connectivity] Auth Settings:', authSettings);
    }
    
    // Teste 3: Tentar login direto via API
    console.log('\n🧪 [Connectivity] Testando login direto via API...');
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'testetotal@teste.com',
        password: 'teste14'
      })
    });
    
    console.log('📊 [Connectivity] Login Status:', loginResponse.status);
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ [Connectivity] Login bem-sucedido!');
      console.log('👤 [Connectivity] Utilizador:', loginData.user?.email);
      console.log('🎫 [Connectivity] Token recebido:', loginData.access_token ? 'Sim' : 'Não');
    } else {
      const errorData = await loginResponse.json();
      console.log('❌ [Connectivity] Erro no login:', errorData);
    }
    
  } catch (error) {
    console.error('💥 [Connectivity] Erro crítico:', error);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ [Connectivity] Teste de conectividade concluído!');
}

// Função para testar com biblioteca Supabase carregada dinamicamente
function testWithSupabaseLibrary() {
  console.log('📚 [Supabase Library] Testando com biblioteca Supabase...');
  console.log('=' .repeat(50));
  
  // Tentar carregar a biblioteca dinamicamente
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  script.onload = async () => {
    console.log('✅ [Supabase Library] Biblioteca carregada');
    
    try {
      const { createClient } = window.supabase;
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      console.log('🔧 [Supabase Library] Cliente criado:', client);
      
      // Testar login
      const { data, error } = await client.auth.signInWithPassword({
        email: 'testetotal@teste.com',
        password: 'teste123'
      });
      
      console.log('📋 [Supabase Library] Resultado login:');
      console.log('✅ Data:', data);
      console.log('❌ Error:', error);
      
    } catch (err) {
      console.error('💥 [Supabase Library] Erro:', err);
    }
  };
  
  script.onerror = () => {
    console.error('❌ [Supabase Library] Erro ao carregar biblioteca');
  };
  
  document.head.appendChild(script);
}

function testReactLogin() {
  console.log('🔍 [React Login] Testando login via React...');
  console.log('=' .repeat(50));
  
  // Verificar se o contexto React está disponível
  const reactFiberKey = Object.keys(document.querySelector('#root') || {}).find(key => key.startsWith('__reactFiber'));
  
  if (reactFiberKey) {
    console.log('✅ [React Login] React detectado');
    
    // Tentar acessar o contexto de autenticação
    try {
      // Simular preenchimento do formulário React
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      
      if (emailInput && passwordInput) {
        console.log('📝 [React Login] Preenchendo formulário React...');
        
        // Simular input do React
        const setNativeValue = (element, value) => {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set ||
                            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
          if (valueSetter) {
            valueSetter.call(element, value);
          }
        };
        
        setNativeValue(emailInput, 'testetotal@teste.com');
        setNativeValue(passwordInput, 'teste123');
        
        // Disparar eventos React
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        console.log('✅ [React Login] Formulário preenchido');
        console.log('💡 [React Login] Para submeter, execute: submitReactLogin()');
      } else {
        console.log('❌ [React Login] Campos de formulário não encontrados');
      }
    } catch (err) {
      console.error('💥 [React Login] Erro:', err);
    }
  } else {
    console.log('❌ [React Login] React não detectado');
  }
}

function submitReactLogin() {
  console.log('🚀 [React Submit] Submetendo formulário React...');
  
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (submitButton) {
    console.log('🔘 [React Submit] Clicando no botão submit...');
    submitButton.click();
    
    // Monitorar mudanças
    setTimeout(() => {
      console.log('🔍 [React Submit] Verificando resultado...');
      console.log('📍 [React Submit] URL atual:', window.location.href);
      console.log('💾 [React Submit] localStorage:', Object.keys(localStorage).filter(k => k.includes('supabase')));
      
      // Verificar se há erros na página
      const errorElements = document.querySelectorAll('[role="alert"], .text-red-600, .text-destructive');
      if (errorElements.length > 0) {
        console.log('❌ [React Submit] Erros encontrados:');
        errorElements.forEach(el => console.log('  -', el.textContent));
      }
    }, 3000);
  } else {
    console.log('❌ [React Submit] Botão submit não encontrado');
  }
}

function debugLoginFlow() {
  console.log('🛠️ [Debug Flow] Iniciando debug completo...');
  console.log('=' .repeat(50));
  
  // 1. Verificar ambiente
  console.log('\n1️⃣ [Debug] Verificando ambiente...');
  diagnoseEnvironment();
  
  // 2. Verificar React
  setTimeout(() => {
    console.log('\n2️⃣ [Debug] Verificando React...');
    testReactLogin();
    
    // 3. Verificar conectividade
    setTimeout(() => {
      console.log('\n3️⃣ [Debug] Verificando conectividade...');
      testSupabaseConnectivity();
      
      // 4. Resumo
      setTimeout(() => {
        console.log('\n4️⃣ [Debug] Resumo do diagnóstico:');
        console.log('📊 [Debug] Execute checkCurrentState() para ver o estado atual');
        console.log('🚀 [Debug] Execute submitReactLogin() para testar o login');
      }, 2000);
    }, 2000);
  }, 2000);
}

// Executar diagnóstico inicial
console.log('🔧 [Diagnóstico] Script carregado. Comandos disponíveis:');
console.log('📋 diagnoseEnvironment() - Verificar variáveis e conectividade');
console.log('🔐 testLogin() - Testar formulário de login');
console.log('🚀 submitLogin() - Submeter login preenchido');
console.log('🧹 clearSupabaseSession() - Limpar sessão');
console.log('📊 checkCurrentState() - Verificar estado atual');
console.log('🌐 testSupabaseConnectivity() - Testar conectividade API');
console.log('📚 testWithSupabaseLibrary() - Testar com biblioteca Supabase');
console.log('🔍 testReactLogin() - Testar login via React');
console.log('🛠️ debugLoginFlow() - Debug completo do fluxo de login');
console.log('=' .repeat(60));
console.log('\n🚀 [Diagnose] Execute diagnoseEnvironment() para começar!');