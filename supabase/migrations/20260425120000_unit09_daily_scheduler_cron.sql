-- supabase/migrations/20260425120000_unit09_daily_scheduler_cron.sql
-- Unit 09: Replace old crons with daily-scheduler at 03:00 UTC

BEGIN;

-- Unschedule old crons (ignore if they don't exist)
DO $$
BEGIN
  -- Remove recurrents_run cron
  IF EXISTS (SELECT FROM cron.job WHERE jobname = 'run-recurrents') THEN
    PERFORM cron.unschedule('run-recurrents');
  END IF;
  -- Remove reminders push cron (various possible names)
  IF EXISTS (SELECT FROM cron.job WHERE jobname = 'reminders-push') THEN
    PERFORM cron.unschedule('reminders-push');
  END IF;
  IF EXISTS (SELECT FROM cron.job WHERE jobname = 'reminders-push-cron') THEN
    PERFORM cron.unschedule('reminders-push-cron');
  END IF;
  -- Remove daily-scheduler if already exists (idempotent)
  IF EXISTS (SELECT FROM cron.job WHERE jobname = 'daily-scheduler') THEN
    PERFORM cron.unschedule('daily-scheduler');
  END IF;
END;
$$;

-- Wrapper function for pg_cron (same pattern as existing scheduler)
CREATE OR REPLACE FUNCTION public.run_daily_scheduler_now()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := current_setting('app.settings.edge_base_url', true) || '/functions/v1/daily-scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_daily_scheduler_now() TO postgres;

-- Schedule daily-scheduler at 03:00 UTC
SELECT cron.schedule(
  'daily-scheduler',
  '0 3 * * *',
  'SELECT public.run_daily_scheduler_now()'
);

COMMIT;
