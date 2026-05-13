-- Add MONITORS to relationship_type enum so PROTECTIVE assets can express
-- passive observation (CCTV, sensors) distinct from active control (PROTECTS).
-- Kept in its own migration to avoid mixing ALTER TYPE ADD VALUE with statements
-- that reference the new value in the same transaction.
ALTER TYPE "relationship_type" ADD VALUE IF NOT EXISTS 'MONITORS';
