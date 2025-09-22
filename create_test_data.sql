-- Script para criar dados de teste para testar a alocação de objetivos
-- Este script cria um utilizador de teste, conta, categoria e objetivo

-- 1. Criar utilizador de teste na tabela profiles
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'teste@exemplo.com',
  '$2a$10$dummy.hash.for.testing.purposes.only',
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Utilizador Teste"}',
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 2. Criar perfil do utilizador
INSERT INTO public.profiles (
  id,
  username,
  full_name,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'teste',
  'Utilizador Teste',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Criar categoria padrão
INSERT INTO public.categories (
  id,
  nome,
  cor,
  user_id,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Geral',
  '#3B82F6',
  '00000000-0000-0000-0000-000000000001'::uuid,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Criar conta de teste
INSERT INTO public.accounts (
  id,
  nome,
  tipo,
  saldo,
  user_id,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  'Conta Principal',
  'corrente',
  1000.00,
  '00000000-0000-0000-0000-000000000001'::uuid,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 5. Criar objetivo de teste
INSERT INTO public.goals (
  id,
  nome,
  valor_objetivo,
  valor_atual,
  valor_meta,
  prazo,
  user_id,
  ativa,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  'Férias de Verão',
  2000.00,
  0.00,
  2000.00,
  '2024-12-31',
  '00000000-0000-0000-0000-000000000001'::uuid,
  true,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 6. Verificar dados criados
SELECT 'Dados de teste criados:' as status;
SELECT 'Utilizador:' as tipo, full_name as nome FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
SELECT 'Categoria:' as tipo, nome FROM public.categories WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT 'Conta:' as tipo, nome, saldo FROM public.accounts WHERE id = '00000000-0000-0000-0000-000000000003';
SELECT 'Objetivo:' as tipo, nome, valor_objetivo FROM public.goals WHERE id = '00000000-0000-0000-0000-000000000004';