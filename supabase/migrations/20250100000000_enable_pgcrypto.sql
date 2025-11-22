-- Ensure pgcrypto extension is available early
-- Required for gen_random_uuid() defaults used throughout the schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;