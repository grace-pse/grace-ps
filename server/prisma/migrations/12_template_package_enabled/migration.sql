-- Add `enabled` flag to template_packages so admins can disable a package
-- (e.g. after forking, disable the original to prevent duplicate suggestions in the wizard).
ALTER TABLE "template_packages" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
