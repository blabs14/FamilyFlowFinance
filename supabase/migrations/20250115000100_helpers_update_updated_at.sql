-- Helper: generic trigger function to update updated_at column
-- Some migrations expect this function to exist before creating triggers

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Generic trigger function to set updated_at to NOW() on row updates';