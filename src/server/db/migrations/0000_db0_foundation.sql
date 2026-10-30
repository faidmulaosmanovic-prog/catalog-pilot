-- DB-0: database foundation
-- Enables UUID generation used by later domain tables (DB-1+).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
