-- supabase/migrations/20260423140000_unit08_check_budget_thresholds.sql
-- Unit 8 Task 5: inbox_items (minimal) + check_budget_thresholds

set local search_path = public;

BEGIN;

-- Criar inbox_items se não existir (Unit 9 irá expandir)
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id      uuid        REFERENCES public.families(id) ON DELETE CASCADE,
  source_type    text        NOT NULL
                             CHECK (source_type IN (
                               'budget_threshold',
                               'goal_deadline',
                               'recurring_instance',
                               'manual'
                             )),
  source_id      uuid        NOT NULL,
  title          text        NOT NULL,
  body           text,
  due_at         timestamptz NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','snoozed','done','dismissed')),
  snoozed_until  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_source
  ON public.inbox_items(source_type, source_id, user_id);

CREATE INDEX IF NOT EXISTS idx_inbox_user_status
  ON public.inbox_items(user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_inbox_family
  ON public.inbox_items(family_id)
  WHERE family_id IS NOT NULL;

-- RLS
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inbox_select ON public.inbox_items;
CREATE POLICY inbox_select ON public.inbox_items
  FOR SELECT USING (
    user_id = auth.uid()
    OR (family_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = inbox_items.family_id AND fm.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS inbox_insert ON public.inbox_items;
CREATE POLICY inbox_insert ON public.inbox_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS inbox_update ON public.inbox_items;
CREATE POLICY inbox_update ON public.inbox_items
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS inbox_delete ON public.inbox_items;
CREATE POLICY inbox_delete ON public.inbox_items
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_items TO authenticated;

-- Função principal: varre instâncias activas e insere inbox_items para thresholds
-- Chamada pelo daily-scheduler. Idempotente via ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.check_budget_thresholds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row          record;
  v_pct          numeric;
  v_days_elapsed int;
  v_total_days   int;
  v_projected    bigint;
  v_is_proj_over boolean;
  v_threshold    text;
  v_title        text;
  v_body         text;
  v_target_user  uuid;
  v_count        int := 0;
BEGIN
  FOR v_row IN
    SELECT
      bi.id              AS instance_id,
      bi.budget_cents,
      bi.spent_cents,
      bi.period_start,
      bi.period_end,
      b.user_id,
      b.family_id,
      b.categoria_id,
      c.nome             AS categoria_nome
    FROM public.budget_instances bi
    JOIN public.budgets b ON b.id = bi.budget_id
    LEFT JOIN public.categories c ON c.id = b.categoria_id
    WHERE bi.status = 'active'
      AND bi.period_end >= current_date
      AND bi.budget_cents > 0
  LOOP
    v_pct := ROUND((v_row.spent_cents::numeric / v_row.budget_cents) * 100, 2);

    v_days_elapsed := GREATEST(1, current_date - v_row.period_start + 1);
    v_total_days   := v_row.period_end - v_row.period_start + 1;
    v_projected    := ROUND(
      (v_row.spent_cents::numeric / NULLIF(v_days_elapsed, 0)) * v_total_days
    );
    v_is_proj_over := v_projected > v_row.budget_cents;

    -- Determinar threshold a notificar
    v_threshold := NULL;
    IF v_pct >= 100 THEN
      v_threshold := '100pct';
      v_title := format('Orçamento excedido: %s', v_row.categoria_nome);
      v_body  := format('Gastaste %s%% do orçamento de %s.', v_pct, v_row.categoria_nome);
    ELSIF v_pct >= 80 THEN
      v_threshold := '80pct';
      v_title := format('Orçamento a 80%%: %s', v_row.categoria_nome);
      v_body  := format('Já gastaste %s%% do orçamento de %s.', v_pct, v_row.categoria_nome);
    ELSIF v_is_proj_over THEN
      v_threshold := 'projected_over';
      v_title := format('Projeção acima do orçamento: %s', v_row.categoria_nome);
      v_body  := format('Ao ritmo atual irás ultrapassar o orçamento de %s.', v_row.categoria_nome);
    END IF;

    CONTINUE WHEN v_threshold IS NULL;

    -- Notificar utilizador(es)
    IF v_row.family_id IS NULL THEN
      -- Pessoal
      INSERT INTO public.inbox_items (
        user_id, family_id, source_type, source_id,
        title, body, due_at, status
      ) VALUES (
        v_row.user_id, NULL, 'budget_threshold',
        md5(v_row.instance_id::text || v_threshold)::uuid,
        v_title, v_body, now(), 'pending'
      )
      ON CONFLICT (source_type, source_id, user_id) DO NOTHING;
      v_count := v_count + 1;
    ELSE
      -- Familiar: notificar todos os membros activos não-viewer
      FOR v_target_user IN
        SELECT fm.user_id FROM public.family_members fm
        WHERE fm.family_id = v_row.family_id
          AND fm.role != 'viewer'
          AND fm.status = 'active'
      LOOP
        INSERT INTO public.inbox_items (
          user_id, family_id, source_type, source_id,
          title, body, due_at, status
        ) VALUES (
          v_target_user, v_row.family_id, 'budget_threshold',
          md5(v_row.instance_id::text || v_threshold || v_target_user::text)::uuid,
          v_title, v_body, now(), 'pending'
        )
        ON CONFLICT (source_type, source_id, user_id) DO NOTHING;
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('notifications_created', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_budget_thresholds() TO service_role;

COMMIT;
