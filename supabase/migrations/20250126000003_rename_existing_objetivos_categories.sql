-- Renomear categorias "Objetivos" existentes para os novos nomes
-- Esta migração atualiza as categorias existentes para usar os novos nomes consistentes

-- Renomear categorias "Objetivos" pessoais (family_id IS NULL) para "Objetivos Pessoais"
UPDATE categories 
SET nome = 'Objetivos Pessoais'
WHERE nome = 'Objetivos' 
AND family_id IS NULL;

-- Renomear categorias "Objetivos" familiares (family_id IS NOT NULL) para "Objetivos Familiares"
UPDATE categories 
SET nome = 'Objetivos Familiares'
WHERE nome = 'Objetivos' 
AND family_id IS NOT NULL;

-- Comentário sobre a migração
COMMENT ON TABLE categories IS 'Tabela de categorias - migração aplicada para renomear categorias "Objetivos" para nomes específicos';