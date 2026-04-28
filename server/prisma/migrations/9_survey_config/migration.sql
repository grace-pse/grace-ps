-- Migration 9: per-tenant survey landscape
-- Adds asset_type_survey_defaults (per-tenant default survey type/template per asset type)
-- and tenant_survey_configs (enabled survey types + custom-type definitions per tenant).

CREATE TABLE "asset_type_survey_defaults" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "asset_type" "asset_type" NOT NULL,
  "survey_type" "survey_type" NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "template_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_type_survey_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_type_survey_defaults_tenant_id_asset_type_survey_type_key"
  ON "asset_type_survey_defaults" ("tenant_id", "asset_type", "survey_type");

CREATE INDEX "asset_type_survey_defaults_tenant_id_asset_type_idx"
  ON "asset_type_survey_defaults" ("tenant_id", "asset_type");

ALTER TABLE "asset_type_survey_defaults"
  ADD CONSTRAINT "asset_type_survey_defaults_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_type_survey_defaults"
  ADD CONSTRAINT "asset_type_survey_defaults_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "survey_templates" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "tenant_survey_configs" (
  "tenant_id" UUID NOT NULL,
  "enabled_types" TEXT[],
  "custom_types" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_survey_configs_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "tenant_survey_configs"
  ADD CONSTRAINT "tenant_survey_configs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
