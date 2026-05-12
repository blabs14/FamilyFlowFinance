-- Migration 3: create payroll_travel_allowances table

CREATE TABLE IF NOT EXISTS payroll_travel_allowances (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          uuid NOT NULL REFERENCES payroll_contracts(id) ON DELETE CASCADE,
  type                 text NOT NULL CHECK (type IN (
                         'deslocacao_nacional',
                         'deslocacao_estrangeiro',
                         'deslocacao_viatura_propria',
                         'alojamento'
                       )),
  date_start           date NOT NULL,
  days                 numeric(5,2),
  km                   numeric(8,2),
  role                 text NOT NULL DEFAULT 'general'
                         CHECK (role IN ('general', 'admin')),
  declared_cents       integer NOT NULL,
  taxable_excess_cents integer NOT NULL DEFAULT 0,
  operation_id         text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_travel_allowances_operation_id_key UNIQUE (operation_id)
);

CREATE INDEX IF NOT EXISTS idx_travel_allowances_contract_date
  ON payroll_travel_allowances (contract_id, date_start);

ALTER TABLE payroll_travel_allowances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can manage own travel allowances"
    ON payroll_travel_allowances
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM payroll_contracts pc
        WHERE pc.id = contract_id
          AND pc.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM payroll_contracts pc
        WHERE pc.id = contract_id
          AND pc.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
