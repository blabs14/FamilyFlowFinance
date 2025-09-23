-- Fix goal_progress view to use 'id' instead of 'goal_id' for consistency
-- This ensures the view returns the same column name as the goals table

-- Drop the existing view
DROP VIEW IF EXISTS "public"."goal_progress";

-- Recreate the view with 'id' instead of 'goal_id'
CREATE OR REPLACE VIEW "public"."goal_progress" AS 
SELECT 
    g.id,  -- Changed from 'g.id AS goal_id' to just 'g.id'
    g.nome,
    g.valor_objetivo,
    COALESCE(sum(ga.valor), (0)::numeric) AS total_alocado,
    round(((COALESCE(sum(ga.valor), (0)::numeric) / NULLIF(g.valor_objetivo, (0)::numeric)) * (100)::numeric), 2) AS progresso_percentual
FROM goals g
LEFT JOIN goal_allocations ga ON (ga.goal_id = g.id)
GROUP BY g.id, g.nome, g.valor_objetivo;

-- Grant permissions
GRANT SELECT ON "public"."goal_progress" TO authenticated;
GRANT SELECT ON "public"."goal_progress" TO service_role;