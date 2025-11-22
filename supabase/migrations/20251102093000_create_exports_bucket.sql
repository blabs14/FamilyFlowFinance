-- Create private Storage bucket 'exports' with 10MB file size limit (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'exports'
  ) THEN
    PERFORM storage.create_bucket('exports', false, 10485760);
  ELSE
    -- Ensure configuration stays as expected (private, 10MB limit)
    PERFORM storage.update_bucket('exports', false, 10485760);
  END IF;
END $$;

-- NOTE:
-- - Bucket remains PRIVATE; access via signed URLs only (generated server-side).
-- - Allowed MIME types should be enforced at application level when uploading (CSV/PDF).
-- - Consider lifecycle policies via housekeeping tasks if needed (not set here).