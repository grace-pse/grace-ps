import type { Prisma } from '@prisma/client';
import type {
  AssetTemplateExport,
  CountermeasureTemplateExport,
  ModuleExport,
  PackageBundleContent,
  PackageExport,
  ThreatTemplateExport,
} from '@csmp/shared';
import { TEMPLATE_SCHEMA_VERSION } from './admin-schema.js';

type FullPackage = Prisma.TemplatePackageGetPayload<{
  include: {
    modules: {
      include: {
        assetTemplates: true;
        threatTemplates: true;
        countermeasureTemplates: true;
      };
      orderBy: { sortOrder: 'asc' };
    };
  };
}>;

export function serializeAssetTemplate(t: {
  slug: string;
  name: string;
  assetType: string;
  category: string;
  defaultCriticality: number;
  description: string | null;
  parentSlug: string | null;
  tags: string[];
  attributes: Prisma.JsonValue | null;
}): AssetTemplateExport {
  return {
    slug: t.slug,
    name: t.name,
    assetType: t.assetType,
    category: t.category,
    defaultCriticality: t.defaultCriticality,
    description: t.description,
    parentSlug: t.parentSlug,
    tags: t.tags,
    attributes: (t.attributes ?? {}) as Record<string, unknown>,
  };
}

export function serializeThreatTemplate(t: {
  slug: string;
  scenarioName: string;
  adversaryType: string;
  actionType: string;
  adversaryProfile: Prisma.JsonValue | null;
  typicalActions: string[];
  targetAssetTypes: string[];
  indicators: string[];
  suggestedLikelihood: number | null;
  csmpUnitReference: string | null;
  attributes: Prisma.JsonValue | null;
}): ThreatTemplateExport {
  return {
    slug: t.slug,
    scenarioName: t.scenarioName,
    adversaryType: t.adversaryType,
    actionType: t.actionType,
    adversaryProfile: (t.adversaryProfile ?? null) as Record<string, unknown> | null,
    typicalActions: t.typicalActions,
    targetAssetTypes: t.targetAssetTypes,
    indicators: t.indicators,
    suggestedLikelihood: t.suggestedLikelihood,
    csmpUnitReference: t.csmpUnitReference,
    attributes: (t.attributes ?? {}) as Record<string, unknown>,
  };
}

export function serializeCountermeasureTemplate(t: {
  slug: string;
  name: string;
  description: string | null;
  shapeCategory: string;
  ppsFunctions: string[];
  domain: string;
  defaultTearStrategy: string | null;
  defaultEffectiveness: string | null;
  typicalCostEstimate: Prisma.Decimal | null;
  typicalAnnualCost: Prisma.Decimal | null;
  tags: string[];
  csmpUnitReference: string | null;
  attributes: Prisma.JsonValue | null;
}): CountermeasureTemplateExport {
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    shapeCategory: t.shapeCategory,
    ppsFunctions: t.ppsFunctions,
    domain: t.domain,
    defaultTearStrategy: t.defaultTearStrategy,
    defaultEffectiveness: t.defaultEffectiveness,
    typicalCostEstimate: t.typicalCostEstimate != null ? Number(t.typicalCostEstimate) : null,
    typicalAnnualCost: t.typicalAnnualCost != null ? Number(t.typicalAnnualCost) : null,
    tags: t.tags,
    csmpUnitReference: t.csmpUnitReference,
    attributes: (t.attributes ?? {}) as Record<string, unknown>,
  };
}

export function serializePackage(p: {
  slug: string;
  name: string;
  industry: string | null;
  version: string;
  regionScope: string | null;
  description: string | null;
  complianceRefs: string[];
  customFieldSchema: Prisma.JsonValue | null;
}): PackageExport {
  return {
    slug: p.slug,
    name: p.name,
    industry: p.industry,
    version: p.version,
    regionScope: p.regionScope,
    description: p.description,
    complianceRefs: p.complianceRefs,
    customFieldSchema: (p.customFieldSchema ?? null) as Record<string, unknown> | null,
  };
}

export function serializeModule(
  m: FullPackage['modules'][number],
  assetThreatLinks: Array<{ assetSlug: string; threatSlug: string; relevance: string; rationale: string | null }>,
  threatCmLinks: Array<{ threatSlug: string; cmSlug: string; relevance: string; rationale: string | null }>,
): ModuleExport {
  return {
    slug: m.slug,
    name: m.name,
    description: m.description,
    icon: m.icon,
    sortOrder: m.sortOrder,
    assetTemplates: m.assetTemplates.map(serializeAssetTemplate),
    threatTemplates: m.threatTemplates.map(serializeThreatTemplate),
    countermeasureTemplates: m.countermeasureTemplates.map(serializeCountermeasureTemplate),
    assetThreatLinks,
    threatCountermeasureLinks: threatCmLinks,
  };
}

export function envelope<K extends string, C>(kind: K, content: C, origin?: string) {
  return {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    ...(origin ? { sourceOrigin: origin } : {}),
    content,
  };
}

export function packageBundle(
  pkg: Parameters<typeof serializePackage>[0],
  modules: ModuleExport[],
): PackageBundleContent {
  return { package: serializePackage(pkg), modules };
}

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export async function nextAvailableSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = `${base}-imported-1`;
  let i = 1;
  while (await exists(candidate)) {
    i += 1;
    candidate = `${base}-imported-${i}`;
  }
  return candidate;
}
