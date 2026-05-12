-- supabase/migrations/20260422140000_unit06_categories_parent_id.sql
-- Unit 6 Task 5: adicionar parent_id a categories + check de profundidade máxima 1

set local search_path = public;

-- Adicionar parent_id como FK auto-referencial
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

-- Garantir que is_system existe (Unit 2 Phase 4 devia tê-lo adicionado; defensivo)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Índice para hierarquia
CREATE INDEX IF NOT EXISTS idx_categories_parent_id
  ON public.categories(parent_id)
  WHERE parent_id IS NOT NULL;

-- Índice parcial para categorias de sistema
CREATE INDEX IF NOT EXISTS idx_categories_is_system
  ON public.categories(is_system)
  WHERE is_system = true;

-- Trigger: impedir profundidade > 1 (pai não pode ter pai)
CREATE OR REPLACE FUNCTION public.check_category_depth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grandparent_id uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se o pai tem pai (profundidade > 1 não permitida)
  SELECT parent_id INTO v_grandparent_id
  FROM public.categories
  WHERE id = NEW.parent_id;

  IF v_grandparent_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Hierarquia de categorias limitada a 1 nível. A categoria pai (%) já tem um pai.',
      NEW.parent_id;
  END IF;

  -- Evitar auto-referência
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Uma categoria não pode ser pai de si própria.';
  END IF;

  RETURN NEW;
END;$$;

CREATE TRIGGER trg_check_category_depth
  BEFORE INSERT OR UPDATE OF parent_id ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.check_category_depth();

-- Marcar categorias de sistema existentes (padrão anterior: user_id IS NULL AND family_id IS NULL)
UPDATE public.categories
SET is_system = true
WHERE user_id IS NULL
  AND family_id IS NULL
  AND is_system = false;
