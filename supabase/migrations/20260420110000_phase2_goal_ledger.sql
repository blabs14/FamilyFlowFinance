-- Phase 2a: criar goal_ledger como fonte da verdade para saldo de objetivos

set local search_path = public;

CREATE TABLE public.goal_ledger (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        uuid        NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  account_id     uuid        REFERENCES public.accounts(id) ON DELETE SET NULL,
  tipo           text        NOT NULL CHECK (tipo IN ('allocation','deallocation','contribution','correction')),
  amount_cents   bigint      NOT NULL CHECK (amount_cents > 0),
  signed         smallint    NOT NULL CHECK (signed IN (1, -1)),
  transaction_id uuid        REFERENCES public.transactions(id) ON DELETE SET NULL,
  rule_id        uuid        REFERENCES public.goal_funding_rules(id) ON DELETE SET NULL,
  data           date        NOT NULL DEFAULT current_date,
  operation_id   uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_by     uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_goal_ledger_goal ON public.goal_ledger(goal_id);
CREATE INDEX idx_goal_ledger_account ON public.goal_ledger(account_id);
CREATE INDEX idx_goal_ledger_tx ON public.goal_ledger(transaction_id);
CREATE INDEX idx_goal_ledger_rule ON public.goal_ledger(rule_id);

-- RLS: leitura para quem vê o objetivo
ALTER TABLE public.goal_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_goal_ledger ON public.goal_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_ledger.goal_id
        AND (
          g.user_id = auth.uid()
          OR (
            g.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = g.family_id AND fm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Escrita: apenas SECURITY DEFINER functions
CREATE POLICY deny_write_goal_ledger ON public.goal_ledger
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT ON public.goal_ledger TO authenticated;

-- View: saldo atual de cada objetivo a partir do ledger
CREATE OR REPLACE VIEW public.goals_with_balance AS
SELECT
  g.*,
  COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS valor_atual_cents
FROM public.goals g
LEFT JOIN public.goal_ledger gl ON gl.goal_id = g.id
GROUP BY g.id;

GRANT SELECT ON public.goals_with_balance TO authenticated;
