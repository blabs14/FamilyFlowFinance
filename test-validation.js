import { z } from 'zod';

// Recriar o schema de validação para testar
const emailValidation = z
  .string()
  .min(1, 'Email é obrigatório')
  .email('Formato de email inválido')
  .max(254, 'Email demasiado longo')
  .refine(
    (email) => {
      // Verificar se não tem espaços
      return !email.includes(' ');
    },
    { message: 'Email não pode conter espaços' }
  )
  .refine(
    (email) => {
      // Verificar domínio básico
      const domain = email.split('@')[1];
      return domain && domain.includes('.');
    },
    { message: 'Domínio de email inválido' }
  );

const loginSchema = z.object({
  email: emailValidation,
  password: z.string().min(1, 'Password é obrigatória'),
});

// Testar as credenciais do utilizador
const testCredentials = {
  email: 'testetotal@exemplo.com',
  password: 'teste14'
};

console.log('🔍 Testando validação das credenciais...');
console.log('📧 Email:', testCredentials.email);
console.log('🔑 Password:', testCredentials.password);

try {
  const result = loginSchema.safeParse(testCredentials);
  
  if (result.success) {
    console.log('✅ Validação bem-sucedida!');
    console.log('📊 Dados validados:', result.data);
  } else {
    console.log('❌ Erro na validação:');
    result.error.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. Campo: ${issue.path.join('.')}`);
      console.log(`     Mensagem: ${issue.message}`);
      console.log(`     Valor: ${issue.input || 'N/A'}`);
    });
  }
} catch (error) {
  console.error('💥 Erro inesperado:', error);
}

// Testar também a validação individual do email
console.log('\n🔍 Testando validação individual do email...');
try {
  const emailResult = emailValidation.safeParse(testCredentials.email);
  
  if (emailResult.success) {
    console.log('✅ Email válido!');
  } else {
    console.log('❌ Email inválido:');
    emailResult.error.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. Mensagem: ${issue.message}`);
    });
  }
} catch (error) {
  console.error('💥 Erro inesperado na validação do email:', error);
}