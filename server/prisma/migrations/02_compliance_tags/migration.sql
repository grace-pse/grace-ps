-- Block D — Compliance Tags
-- Kept as TEXT[] (app-layer enum) so tags can evolve without DB migrations.
ALTER TABLE "threats"
  ADD COLUMN "compliance_tags" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "action_plans"
  ADD COLUMN "compliance_tags" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX "threats_compliance_tags_idx" ON "threats" USING GIN ("compliance_tags");
CREATE INDEX "action_plans_compliance_tags_idx" ON "action_plans" USING GIN ("compliance_tags");
