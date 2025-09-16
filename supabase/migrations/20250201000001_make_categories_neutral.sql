-- Make categories neutral by removing default type
-- Categories should be neutral and only get a type when used in specific functionality

-- 1. Remove the default value for the 'tipo' column
ALTER TABLE public.categories 
ALTER COLUMN tipo DROP DEFAULT;

-- 2. Update all existing default categories to have NULL tipo (neutral)
UPDATE public.categories 
SET tipo = NULL 
WHERE user_id IS NULL;

-- 3. Add a comment to document the neutral category approach
COMMENT ON COLUMN public.categories.tipo IS 'Category type (receita/despesa). NULL means neutral - type is determined by usage context.';