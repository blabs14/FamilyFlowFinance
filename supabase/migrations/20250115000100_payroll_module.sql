-- Payroll Module Migration
-- Creates tables for payroll, timesheets, and mileage tracking
-- All tables use RLS with user_id = auth.uid() policy

create table if not exists "public"."payroll_contracts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "name" text not null,
    "base_salary_cents" integer not null,
    "currency" text not null default 'EUR',
    "schedule_json" jsonb not null, -- {"monday": {"start": "09:00", "end": "18:00", "break_minutes": 60}, ...}
    "meal_allowance_cents_per_day" integer default 0,
    "meal_on_worked_days" boolean default true,
    "vacation_bonus_mode" text not null default 'monthly', -- 'monthly', 'june', 'december', 'off'
    "christmas_bonus_mode" text not null default 'monthly', -- 'monthly', 'december', 'off'
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_contracts" enable row level security;

create table if not exists "public"."payroll_ot_policies" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "contract_id" uuid not null,
    "name" text not null,
    "day_multiplier" numeric(4,2) not null default 1.25, -- 125% for day overtime
    "night_multiplier" numeric(4,2) not null default 1.50, -- 150% for night overtime
    "weekend_multiplier" numeric(4,2) not null default 1.50, -- 150% for weekend
    "holiday_multiplier" numeric(4,2) not null default 2.00, -- 200% for holidays
    "night_start" time not null default '22:00:00',
    "night_end" time not null default '07:00:00',
    "rounding_minutes" integer not null default 15, -- round to 15-minute blocks
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_ot_policies" enable row level security;

create table if not exists "public"."payroll_holidays" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "date" date not null,
    "name" text not null,
    "is_recurring" boolean default false, -- for annual holidays like Christmas
    "created_at" timestamp with time zone default now()
);

alter table "public"."payroll_holidays" enable row level security;

create table if not exists "public"."payroll_time_entries" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "contract_id" uuid not null,
    "date" date not null,
    "start_time" time not null,
    "end_time" time not null,
    "break_minutes" integer default 0,
    "notes" text,
    "dedupe_hash" text, -- sha256 for CSV import deduplication
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_time_entries" enable row level security;

create table if not exists "public"."payroll_mileage_policies" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "name" text not null,
    "rate_cents_per_km" integer not null, -- e.g., 36 cents = €0.36/km
    "monthly_cap_cents" integer, -- optional monthly limit
    "requires_purpose" boolean default true,
    "requires_origin_destination" boolean default true,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_mileage_policies" enable row level security;

create table if not exists "public"."payroll_mileage_trips" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "policy_id" uuid not null,
    "date" date not null,
    "km" numeric(8,2) not null, -- up to 999,999.99 km
    "origin" text,
    "destination" text,
    "purpose" text,
    "attachment_path" text, -- Storage path for receipts/proof
    "dedupe_hash" text, -- sha256 for CSV import deduplication
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_mileage_trips" enable row level security;

create table if not exists "public"."payroll_periods" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "contract_id" uuid not null,
    "year" integer not null,
    "month" integer not null,
    "period_key" text not null, -- 'YYYY-MM' format
    "planned_minutes" integer not null,
    "worked_minutes" integer not null,
    "gross_cents" integer not null,
    "net_expected_cents" integer not null, -- same as gross for now
    "recalculated_at" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_periods" enable row level security;

create table if not exists "public"."payroll_items" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "period_id" uuid not null,
    "kind" text not null, -- 'base', 'ot_day', 'ot_night', 'ot_weekend', 'ot_holiday', 'meal', 'vacation_bonus', 'christmas_bonus', 'mileage', 'allowance', 'deduction'
    "description" text not null,
    "quantity" numeric(10,2), -- minutes for OT, days for meal, km for mileage
    "rate_cents" integer, -- rate per unit (minute, day, km)
    "amount_cents" integer not null,
    "created_at" timestamp with time zone default now()
);

alter table "public"."payroll_items" enable row level security;

create table if not exists "public"."payroll_payslips" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "family_id" uuid,
    "period_id" uuid not null,
    "gross_cents" integer,
    "net_cents" integer,
    "ss_deduction_cents" integer, -- Social Security
    "irs_deduction_cents" integer, -- Income Tax
    "meal_allowance_cents" integer,
    "vacation_bonus_cents" integer,
    "christmas_bonus_cents" integer,
    "other_deductions_cents" integer,
    "other_allowances_cents" integer,
    "file_path" text, -- Storage path for uploaded payslip
    "notes" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

alter table "public"."payroll_payslips" enable row level security;

-- Add primary keys
CREATE UNIQUE INDEX IF NOT EXISTS payroll_contracts_pkey ON public.payroll_contracts USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_ot_policies_pkey ON public.payroll_ot_policies USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_holidays_pkey ON public.payroll_holidays USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_time_entries_pkey ON public.payroll_time_entries USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_mileage_policies_pkey ON public.payroll_mileage_policies USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_mileage_trips_pkey ON public.payroll_mileage_trips USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_pkey ON public.payroll_periods USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_items_pkey ON public.payroll_items USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_payslips_pkey ON public.payroll_payslips USING btree (id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_pkey') THEN
    alter table "public"."payroll_contracts" add constraint "payroll_contracts_pkey" PRIMARY KEY using index "payroll_contracts_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_ot_policies_pkey') THEN
    alter table "public"."payroll_ot_policies" add constraint "payroll_ot_policies_pkey" PRIMARY KEY using index "payroll_ot_policies_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_holidays_pkey') THEN
    alter table "public"."payroll_holidays" add constraint "payroll_holidays_pkey" PRIMARY KEY using index "payroll_holidays_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_time_entries_pkey') THEN
    alter table "public"."payroll_time_entries" add constraint "payroll_time_entries_pkey" PRIMARY KEY using index "payroll_time_entries_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_policies_pkey') THEN
    alter table "public"."payroll_mileage_policies" add constraint "payroll_mileage_policies_pkey" PRIMARY KEY using index "payroll_mileage_policies_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_trips_pkey') THEN
    alter table "public"."payroll_mileage_trips" add constraint "payroll_mileage_trips_pkey" PRIMARY KEY using index "payroll_mileage_trips_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_pkey') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_pkey" PRIMARY KEY using index "payroll_periods_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_pkey') THEN
    alter table "public"."payroll_items" add constraint "payroll_items_pkey" PRIMARY KEY using index "payroll_items_pkey";
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_payslips_pkey') THEN
    alter table "public"."payroll_payslips" add constraint "payroll_payslips_pkey" PRIMARY KEY using index "payroll_payslips_pkey";
  END IF;
END $$;

-- Add foreign key constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_user_id_fkey') THEN
    alter table "public"."payroll_contracts" add constraint "payroll_contracts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_contracts" validate constraint "payroll_contracts_user_id_fkey";
  END IF;
END $$;

-- Guardar dependência de families: só adicionar FK se a tabela existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'families'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_family_id_fkey') THEN
      EXECUTE 'alter table public.payroll_contracts add constraint payroll_contracts_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE not valid';
      EXECUTE 'alter table public.payroll_contracts validate constraint payroll_contracts_family_id_fkey';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping payroll_contracts_family_id_fkey - public.families does not exist yet';
  END IF;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_ot_policies_user_id_fkey') THEN
    alter table "public"."payroll_ot_policies" add constraint "payroll_ot_policies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_ot_policies" validate constraint "payroll_ot_policies_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_ot_policies_contract_id_fkey') THEN
    alter table "public"."payroll_ot_policies" add constraint "payroll_ot_policies_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES public.payroll_contracts(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_ot_policies" validate constraint "payroll_ot_policies_contract_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_holidays_user_id_fkey') THEN
    alter table "public"."payroll_holidays" add constraint "payroll_holidays_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_holidays" validate constraint "payroll_holidays_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_time_entries_user_id_fkey') THEN
    alter table "public"."payroll_time_entries" add constraint "payroll_time_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_time_entries" validate constraint "payroll_time_entries_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_time_entries_contract_id_fkey') THEN
    alter table "public"."payroll_time_entries" add constraint "payroll_time_entries_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES public.payroll_contracts(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_time_entries" validate constraint "payroll_time_entries_contract_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_policies_user_id_fkey') THEN
    alter table "public"."payroll_mileage_policies" add constraint "payroll_mileage_policies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_mileage_policies" validate constraint "payroll_mileage_policies_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_trips_user_id_fkey') THEN
    alter table "public"."payroll_mileage_trips" add constraint "payroll_mileage_trips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_mileage_trips" validate constraint "payroll_mileage_trips_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_trips_policy_id_fkey') THEN
    alter table "public"."payroll_mileage_trips" add constraint "payroll_mileage_trips_policy_id_fkey" FOREIGN KEY (policy_id) REFERENCES public.payroll_mileage_policies(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_mileage_trips" validate constraint "payroll_mileage_trips_policy_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_user_id_fkey') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_periods" validate constraint "payroll_periods_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_contract_id_fkey') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_contract_id_fkey" FOREIGN KEY (contract_id) REFERENCES public.payroll_contracts(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_periods" validate constraint "payroll_periods_contract_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_user_id_fkey') THEN
    alter table "public"."payroll_items" add constraint "payroll_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_items" validate constraint "payroll_items_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_period_id_fkey') THEN
    alter table "public"."payroll_items" add constraint "payroll_items_period_id_fkey" FOREIGN KEY (period_id) REFERENCES public.payroll_periods(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_items" validate constraint "payroll_items_period_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_payslips_user_id_fkey') THEN
    alter table "public"."payroll_payslips" add constraint "payroll_payslips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_payslips" validate constraint "payroll_payslips_user_id_fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_payslips_period_id_fkey') THEN
    alter table "public"."payroll_payslips" add constraint "payroll_payslips_period_id_fkey" FOREIGN KEY (period_id) REFERENCES public.payroll_periods(id) ON DELETE CASCADE not valid;
    alter table "public"."payroll_payslips" validate constraint "payroll_payslips_period_id_fkey";
  END IF;
END $$;

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_user_period_key ON public.payroll_periods USING btree (user_id, period_key);
CREATE UNIQUE INDEX IF NOT EXISTS payroll_time_entries_dedupe_hash_key ON public.payroll_time_entries USING btree (user_id, dedupe_hash) WHERE dedupe_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_mileage_trips_dedupe_hash_key ON public.payroll_mileage_trips USING btree (user_id, dedupe_hash) WHERE dedupe_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_holidays_user_date_key ON public.payroll_holidays USING btree (user_id, date);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS payroll_time_entries_user_date_idx ON public.payroll_time_entries USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS payroll_mileage_trips_user_date_idx ON public.payroll_mileage_trips USING btree (user_id, date);
CREATE INDEX IF NOT EXISTS payroll_items_period_kind_idx ON public.payroll_items USING btree (period_id, kind);

-- Create RLS policies
-- Payroll Contracts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_contracts' AND policyname = 'Users can view own payroll contracts'
  ) THEN
    CREATE POLICY "Users can view own payroll contracts" ON "public"."payroll_contracts"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_contracts' AND policyname = 'Users can insert own payroll contracts'
  ) THEN
    CREATE POLICY "Users can insert own payroll contracts" ON "public"."payroll_contracts"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_contracts' AND policyname = 'Users can update own payroll contracts'
  ) THEN
    CREATE POLICY "Users can update own payroll contracts" ON "public"."payroll_contracts"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_contracts' AND policyname = 'Users can delete own payroll contracts'
  ) THEN
    CREATE POLICY "Users can delete own payroll contracts" ON "public"."payroll_contracts"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll OT Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_ot_policies' AND policyname = 'Users can view own payroll ot policies'
  ) THEN
    CREATE POLICY "Users can view own payroll ot policies" ON "public"."payroll_ot_policies"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_ot_policies' AND policyname = 'Users can insert own payroll ot policies'
  ) THEN
    CREATE POLICY "Users can insert own payroll ot policies" ON "public"."payroll_ot_policies"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_ot_policies' AND policyname = 'Users can update own payroll ot policies'
  ) THEN
    CREATE POLICY "Users can update own payroll ot policies" ON "public"."payroll_ot_policies"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_ot_policies' AND policyname = 'Users can delete own payroll ot policies'
  ) THEN
    CREATE POLICY "Users can delete own payroll ot policies" ON "public"."payroll_ot_policies"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Holidays
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_holidays' AND policyname = 'Users can view own payroll holidays'
  ) THEN
    CREATE POLICY "Users can view own payroll holidays" ON "public"."payroll_holidays"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_holidays' AND policyname = 'Users can insert own payroll holidays'
  ) THEN
    CREATE POLICY "Users can insert own payroll holidays" ON "public"."payroll_holidays"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_holidays' AND policyname = 'Users can update own payroll holidays'
  ) THEN
    CREATE POLICY "Users can update own payroll holidays" ON "public"."payroll_holidays"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_holidays' AND policyname = 'Users can delete own payroll holidays'
  ) THEN
    CREATE POLICY "Users can delete own payroll holidays" ON "public"."payroll_holidays"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Time Entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_time_entries' AND policyname = 'Users can view own payroll time entries'
  ) THEN
    CREATE POLICY "Users can view own payroll time entries" ON "public"."payroll_time_entries"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_time_entries' AND policyname = 'Users can insert own payroll time entries'
  ) THEN
    CREATE POLICY "Users can insert own payroll time entries" ON "public"."payroll_time_entries"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_time_entries' AND policyname = 'Users can update own payroll time entries'
  ) THEN
    CREATE POLICY "Users can update own payroll time entries" ON "public"."payroll_time_entries"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_time_entries' AND policyname = 'Users can delete own payroll time entries'
  ) THEN
    CREATE POLICY "Users can delete own payroll time entries" ON "public"."payroll_time_entries"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Mileage Policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_policies' AND policyname = 'Users can view own payroll mileage policies'
  ) THEN
    CREATE POLICY "Users can view own payroll mileage policies" ON "public"."payroll_mileage_policies"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_policies' AND policyname = 'Users can insert own payroll mileage policies'
  ) THEN
    CREATE POLICY "Users can insert own payroll mileage policies" ON "public"."payroll_mileage_policies"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_policies' AND policyname = 'Users can update own payroll mileage policies'
  ) THEN
    CREATE POLICY "Users can update own payroll mileage policies" ON "public"."payroll_mileage_policies"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_policies' AND policyname = 'Users can delete own payroll mileage policies'
  ) THEN
    CREATE POLICY "Users can delete own payroll mileage policies" ON "public"."payroll_mileage_policies"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Mileage Trips
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_trips' AND policyname = 'Users can view own payroll mileage trips'
  ) THEN
    CREATE POLICY "Users can view own payroll mileage trips" ON "public"."payroll_mileage_trips"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_trips' AND policyname = 'Users can insert own payroll mileage trips'
  ) THEN
    CREATE POLICY "Users can insert own payroll mileage trips" ON "public"."payroll_mileage_trips"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_trips' AND policyname = 'Users can update own payroll mileage trips'
  ) THEN
    CREATE POLICY "Users can update own payroll mileage trips" ON "public"."payroll_mileage_trips"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_mileage_trips' AND policyname = 'Users can delete own payroll mileage trips'
  ) THEN
    CREATE POLICY "Users can delete own payroll mileage trips" ON "public"."payroll_mileage_trips"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Periods
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_periods' AND policyname = 'Users can view own payroll periods'
  ) THEN
    CREATE POLICY "Users can view own payroll periods" ON "public"."payroll_periods"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_periods' AND policyname = 'Users can insert own payroll periods'
  ) THEN
    CREATE POLICY "Users can insert own payroll periods" ON "public"."payroll_periods"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_periods' AND policyname = 'Users can update own payroll periods'
  ) THEN
    CREATE POLICY "Users can update own payroll periods" ON "public"."payroll_periods"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_periods' AND policyname = 'Users can delete own payroll periods'
  ) THEN
    CREATE POLICY "Users can delete own payroll periods" ON "public"."payroll_periods"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_items' AND policyname = 'Users can view own payroll items'
  ) THEN
    CREATE POLICY "Users can view own payroll items" ON "public"."payroll_items"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_items' AND policyname = 'Users can insert own payroll items'
  ) THEN
    CREATE POLICY "Users can insert own payroll items" ON "public"."payroll_items"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_items' AND policyname = 'Users can update own payroll items'
  ) THEN
    CREATE POLICY "Users can update own payroll items" ON "public"."payroll_items"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_items' AND policyname = 'Users can delete own payroll items'
  ) THEN
    CREATE POLICY "Users can delete own payroll items" ON "public"."payroll_items"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Payroll Payslips
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_payslips' AND policyname = 'Users can view own payroll payslips'
  ) THEN
    CREATE POLICY "Users can view own payroll payslips" ON "public"."payroll_payslips"
        FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_payslips' AND policyname = 'Users can insert own payroll payslips'
  ) THEN
    CREATE POLICY "Users can insert own payroll payslips" ON "public"."payroll_payslips"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_payslips' AND policyname = 'Users can update own payroll payslips'
  ) THEN
    CREATE POLICY "Users can update own payroll payslips" ON "public"."payroll_payslips"
        FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'payroll_payslips' AND policyname = 'Users can delete own payroll payslips'
  ) THEN
    CREATE POLICY "Users can delete own payroll payslips" ON "public"."payroll_payslips"
        FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add check constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_base_salary_positive') THEN
    alter table "public"."payroll_contracts" add constraint "payroll_contracts_base_salary_positive" CHECK (base_salary_cents > 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_meal_allowance_non_negative') THEN
    alter table "public"."payroll_contracts" add constraint "payroll_contracts_meal_allowance_non_negative" CHECK (meal_allowance_cents_per_day >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_vacation_bonus_mode_valid') THEN
    alter table "public"."payroll_contracts" add constraint "payroll_contracts_vacation_bonus_mode_valid" CHECK (vacation_bonus_mode IN ('monthly', 'june', 'december', 'off'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_contracts_christmas_bonus_mode_valid') THEN
    alter table "public"."payroll_contracts" add constraint "payroll_contracts_christmas_bonus_mode_valid" CHECK (christmas_bonus_mode IN ('monthly', 'december', 'off'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_ot_policies_multipliers_positive') THEN
    alter table "public"."payroll_ot_policies" add constraint "payroll_ot_policies_multipliers_positive" CHECK (day_multiplier > 0 AND night_multiplier > 0 AND weekend_multiplier > 0 AND holiday_multiplier > 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_ot_policies_rounding_positive') THEN
    alter table "public"."payroll_ot_policies" add constraint "payroll_ot_policies_rounding_positive" CHECK (rounding_minutes > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_time_entries_break_non_negative') THEN
    alter table "public"."payroll_time_entries" add constraint "payroll_time_entries_break_non_negative" CHECK (break_minutes >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_time_entries_time_order') THEN
    alter table "public"."payroll_time_entries" add constraint "payroll_time_entries_time_order" CHECK (start_time < end_time);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_policies_rate_positive') THEN
    alter table "public"."payroll_mileage_policies" add constraint "payroll_mileage_policies_rate_positive" CHECK (rate_cents_per_km > 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_policies_cap_positive') THEN
    alter table "public"."payroll_mileage_policies" add constraint "payroll_mileage_policies_cap_positive" CHECK (monthly_cap_cents IS NULL OR monthly_cap_cents > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_mileage_trips_km_positive') THEN
    alter table "public"."payroll_mileage_trips" add constraint "payroll_mileage_trips_km_positive" CHECK (km > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_year_valid') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_year_valid" CHECK (year >= 2000 AND year <= 2100);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_month_valid') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_month_valid" CHECK (month >= 1 AND month <= 12);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_minutes_non_negative') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_minutes_non_negative" CHECK (planned_minutes >= 0 AND worked_minutes >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_cents_non_negative') THEN
    alter table "public"."payroll_periods" add constraint "payroll_periods_cents_non_negative" CHECK (gross_cents >= 0 AND net_expected_cents >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_kind_valid') THEN
    alter table "public"."payroll_items" add constraint "payroll_items_kind_valid" CHECK (kind IN ('base', 'ot_day', 'ot_night', 'ot_weekend', 'ot_holiday', 'meal', 'vacation_bonus', 'christmas_bonus', 'mileage', 'allowance', 'deduction'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_quantity_non_negative') THEN
    alter table "public"."payroll_items" add constraint "payroll_items_quantity_non_negative" CHECK (quantity IS NULL OR quantity >= 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_items_rate_non_negative') THEN
    alter table "public"."payroll_items" add constraint "payroll_items_rate_non_negative" CHECK (rate_cents IS NULL OR rate_cents >= 0);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE "public"."payroll_contracts" IS 'Employee contracts with base salary and schedule configuration';
COMMENT ON TABLE "public"."payroll_ot_policies" IS 'Overtime policies with multipliers for different time periods';
COMMENT ON TABLE "public"."payroll_holidays" IS 'Holiday calendar for overtime calculations';
COMMENT ON TABLE "public"."payroll_time_entries" IS 'Daily time entries for timesheet tracking';
COMMENT ON TABLE "public"."payroll_mileage_policies" IS 'Mileage reimbursement policies and rates';
COMMENT ON TABLE "public"."payroll_mileage_trips" IS 'Individual mileage trips for reimbursement';
COMMENT ON TABLE "public"."payroll_periods" IS 'Monthly payroll calculation periods with totals';
COMMENT ON TABLE "public"."payroll_items" IS 'Individual payroll line items (base, overtime, bonuses, etc.)';
COMMENT ON TABLE "public"."payroll_payslips" IS 'Manual payslip data for comparison with calculated values';

COMMENT ON COLUMN "public"."payroll_contracts"."schedule_json" IS 'Weekly schedule in JSON format with start/end times and breaks for each day';
COMMENT ON COLUMN "public"."payroll_ot_policies"."rounding_minutes" IS 'Round overtime to nearest X minutes (e.g., 15 for quarter-hour blocks)';
COMMENT ON COLUMN "public"."payroll_time_entries"."dedupe_hash" IS 'SHA256 hash for CSV import deduplication';
COMMENT ON COLUMN "public"."payroll_mileage_trips"."km" IS 'Distance in kilometers with 2 decimal precision';
COMMENT ON COLUMN "public"."payroll_periods"."period_key" IS 'Period identifier in YYYY-MM format for easy querying';
COMMENT ON COLUMN "public"."payroll_items"."kind" IS 'Type of payroll item: base salary, overtime, bonuses, allowances, deductions';