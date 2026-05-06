-- supabase/migrations/20260423110000_unit08_budget_instances.sql
-- Unit 8 Task 2: criar budget_instances + recriar budget_progress view

set local search_path = public;

BEGIN;

CREATE TABLE IF NOT EXISTS public.budget_instances (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id          uuid        NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  period_key         text        NOT NULL,  -- 'YYYY-MM' para monthly, 'YYYY' para annual
  period_start       date        NOT NULL,
  period_end         date        NOT NULL,
  budget_cents       bigint      NOT NULL CHECK (budget_cents > 0),
  spent_cents        bigint      NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
  carried_over_cents bigint      NOT NULL DEFAULT 0,
  status             text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'closed', 'rolled_over')),
  currency           text        NOT NULL DEFAULT 'EUR',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_instance UNIQUE (budget_id, period_key)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bi_budget_id    ON public.budget_instances(budget_id);
CREATE INDEX IF NOT EXISTS idx_bi_period_key   ON public.budget_instances(period_key);
CREATE INDEX IF NOT EXISTS idx_bi_status       ON public.budget_instances(status);
CREATE INDEX IF NOT EXISTS idx_bi_period_start ON public.budget_instances(period_start);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

DROP TRIGGER IF EXISTS trg_bi_updated_at ON public.budget_instances;
CREATE TRIGGER trg_bi_updated_at
  BEFORE UPDATE ON public.budget_instances
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- RLS
ALTER TABLE public.budget_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bi_select ON public.budget_instances;
CREATE POLICY bi_select ON public.budget_instances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = b.family_id AND fm.user_id = auth.uid()
          ))
        )
    )
  );

DROP POLICY IF EXISTS bi_insert ON public.budget_instances;
CREATE POLICY bi_insert ON public.budget_instances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND public.is_family_non_viewer(b.family_id))
        )
    )
  );

DROP POLICY IF EXISTS bi_update ON public.budget_instances;
CREATE POLICY bi_update ON public.budget_instances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND public.is_family_non_viewer(b.family_id))
        )
    )
  );

DROP POLICY IF EXISTS bi_delete ON public.budget_instances;
CREATE POLICY bi_delete ON public.budget_instances
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND public.is_family_non_viewer(b.family_id))
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_instances TO authenticated;

-- Materializar instâncias para todos os templates existentes no mês corrente
-- (idempotente via ON CONFLICT DO NOTHING)
INSERT INTO public.budget_instances (
  budget_id,
  period_key,
  period_start,
  period_end,
  budget_cents,
  status
)
SELECT
  b.id,
  to_char(current_date, 'YYYY-MM'),
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  b.amount_cents,
  'active'
FROM public.budgets b
WHERE b.is_template = true
  AND b.period_type = 'monthly'
  AND b.amount_cents IS NOT NULL
  AND b.amount_cents > 0
ON CONFLICT (budget_id, period_key) DO NOTHING;

-- Recriar budget_progress usando budget_instances como fonte de verdade
DROP VIEW IF EXISTS public.budget_progress;

CREATE OR REPLACE VIEW public.budget_progress AS
SELECT
  bi.id                  AS budget_instance_id,
  bi.budget_id,
  b.user_id,
  b.family_id,
  b.categoria_id,
  c.nome                 AS categoria_nome,
  c.cor                  AS categoria_cor,
  b.period_type,
  bi.period_key,
  bi.period_start,
  bi.period_end,
  bi.budget_cents        AS valor_orcamento_cents,
  bi.spent_cents         AS valor_gasto_cents,
  (bi.budget_cents - bi.spent_cents)
                         AS valor_restante_cents,
  CASE
    WHEN bi.budget_cents > 0
    THEN ROUND((bi.spent_cents::numeric / bi.budget_cents) * 100, 2)
    ELSE 0
  END                    AS progresso_percentual,
  bi.status,
  b.rollover_mode,
  b.cap_type,
  b.parent_id,
  b.is_template
FROM public.budget_instances bi
JOIN public.budgets b ON b.id = bi.budget_id
LEFT JOIN public.categories c ON c.id = b.categoria_id;

GRANT SELECT ON public.budget_progress TO authenticated;

COMMIT;
