-- Migration: Add contract_id to payroll_meal_allowance_configs
-- This migration adds contract_id column to payroll_meal_allowance_configs table
-- and ensures one meal allowance config per user per contract

-- Step 1: Add contract_id column (nullable initially for backfill)
ALTER TABLE payroll_meal_allowance_configs 
ADD COLUMN contract_id UUID;

-- Step 2: Add foreign key constraint
ALTER TABLE payroll_meal_allowance_configs 
ADD CONSTRAINT fk_payroll_meal_allowance_configs_contract_id 
FOREIGN KEY (contract_id) REFERENCES payroll_contracts(id) ON DELETE CASCADE;

-- Step 3: Backfill contract_id with the most recent active contract for each user
-- If multiple contracts are active today, choose the one with the most recent start_date
WITH user_contracts AS (
  SELECT DISTINCT 
    pmac.user_id,
    pc.id as contract_id,
    pc.start_date,
    ROW_NUMBER() OVER (
      PARTITION BY pmac.user_id 
      ORDER BY pc.start_date DESC
    ) as rn
  FROM payroll_meal_allowance_configs pmac
  JOIN payroll_contracts pc ON pc.user_id = pmac.user_id
  WHERE pmac.contract_id IS NULL
    AND pc.start_date <= CURRENT_DATE
    AND (pc.end_date IS NULL OR pc.end_date >= CURRENT_DATE)
)
UPDATE payroll_meal_allowance_configs 
SET contract_id = uc.contract_id
FROM user_contracts uc
WHERE payroll_meal_allowance_configs.user_id = uc.user_id
  AND payroll_meal_allowance_configs.contract_id IS NULL
  AND uc.rn = 1;

-- Step 4: Handle cases where no active contract exists - use the most recent contract
WITH user_contracts AS (
  SELECT DISTINCT 
    pmac.user_id,
    pc.id as contract_id,
    pc.start_date,
    ROW_NUMBER() OVER (
      PARTITION BY pmac.user_id 
      ORDER BY pc.start_date DESC
    ) as rn
  FROM payroll_meal_allowance_configs pmac
  JOIN payroll_contracts pc ON pc.user_id = pmac.user_id
  WHERE pmac.contract_id IS NULL
)
UPDATE payroll_meal_allowance_configs 
SET contract_id = uc.contract_id
FROM user_contracts uc
WHERE payroll_meal_allowance_configs.user_id = uc.user_id
  AND payroll_meal_allowance_configs.contract_id IS NULL
  AND uc.rn = 1;

-- Step 5: Make contract_id NOT NULL
ALTER TABLE payroll_meal_allowance_configs 
ALTER COLUMN contract_id SET NOT NULL;

-- Step 6: Create unique constraint to ensure one config per user per contract
ALTER TABLE payroll_meal_allowance_configs 
ADD CONSTRAINT uk_payroll_meal_allowance_configs_user_contract 
UNIQUE (user_id, contract_id);

-- Step 7: Create index for efficient queries
CREATE INDEX idx_payroll_meal_allowance_configs_user_contract 
ON payroll_meal_allowance_configs (user_id, contract_id);

-- Step 8: Add comment to document the constraint
COMMENT ON CONSTRAINT uk_payroll_meal_allowance_configs_user_contract ON payroll_meal_allowance_configs IS 
'Ensures each user can have only one meal allowance configuration per contract.';

COMMENT ON COLUMN payroll_meal_allowance_configs.contract_id IS 
'References the payroll contract this meal allowance configuration belongs to. Required field.';