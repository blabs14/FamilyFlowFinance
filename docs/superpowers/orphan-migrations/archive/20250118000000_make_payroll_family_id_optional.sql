-- Make family_id optional in payroll tables
-- This allows payroll to be personal to the user without family association

-- Update payroll_contracts table
ALTER TABLE "public"."payroll_contracts" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_ot_policies table
ALTER TABLE "public"."payroll_ot_policies" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_holidays table
ALTER TABLE "public"."payroll_holidays" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_time_entries table
ALTER TABLE "public"."payroll_time_entries" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_mileage_policies table
ALTER TABLE "public"."payroll_mileage_policies" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_mileage_trips table
ALTER TABLE "public"."payroll_mileage_trips" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_periods table
ALTER TABLE "public"."payroll_periods" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_items table
ALTER TABLE "public"."payroll_items" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update payroll_payslips table
ALTER TABLE "public"."payroll_payslips" 
ALTER COLUMN "family_id" DROP NOT NULL;

-- Update RLS policies to use only user_id for payroll tables
-- Drop existing policies and create new ones

-- payroll_contracts policies
DROP POLICY IF EXISTS "Users can manage their own payroll contracts" ON "public"."payroll_contracts";
CREATE POLICY "Users can manage their own payroll contracts" ON "public"."payroll_contracts"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_ot_policies policies
DROP POLICY IF EXISTS "Users can manage their own OT policies" ON "public"."payroll_ot_policies";
CREATE POLICY "Users can manage their own OT policies" ON "public"."payroll_ot_policies"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_holidays policies
DROP POLICY IF EXISTS "Users can manage their own holidays" ON "public"."payroll_holidays";
CREATE POLICY "Users can manage their own holidays" ON "public"."payroll_holidays"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_time_entries policies
DROP POLICY IF EXISTS "Users can manage their own time entries" ON "public"."payroll_time_entries";
CREATE POLICY "Users can manage their own time entries" ON "public"."payroll_time_entries"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_mileage_policies policies
DROP POLICY IF EXISTS "Users can manage their own mileage policies" ON "public"."payroll_mileage_policies";
CREATE POLICY "Users can manage their own mileage policies" ON "public"."payroll_mileage_policies"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_mileage_trips policies
DROP POLICY IF EXISTS "Users can manage their own mileage trips" ON "public"."payroll_mileage_trips";
CREATE POLICY "Users can manage their own mileage trips" ON "public"."payroll_mileage_trips"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_periods policies
DROP POLICY IF EXISTS "Users can manage their own payroll periods" ON "public"."payroll_periods";
CREATE POLICY "Users can manage their own payroll periods" ON "public"."payroll_periods"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_items policies
DROP POLICY IF EXISTS "Users can manage their own payroll items" ON "public"."payroll_items";
CREATE POLICY "Users can manage their own payroll items" ON "public"."payroll_items"
    FOR ALL USING (auth.uid() = user_id);

-- payroll_payslips policies
DROP POLICY IF EXISTS "Users can manage their own payslips" ON "public"."payroll_payslips";
CREATE POLICY "Users can manage their own payslips" ON "public"."payroll_payslips"
    FOR ALL USING (auth.uid() = user_id);