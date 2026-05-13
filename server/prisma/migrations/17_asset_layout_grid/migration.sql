-- Lane-grid layout for the relationships canvas. Adds two columns to `assets`:
--   layout_order        Float — sortable rank within parent's lane (lower = first)
--   layout_orientation  enum  — AUTO follows depth-alternation, H/V overrides
-- Existing rows backfill via row_number() per parent so the first render
-- preserves current creation-order grouping.

CREATE TYPE "layout_orientation" AS ENUM ('AUTO', 'HORIZONTAL', 'VERTICAL');

ALTER TABLE "assets"
  ADD COLUMN "layout_order"       DOUBLE PRECISION    NOT NULL DEFAULT 0,
  ADD COLUMN "layout_orientation" "layout_orientation" NOT NULL DEFAULT 'AUTO';

UPDATE "assets" a
SET "layout_order" = sub.rn::float
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "parent_id" ORDER BY "created_at") AS rn
  FROM "assets"
) sub
WHERE a."id" = sub."id";

CREATE INDEX "assets_tenant_id_parent_id_layout_order_idx"
  ON "assets" ("tenant_id", "parent_id", "layout_order");
