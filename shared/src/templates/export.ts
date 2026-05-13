// Template library export/import envelope — wire-shape shared by server and client.
// Zod validation lives on the server (server/src/modules/templates/admin-schema.ts)
// because the shared package is type-only.

export const TEMPLATE_SCHEMA_VERSION = '1.0' as const;

export type TemplateExportKind =
  | 'package'
  | 'module'
  | 'asset-template'
  | 'threat-template'
  | 'countermeasure-template';

export interface TemplateExportEnvelope<C> {
  schemaVersion: typeof TEMPLATE_SCHEMA_VERSION;
  kind: TemplateExportKind;
  exportedAt: string;
  sourceOrigin?: string;
  content: C;
}

// Per-entity content payloads. `attributes` is a free-form JSON bag that
// round-trips verbatim — this is the user-custom-fields channel.

export interface AssetTemplateExport {
  slug: string;
  name: string;
  assetType: string;
  category: string;
  defaultCriticality: number;
  /** Subtype's recommended PROTECTED / PROTECTIVE / DUAL role; null = no opinion. */
  defaultAssetRole: string | null;
  description: string | null;
  parentSlug: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
}

export interface ThreatTemplateExport {
  slug: string;
  scenarioName: string;
  adversaryType: string;
  actionType: string;
  adversaryProfile: Record<string, unknown> | null;
  typicalActions: string[];
  targetAssetTypes: string[];
  indicators: string[];
  suggestedLikelihood: number | null;
  csmpUnitReference: string | null;
  attributes: Record<string, unknown>;
}

export interface CountermeasureTemplateExport {
  slug: string;
  name: string;
  description: string | null;
  shapeCategory: string;
  ppsFunctions: string[];
  domain: string;
  defaultTearStrategy: string | null;
  defaultEffectiveness: string | null;
  typicalCostEstimate: number | null;
  typicalAnnualCost: number | null;
  tags: string[];
  csmpUnitReference: string | null;
  attributes: Record<string, unknown>;
}

export interface ModuleExport {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  assetTemplates: AssetTemplateExport[];
  threatTemplates: ThreatTemplateExport[];
  countermeasureTemplates: CountermeasureTemplateExport[];
  assetThreatLinks: Array<{
    assetSlug: string;
    threatSlug: string;
    relevance: string;
    rationale: string | null;
  }>;
  threatCountermeasureLinks: Array<{
    threatSlug: string;
    cmSlug: string;
    relevance: string;
    rationale: string | null;
  }>;
}

/**
 * Per-package definitions of fields that operators fill in on assets,
 * threats, etc. The asset form renders inputs for fields with
 * appliesTo === 'asset' and persists values into Asset.metadata.customFields.
 *
 * Wire-format note: legacy packages may have stored `null` or `{}`. The
 * server's input validator normalizes those to `[]` on write, so new code
 * can treat it as "array of CustomFieldDef" by inserting a runtime guard
 * (`Array.isArray(value) ? value : []`).
 */
export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';
export type CustomFieldAppliesTo = 'asset' | 'threat' | 'assessment' | 'countermeasure';
export interface CustomFieldDef {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  appliesTo: CustomFieldAppliesTo;
  helpText?: string;
  sortOrder?: number;
}

export interface PackageExport {
  slug: string;
  name: string;
  industry: string | null;
  version: string;
  regionScope: string | null;
  description: string | null;
  complianceRefs: string[];
  customFieldSchema: CustomFieldDef[] | null;
}

export interface PackageBundleContent {
  package: PackageExport;
  modules: ModuleExport[];
}

export type OnConflict = 'skip' | 'overwrite' | 'rename';

export interface ImportResult {
  created: string[];
  updated: string[];
  skipped: string[];
  renamed: Array<{ from: string; to: string }>;
}
