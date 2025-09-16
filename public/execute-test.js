// Script para executar o teste do formulário de login
console.log('🔄 Carregando script de teste...');

// Carregar o script de teste detalhado
const script = document.createElement('script');
script.src = '/test-login-form-detailed.js';
script.onload = function() {
    console.log('✅ Script carregado com sucesso!');
    
    // Aguardar um pouco para garantir que tudo está carregado
    setTimeout(() => {
        console.log('🚀 Executando teste completo...');
        if (window.runCompleteTest) {
            window.runCompleteTest().then(results => {
                console.log('📊 Resultados do teste:', results);
            }).catch(error => {
                console.error('❌ Erro no teste:', error);
            });
        } else {
            console.error('❌ Função runCompleteTest não encontrada');
        }
    }, 1000);
};
script.onerror = function() {
    console.error('❌ Erro ao carregar script de teste');
};
document.head.appendChild(script);