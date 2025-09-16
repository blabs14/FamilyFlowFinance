// Script para testar o formulário React de login
// Execute no console da página http://localhost:8082/login

console.log('🔍 Iniciando teste do formulário React...');

// Função para aguardar elemento aparecer
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Elemento ${selector} não encontrado em ${timeout}ms`));
        }, timeout);
    });
}

// Função principal de teste
async function testReactLoginForm() {
    console.log('📋 Procurando formulário de login...');
    
    try {
        // Aguardar o formulário aparecer
        const form = await waitForElement('form', 3000);
        console.log('✅ Formulário encontrado:', form);
        
        // Verificar campos
        const emailField = form.querySelector('input[type="email"]');
        const passwordField = form.querySelector('input[type="password"]');
        const submitButton = form.querySelector('button[type="submit"]');
        
        console.log('📧 Campo email:', emailField);
        console.log('🔒 Campo password:', passwordField);
        console.log('🔘 Botão submit:', submitButton);
        
        if (!emailField || !passwordField || !submitButton) {
            throw new Error('Campos obrigatórios não encontrados');
        }
        
        // Preencher formulário com credenciais de teste
        console.log('✏️ Preenchendo formulário...');
        emailField.value = 'testetotal@teste.com';
        passwordField.value = 'teste14';
        
        // Disparar eventos de input para React
        emailField.dispatchEvent(new Event('input', { bubbles: true }));
        passwordField.dispatchEvent(new Event('input', { bubbles: true }));
        emailField.dispatchEvent(new Event('change', { bubbles: true }));
        passwordField.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log('📝 Formulário preenchido');
        console.log('Email:', emailField.value);
        console.log('Password:', passwordField.value.replace(/./g, '*'));
        
        // Verificar se há erros de validação
        const errorElements = form.querySelectorAll('[role="alert"], .error, .text-red-500, .text-destructive');
        if (errorElements.length > 0) {
            console.log('⚠️ Erros de validação encontrados:', errorElements);
            errorElements.forEach((el, i) => {
                console.log(`Erro ${i + 1}:`, el.textContent);
            });
        }
        
        // Verificar estado do botão
        const isDisabled = submitButton.disabled;
        console.log('🔘 Botão habilitado:', !isDisabled);
        
        if (isDisabled) {
            console.log('❌ Botão está desabilitado. Possíveis causas:');
            console.log('- Validação falhou');
            console.log('- Loading state ativo');
            console.log('- Campos obrigatórios não preenchidos');
        }
        
        return {
            success: true,
            form,
            emailField,
            passwordField,
            submitButton,
            isDisabled,
            errors: Array.from(errorElements).map(el => el.textContent)
        };
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Função para submeter o formulário
async function submitReactForm() {
    console.log('🚀 Tentando submeter formulário...');
    
    try {
        const testResult = await testReactLoginForm();
        
        if (!testResult.success) {
            throw new Error(testResult.error);
        }
        
        const { submitButton, isDisabled } = testResult;
        
        if (isDisabled) {
            throw new Error('Botão está desabilitado');
        }
        
        // Interceptar console.log para capturar logs do AuthContext
        const originalLog = console.log;
        const logs = [];
        console.log = (...args) => {
            logs.push(args.join(' '));
            originalLog(...args);
        };
        
        // Interceptar console.error para capturar erros
        const originalError = console.error;
        const errors = [];
        console.error = (...args) => {
            errors.push(args.join(' '));
            originalError(...args);
        };
        
        // Submeter formulário
        console.log('📤 Clicando no botão submit...');
        submitButton.click();
        
        // Aguardar um pouco para capturar logs
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Restaurar console
        console.log = originalLog;
        console.error = originalError;
        
        console.log('📊 Logs capturados:', logs);
        console.log('🚨 Erros capturados:', errors);
        
        // Verificar se houve redirecionamento
        const currentUrl = window.location.href;
        console.log('🌐 URL atual:', currentUrl);
        
        return {
            success: true,
            logs,
            errors,
            currentUrl
        };
        
    } catch (error) {
        console.error('❌ Erro na submissão:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Função para debug completo
async function debugCompleteFlow() {
    console.log('🔍 Iniciando debug completo do fluxo de login...');
    
    // 1. Testar formulário
    console.log('\n1️⃣ Testando formulário...');
    const formTest = await testReactLoginForm();
    
    if (!formTest.success) {
        console.log('❌ Teste do formulário falhou:', formTest.error);
        return;
    }
    
    console.log('✅ Formulário OK');
    
    // 2. Verificar contexto de autenticação
    console.log('\n2️⃣ Verificando contexto de autenticação...');
    
    // Tentar acessar o contexto React (se disponível)
    const reactFiber = document.querySelector('#root')?._reactInternalFiber ||
                      document.querySelector('#root')?._reactInternals;
    
    if (reactFiber) {
        console.log('⚛️ React Fiber encontrado');
    } else {
        console.log('⚠️ React Fiber não encontrado');
    }
    
    // 3. Submeter formulário
    console.log('\n3️⃣ Submetendo formulário...');
    const submitResult = await submitReactForm();
    
    console.log('\n📋 RESUMO DO DEBUG:');
    console.log('Formulário:', formTest.success ? '✅' : '❌');
    console.log('Submissão:', submitResult.success ? '✅' : '❌');
    
    if (submitResult.errors && submitResult.errors.length > 0) {
        console.log('🚨 Erros encontrados:');
        submitResult.errors.forEach((error, i) => {
            console.log(`${i + 1}. ${error}`);
        });
    }
    
    return {
        formTest,
        submitResult
    };
}

// Exportar funções para uso no console
window.testReactLoginForm = testReactLoginForm;
window.submitReactForm = submitReactForm;
window.debugCompleteFlow = debugCompleteFlow;

console.log('✅ Script carregado! Funções disponíveis:');
console.log('- testReactLoginForm() - Testa o formulário');
console.log('- submitReactForm() - Submete o formulário');
console.log('- debugCompleteFlow() - Debug completo');
console.log('\n🚀 Execute: debugCompleteFlow()');