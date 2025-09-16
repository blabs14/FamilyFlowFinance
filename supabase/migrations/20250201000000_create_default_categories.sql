-- Create default categories that are visible to all users
-- These categories have user_id = NULL and family_id = NULL

INSERT INTO public.categories (id, nome, cor, user_id, family_id, created_at)
VALUES 
  -- Categorias de Despesas
  (gen_random_uuid(), 'Alimentação', '#FF6B6B', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Transporte', '#4ECDC4', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Saúde', '#45B7D1', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Educação', '#96CEB4', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Entretenimento', '#FFEAA7', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Compras', '#DDA0DD', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Casa', '#98D8C8', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Serviços', '#F7DC6F', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Seguros', '#BB8FCE', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Impostos', '#F1948A', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Viagens', '#85C1E9', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Vestuário', '#F8C471', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Tecnologia', '#82E0AA', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Presentes', '#F48FB1', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Animais', '#FFAB91', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Beleza', '#CE93D8', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Desporto', '#A5D6A7', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Restaurantes', '#FFCC80', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Combustível', '#90CAF9', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Manutenção', '#BCAAA4', NULL, NULL, NOW()),
  
  -- Categorias de Receitas
  (gen_random_uuid(), 'Salário', '#4CAF50', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Freelance', '#8BC34A', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Investimentos', '#2196F3', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Rendas', '#FF9800', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Vendas', '#9C27B0', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Prémios', '#E91E63', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Reembolsos', '#00BCD4', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Subsídios', '#795548', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Pensões', '#607D8B', NULL, NULL, NOW()),
  (gen_random_uuid(), 'Outros Rendimentos', '#9E9E9E', NULL, NULL, NOW()),
  
  -- Categoria especial para transferências
  (gen_random_uuid(), 'Transferência', '#6C757D', NULL, NULL, NOW())
ON CONFLICT (id) DO NOTHING;