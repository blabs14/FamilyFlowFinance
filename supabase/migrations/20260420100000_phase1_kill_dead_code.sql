-- Phase 1: eliminar tabelas mortas
-- goal_deallocations nunca existiu como tabela (era função sobre goal_allocations)
-- goal_contributions e accounts.is_goals são diferidos para Phase 2

set local search_path = public;

-- Eliminar fixed_expenses (não referenciada por nenhuma FK)
DROP TABLE IF EXISTS public.fixed_expenses CASCADE;

-- Defensivo: goal_deallocations nunca existiu mas o spec menciona-a
DROP TABLE IF EXISTS public.goal_deallocations CASCADE;
