-- supabase/migrations/20260512110000_unit14a_rules.sql
BEGIN;

CREATE TABLE IF NOT EXISTS import_categorization_rules (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      REFERENCES auth.users,
  family_id   uuid      REFERENCES families,
  scope       text      NOT NULL CHECK (scope IN ('user','family','system_seed')),
  priority    smallint  NOT NULL DEFAULT 100,
  match_field text      NOT NULL CHECK (match_field IN ('description','counterparty','amount_range')),
  match_type  text      NOT NULL CHECK (match_type IN ('contains','regex','equals','starts_with','range')),
  pattern     text      NOT NULL,
  category_id uuid      NOT NULL REFERENCES categories,
  active      boolean   NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS import_categorization_rules_system_seed_uniq
  ON import_categorization_rules (pattern, match_field)
  WHERE scope = 'system_seed';

CREATE INDEX IF NOT EXISTS idx_import_categorization_rules_lookup
  ON import_categorization_rules (active, scope, priority DESC);

ALTER TABLE import_categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own or system" ON import_categorization_rules
  FOR SELECT USING (
    scope = 'system_seed'
    OR user_id = auth.uid()
    OR family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "insert own" ON import_categorization_rules
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "update own" ON import_categorization_rules
  FOR UPDATE USING (
    user_id = auth.uid() OR
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "delete own" ON import_categorization_rules
  FOR DELETE USING (
    user_id = auth.uid() OR
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- system_seed rules (priority=1000; user rules default 100 → user wins)
DO $$
DECLARE
  cat_id uuid;
  seeds text[][] := ARRAY[
    ARRAY['LIDL',           'Supermercado'],
    ARRAY['PINGO DOCE',     'Supermercado'],
    ARRAY['CONTINENTE',     'Supermercado'],
    ARRAY['AUCHAN',         'Supermercado'],
    ARRAY['JUMBO',          'Supermercado'],
    ARRAY['INTERMARCHE',    'Supermercado'],
    ARRAY['GALP',           'Combustível'],
    ARRAY['BP ',            'Combustível'],
    ARRAY['REPSOL',         'Combustível'],
    ARRAY['CEPSA',          'Combustível'],
    ARRAY['NOS ',           'Telecomunicações'],
    ARRAY['MEO ',           'Telecomunicações'],
    ARRAY['VODAFONE',       'Telecomunicações'],
    ARRAY['NOWO',           'Telecomunicações'],
    ARRAY['EDP',            'Energia'],
    ARRAY['GALP GAS',       'Energia'],
    ARRAY['GOLD ENERGY',    'Energia'],
    ARRAY['FARMACI',        'Saúde'],
    ARRAY['MB WAY',         'Transferência'],
    ARRAY['LEVANTAMENTO',   'Levantamento'],
    ARRAY['CAIXA AUTOMATIC','Levantamento'],
    ARRAY['COMISSAO',       'Despesas Bancárias'],
    ARRAY['TAXA BANCARIA',  'Despesas Bancárias'],
    ARRAY['IUC',            'Impostos'],
    ARRAY['IMI',            'Impostos'],
    ARRAY['SEG SOCIAL',     'Impostos'],
    ARRAY['CTT',            'Serviços Postais'],
    ARRAY['UBER',           'Transportes'],
    ARRAY['BOLT',           'Transportes'],
    ARRAY['NETFLIX',        'Subscrições'],
    ARRAY['SPOTIFY',        'Subscrições'],
    ARRAY['HBO',            'Subscrições'],
    ARRAY['DISNEY',         'Subscrições'],
    ARRAY['RESTAURANTE',    'Restauração'],
    ARRAY['PASTELARIA',     'Restauração'],
    ARRAY['CAFE',           'Restauração'],
    ARRAY['ZARA',           'Vestuário'],
    ARRAY['H&M',            'Vestuário'],
    ARRAY['PRIMARK',        'Vestuário'],
    ARRAY['AMAZON',         'Compras Online'],
    ARRAY['FNAC',           'Compras Online'],
    ARRAY['WORTEN',         'Compras Online']
  ];
  seed text[];
BEGIN
  FOREACH seed SLICE 1 IN ARRAY seeds LOOP
    SELECT id INTO cat_id FROM categories WHERE nome ILIKE seed[2] LIMIT 1;
    IF cat_id IS NOT NULL THEN
      INSERT INTO import_categorization_rules
        (scope, priority, match_field, match_type, pattern, category_id)
      VALUES ('system_seed', 1000, 'description', 'contains', seed[1], cat_id)
      ON CONFLICT (pattern, match_field) WHERE scope = 'system_seed' DO NOTHING;
    END IF;
  END LOOP;
END $$;

COMMIT;
