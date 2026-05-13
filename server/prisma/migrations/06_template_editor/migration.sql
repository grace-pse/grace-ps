-- Template Library Editor — adds the admin-editable surface of the library:
-- attribute JSON fields for future user-custom-fields on threat/CM templates,
-- updatedAt + updatedBy audit columns across all template models,
-- and a reserved custom_field_schema column on packages for a future typed
-- form generator.

-- ── AlterTable: template_packages ──────────────────────────
ALTER TABLE "template_packages"
  ADD COLUMN "custom_field_schema" JSONB,
  ADD COLUMN "updated_by"          UUID;

ALTER TABLE "template_packages"
  ADD CONSTRAINT "template_packages_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── AlterTable: template_modules ───────────────────────────
ALTER TABLE "template_modules"
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "template_modules"
  ADD CONSTRAINT "template_modules_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── AlterTable: asset_templates ────────────────────────────
ALTER TABLE "asset_templates"
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "asset_templates"
  ADD CONSTRAINT "asset_templates_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── AlterTable: threat_templates ───────────────────────────
ALTER TABLE "threat_templates"
  ADD COLUMN "attributes" JSONB DEFAULT '{}',
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "threat_templates"
  ADD CONSTRAINT "threat_templates_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── AlterTable: countermeasure_templates ───────────────────
ALTER TABLE "countermeasure_templates"
  ADD COLUMN "attributes" JSONB DEFAULT '{}',
  ADD COLUMN "updated_by" UUID,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "countermeasure_templates"
  ADD CONSTRAINT "countermeasure_templates_updated_by_fkey"
  FOREIGN KEY ("updated_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
