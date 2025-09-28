-- Remove duplicate balance updates that cause double accounting
-- 
-- PROBLEM: The system has double accounting because:
-- 1. Trigger on goal_allocations calls update_goals_account_balance which does UPDATE accounts SET saldo
-- 2. Transactions created by functions affect the account_balances_v1 view calculation
-- 
-- SOLUTION: Remove the trigger and function because account_balances_v1 view 
-- already correctly calculates balances based on transactions only.

-- Remove the trigger that automatically updates account balances
DROP TRIGGER IF EXISTS update_goals_balance_trigger ON goal_allocations;

-- Remove the trigger function
DROP FUNCTION IF EXISTS trigger_update_goals_account_balance();

-- Remove the function that directly updates account balances
DROP FUNCTION IF EXISTS update_goals_account_balance(uuid, uuid);

-- Reset all account balances to 0 since they should be calculated by the view
-- This ensures no legacy direct balance updates interfere with the transaction-based calculation
UPDATE accounts 
SET saldo = 0 
WHERE tipo IN ('objetivos', 'corrente', 'poupança', 'cartão de crédito');

-- Note: From now on, all account balances will be calculated exclusively by the 
-- account_balances_v1 view based on transactions. This eliminates double accounting.