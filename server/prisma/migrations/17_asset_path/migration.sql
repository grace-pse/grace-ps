-- Add MQTT-style path columns to assets.
-- pathSegment is the asset's own slug (deduped against siblings).
-- path is the slash-joined chain root → asset.
ALTER TABLE "assets"
  ADD COLUMN "path_segment" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "path"         TEXT NOT NULL DEFAULT '';

-- Slug helper. Lowercase, transliterate via unaccent if available, replace
-- non-alnum runs with '-', trim leading/trailing '-'. Falls back to 'asset'
-- when the result is empty (purely-symbolic names).
CREATE OR REPLACE FUNCTION pg_temp.csmp_slugify(input TEXT) RETURNS TEXT AS $$
DECLARE
  s TEXT;
BEGIN
  s := lower(coalesce(input, ''));
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '^-+|-+$', '', 'g');
  IF s = '' THEN s := 'asset'; END IF;
  RETURN s;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill: for each tenant, walk the parent_id tree and build paths.
-- Sibling slug collisions resolved by created_at order: oldest keeps the bare
-- slug, the rest get '-2', '-3', ...
WITH RECURSIVE
  ranked AS (
    SELECT
      a.id,
      a.tenant_id,
      a.parent_id,
      a.name,
      pg_temp.csmp_slugify(a.name) AS base_slug,
      row_number() OVER (
        PARTITION BY a.tenant_id, a.parent_id, pg_temp.csmp_slugify(a.name)
        ORDER BY a.created_at, a.id
      ) AS dup_rank
    FROM assets a
  ),
  segs AS (
    SELECT
      id, tenant_id, parent_id,
      CASE WHEN dup_rank = 1 THEN base_slug
           ELSE base_slug || '-' || dup_rank::text END AS seg
    FROM ranked
  ),
  walk AS (
    SELECT s.id, s.tenant_id, s.parent_id, s.seg AS path_segment, s.seg AS path
    FROM segs s
    WHERE s.parent_id IS NULL
    UNION ALL
    SELECT c.id, c.tenant_id, c.parent_id, c.seg, w.path || '/' || c.seg
    FROM segs c
    JOIN walk w ON c.parent_id = w.id
  )
UPDATE assets a
SET path_segment = w.path_segment,
    path         = w.path
FROM walk w
WHERE a.id = w.id;

-- Sibling uniqueness — bijective path guarantee. Two partial unique indexes
-- because Postgres treats NULL parent_id as distinct from itself.
CREATE UNIQUE INDEX "assets_tenant_parent_segment_uq"
  ON "assets" ("tenant_id", "parent_id", "path_segment")
  WHERE "parent_id" IS NOT NULL;

CREATE UNIQUE INDEX "assets_tenant_root_segment_uq"
  ON "assets" ("tenant_id", "path_segment")
  WHERE "parent_id" IS NULL;

-- Prefix-search index.
CREATE INDEX "assets_tenant_id_path_idx" ON "assets" ("tenant_id", "path");
