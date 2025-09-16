// Script para testar login no console do navegador
// Cole este código no console do navegador (F12) na página de login

// Função para testar login
async function testLogin() {
  console.log('🧪 [Test] Iniciando teste de login...');
  
  // Obter referências aos elementos do formulário
  const emailInput = document.querySelector('input[type="email"]');
  const passwordInput = document.querySelector('input[type="password"]');
  const submitButton = document.querySelector('button[type="submit"]');
  
  if (!emailInput || !passwordInput || !submitButton) {
    console.error('❌ [Test] Elementos do formulário não encontrados');
    console.log('Email input:', emailInput);
    console.log('Password input:', passwordInput);
    console.log('Submit button:', submitButton);
    return;
  }
  
  console.log('✅ [Test] Elementos do formulário encontrados');
  
  // Preencher os campos
  emailInput.value = 'testetotal@teste.com';
  passwordInput.value = 'teste14';
  
  console.log('📝 [Test] Campos preenchidos:');
  console.log('  Email:', emailInput.value);
  console.log('  Password:', passwordInput.value);
  
  // Disparar eventos de mudança
  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
  emailInput.dispatchEvent(new Event('change', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log('🔄 [Test] Eventos de mudança disparados');
  
  // Aguardar um pouco
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('🖱️ [Test] Clicando no botão de submit...');
  
  // Clicar no botão
  submitButton.click();
  
  console.log('⏳ [Test] Aguardando resposta...');
}

// Função para verificar estado atual
function checkCurrentState() {
  console.log('🔍 [Test] Verificando estado atual...');
  
  // Verificar se há erros visíveis
  const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], .text-red-500, .text-destructive');
  console.log('❌ [Test] Elementos de erro encontrados:', errorElements.length);
  errorElements.forEach((el, i) => {
    console.log(`  Erro ${i + 1}:`, el.textContent?.trim());
  });
  
  // Verificar loading states
  const loadingElements = document.querySelectorAll('[class*="loading"], [class*="Loading"], [disabled]');
  console.log('⏳ [Test] Elementos em loading:', loadingElements.length);
  
  // Verificar URL atual
  console.log('🌐 [Test] URL atual:', window.location.href);
  
  // Verificar localStorage
  const supabaseKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && /supabase/i.test(key)) {
      supabaseKeys.push(key);
    }
  }
  console.log('💾 [Test] Chaves Supabase no localStorage:', supabaseKeys);
}

// Função para limpar sessão
function clearSupabaseSession() {
  console.log('🧹 [Test] Limpando sessão Supabase...');
  
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && /supabase/i.test(key)) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`  Removido: ${key}`);
  });
  
  console.log('✅ [Test] Sessão limpa. Recarregue a página.');
}

console.log('🚀 [Test] Script de teste carregado!');
console.log('📋 [Test] Comandos disponíveis:');
console.log('  - testLogin() - Testa o login automaticamente');
console.log('  - checkCurrentState() - Verifica estado atual');
console.log('  - clearSupabaseSession() - Limpa sessão Supabase');
console.log('');
console.log('💡 [Test] Para começar, execute: checkCurrentState()');