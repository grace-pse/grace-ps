-- Block L — Countermeasure Template Library
-- Adds CountermeasureTemplate (shipped inside TemplateModule hierarchy alongside
-- AssetTemplate / ThreatTemplate) and the ThreatTemplateCountermeasure junction,
-- replacing the loose recommended_countermeasures JSON column on threat_templates.
-- Tenant countermeasures gain a nullable source_template_id FK for traceability.

-- ── CreateTable: countermeasure_templates ──────────────────
CREATE TABLE "countermeasure_templates" (
  "id"                    UUID              NOT NULL DEFAULT gen_random_uuid(),
  "module_id"             UUID              NOT NULL,
  "slug"                  VARCHAR(150)      NOT NULL,
  "name"                  VARCHAR(255)      NOT NULL,
  "description"           TEXT,
  "shape_category"        "shape_category"  NOT NULL,
  "pps_functions"         "pps_function"[],
  "domain"                "protection_domain" NOT NULL,
  "default_tear_strategy" "tear_strategy",
  "default_effectiveness" "vulnerability_rating",
  "typical_cost_estimate" DECIMAL(14,2),
  "typical_annual_cost"   DECIMAL(14,2),
  "tags"                  TEXT[] DEFAULT ARRAY[]::TEXT[],
  "csmp_unit_reference"   VARCHAR(64),
  "created_at"            TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "countermeasure_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "countermeasure_templates_module_id_slug_key"
  ON "countermeasure_templates" ("module_id", "slug");
CREATE INDEX "countermeasure_templates_shape_category_idx"
  ON "countermeasure_templates" ("shape_category");
CREATE INDEX "countermeasure_templates_domain_idx"
  ON "countermeasure_templates" ("domain");

ALTER TABLE "countermeasure_templates"
  ADD CONSTRAINT "countermeasure_templates_module_id_fkey"
  FOREIGN KEY ("module_id") REFERENCES "template_modules"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CreateTable: threat_template_countermeasures (junction) ─
CREATE TABLE "threat_template_countermeasures" (
  "threat_template_id"         UUID        NOT NULL,
  "countermeasure_template_id" UUID        NOT NULL,
  "relevance"                  "relevance" NOT NULL DEFAULT 'MEDIUM',
  "rationale"                  TEXT,

  CONSTRAINT "threat_template_countermeasures_pkey"
    PRIMARY KEY ("threat_template_id", "countermeasure_template_id")
);

ALTER TABLE "threat_template_countermeasures"
  ADD CONSTRAINT "threat_template_countermeasures_threat_template_id_fkey"
  FOREIGN KEY ("threat_template_id") REFERENCES "threat_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "threat_template_countermeasures"
  ADD CONSTRAINT "threat_template_countermeasures_countermeasure_template_fk"
  FOREIGN KEY ("countermeasure_template_id") REFERENCES "countermeasure_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AlterTable: countermeasures — add source_template_id ───
ALTER TABLE "countermeasures"
  ADD COLUMN "source_template_id" UUID;

ALTER TABLE "countermeasures"
  ADD CONSTRAINT "countermeasures_source_template_id_fkey"
  FOREIGN KEY ("source_template_id") REFERENCES "countermeasure_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── AlterTable: threat_templates — drop legacy JSON ────────
-- The freeform JSON column is superseded by the structured junction above.
-- Re-seed the Banking & Finance pack after this migration applies to populate
-- countermeasure_templates + threat_template_countermeasures.
ALTER TABLE "threat_templates"
  DROP COLUMN "recommended_countermeasures";
