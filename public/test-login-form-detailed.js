// Script de teste detalhado para o formulário de login React
console.log('🔍 [Test] Iniciando teste detalhado do formulário de login...');

// Função para aguardar elemento aparecer
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
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

// Função para testar estrutura da página
function testPageStructure() {
    console.log('\n📋 [Test] Verificando estrutura da página...');
    
    const results = {
        root: !!document.querySelector('#root'),
        card: !!document.querySelector('[class*="card"]'),
        form: !!document.querySelector('form'),
        emailInput: !!document.querySelector('input[type="email"]'),
        passwordInput: !!document.querySelector('input[type="password"]'),
        submitButton: !!document.querySelector('button[type="submit"]'),
        loginForm: !!document.querySelector('form'),
        reactComponents: !!document.querySelector('[data-reactroot], [data-react-helmet]')
    };
    
    console.log('🔍 Estrutura encontrada:');
    Object.entries(results).forEach(([key, found]) => {
        console.log(`  ${found ? '✅' : '❌'} ${key}: ${found}`);
    });
    
    return results;
}

// Função para testar elementos específicos do formulário
function testFormElements() {
    console.log('\n🎯 [Test] Verificando elementos específicos do formulário...');
    
    const form = document.querySelector('form');
    if (!form) {
        console.log('❌ Formulário não encontrado');
        return { success: false, error: 'Formulário não encontrado' };
    }
    
    console.log('✅ Formulário encontrado');
    console.log('📝 Atributos do formulário:', {
        id: form.id,
        className: form.className,
        method: form.method,
        action: form.action
    });
    
    const inputs = form.querySelectorAll('input');
    const buttons = form.querySelectorAll('button');
    
    console.log(`📊 Inputs encontrados: ${inputs.length}`);
    inputs.forEach((input, index) => {
        console.log(`  Input ${index + 1}:`, {
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
        });
    });
    
    console.log(`🔘 Botões encontrados: ${buttons.length}`);
    buttons.forEach((button, index) => {
        console.log(`  Botão ${index + 1}:`, {
            type: button.type,
            textContent: button.textContent.trim(),
            disabled: button.disabled
        });
    });
    
    const emailInput = form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[type="password"]');
    const submitButton = form.querySelector('button[type="submit"]');
    
    const success = !!(emailInput && passwordInput && submitButton);
    
    return {
        success,
        form,
        emailInput,
        passwordInput,
        submitButton,
        inputCount: inputs.length,
        buttonCount: buttons.length
    };
}

// Função para testar React DevTools
function testReactDevTools() {
    console.log('\n⚛️ [Test] Verificando React...');
    
    const results = {
        reactInternals: !!(window.React || document.querySelector('[data-reactroot]')),
        reactDevTools: !!(window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
        reactFiber: !!document.querySelector('#root')?._reactInternalFiber
    };
    
    console.log('🔍 React detectado:', results);
    return results;
}

// Função para testar interação com o formulário
async function testFormInteraction() {
    console.log('\n🎮 [Test] Testando interação com formulário...');
    
    try {
        const formData = testFormElements();
        if (!formData.success) {
            return { success: false, error: 'Formulário não encontrado para teste de interação' };
        }
        
        const { emailInput, passwordInput, submitButton } = formData;
        
        // Testar preenchimento dos campos
        console.log('📝 Testando preenchimento dos campos...');
        
        if (emailInput) {
            emailInput.focus();
            emailInput.value = 'teste@exemplo.com';
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Campo email preenchido');
        }
        
        if (passwordInput) {
            passwordInput.focus();
            passwordInput.value = 'senha123';
            passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
            passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Campo password preenchido');
        }
        
        // Verificar se o botão está habilitado
        console.log('🔘 Estado do botão submit:', {
            disabled: submitButton?.disabled,
            textContent: submitButton?.textContent?.trim()
        });
        
        return {
            success: true,
            emailFilled: !!emailInput?.value,
            passwordFilled: !!passwordInput?.value,
            buttonEnabled: !submitButton?.disabled
        };
        
    } catch (error) {
        console.error('❌ Erro no teste de interação:', error);
        return { success: false, error: error.message };
    }
}

// Função principal de teste
async function runCompleteTest() {
    console.log('🚀 [Test] Iniciando teste completo do formulário de login...');
    
    try {
        const results = {
            pageStructure: testPageStructure(),
            reactDevTools: testReactDevTools(),
            formElements: testFormElements(),
            formInteraction: await testFormInteraction()
        };
        
        console.log('\n📊 [Test] RESUMO DOS RESULTADOS:');
        console.log('='.repeat(50));
        
        console.log('📋 Estrutura da página:', results.pageStructure.form ? '✅' : '❌');
        console.log('⚛️ React detectado:', results.reactDevTools.reactInternals ? '✅' : '❌');
        console.log('🎯 Elementos do formulário:', results.formElements.success ? '✅' : '❌');
        console.log('🎮 Interação funcional:', results.formInteraction.success ? '✅' : '❌');
        
        if (!results.formElements.success) {
            console.log('\n🚨 PROBLEMA IDENTIFICADO: Formulário não encontrado ou mal formado');
            console.log('💡 Possíveis causas:');
            console.log('  - Componente LoginForm não está a ser renderizado');
            console.log('  - Erro no contexto de autenticação');
            console.log('  - Problema no roteamento React');
            console.log('  - Erro de JavaScript a impedir renderização');
        }
        
        return results;
    } catch (error) {
        console.error('❌ Erro no teste completo:', error);
        return { error: error.message };
    }
}

// Exportar funções para uso no console
window.testPageStructure = testPageStructure;
window.testFormElements = testFormElements;
window.testReactDevTools = testReactDevTools;
window.testFormInteraction = testFormInteraction;
window.runCompleteTest = runCompleteTest;
window.waitForElement = waitForElement;

console.log('✅ [Test] Script carregado! Funções disponíveis:');
console.log('- testPageStructure() - Verifica estrutura da página');
console.log('- testFormElements() - Verifica elementos do formulário');
console.log('- testReactDevTools() - Verifica React');
console.log('- testFormInteraction() - Testa interação');
console.log('- runCompleteTest() - Executa todos os testes');
console.log('\n🚀 Execute: runCompleteTest()');