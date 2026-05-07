import { api } from './api';
import type {
  AssetSummary, AssetDetail, AssetCreateInput, AssetUpdateInput,
  AssetGraphResponse, AssetTreeResponse,
  AssetRelationshipSummary, AssetRelationshipCreateInput, AssetRelationshipUpdateInput,
  ClusterSummary, ClusterDetail, ClusterCreateInput,
  TemplatePackage, TemplateModule, AssetTemplateSummary, AssetTemplateDetail,
  AssetType, AssetCategory, AssetStatus, AssetRole, OperationalStatus, Relevance,
  ProtectiveCoverageResponse,
  AssessmentSummary, AssessmentDetail, AssessmentCreateInput, AssessmentStatus, ReviewStatus,
  EvidenceBasis,
  ThreatSummary, ThreatCreateInput, ImpactBreakdown, VulnerabilityRating, TearStrategy,
  ThreatCatalogItem, ThreatListParams, ThreatListResponse,
  ActionPlan, ActionPlanCreateInput, ActionPlanUpdateInput, SuggestedThreat,
  ComplianceTag, SnapshotSummary, SnapshotDetail,
  AssessmentSummaryResponse,
  Recommendation, RecommendationInput,
  CountermeasureSummary, CountermeasureDetail, CountermeasureCreateInput,
  CountermeasureUpdateInput, CountermeasureListQuery,
  CountermeasureTemplateSummary, CountermeasureTemplateDetail, CountermeasureTemplateListQuery,
  SurveyTemplateSummary, SurveyTemplateDetail,
  SurveyTemplateCreateInput, SurveyTemplateUpdateInput,
  SurveyResponseSummary, SurveyResponseDetail,
  SurveyResponseCreateInput, SurveyResponseUpdateInput,
  SurveyResponseFromScopeInput,
  SurveyType, SurveyStatus,
  AssessmentSurveyLink, AssessmentSurveyLinkCreateInput,
  SurveyQuestionLibraryItem, SurveyQuestionCreateInput, SurveyQuestionUpdateInput,
  TemplateQuestionLink, TemplateQuestionLinkUpsertInput,
  QuestionTemplateAttachments,
  ClusterSurveyScopeSummary, ClusterSurveyScopeDetail,
  ClusterSurveyScopeCreateInput, ClusterSurveyScopeUpdateInput,
  ScopeStatus, ScopeItemAddInput, ScopeItemUpdateInput,
  OrgSummary, UserSummary, UserDetail, UserCreateInput, UserUpdateInput,
} from './csmp-types';
import type { Role } from '../stores/auth';
import type { AppearanceSettings } from './appearance-defaults';

// ─── ASSETS ───────────────────────────────────────────────

export interface AssetListParams {
  search?: string;
  assetType?: AssetType;
  category?: AssetCategory;
  status?: AssetStatus;
  assetRole?: AssetRole;
  operationalStatus?: OperationalStatus;
  degradedControlPosture?: boolean;
  parentId?: string | 'none';
  /** MQTT-style path filter: prefix ("site-a/bldg-1"), `+` for a single
   * segment wildcard, `#` as the terminal multi-level wildcard. */
  path?: string;
  page?: number;
  pageSize?: number;
}

export interface AssetListResponse {
  items: AssetSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const assetsApi = {
  list: (params: AssetListParams = {}) =>
    api.get('assets', { searchParams: cleanParams(params) }).json<AssetListResponse>(),
  get: (id: string) => api.get(`assets/${id}`).json<AssetDetail>(),
  create: (data: AssetCreateInput) => api.post('assets', { json: data }).json<AssetSummary>(),
  update: (id: string, data: AssetUpdateInput) =>
    api.patch(`assets/${id}`, { json: data }).json<AssetSummary>(),
  remove: (id: string) => api.delete(`assets/${id}`),
  clone: (id: string, body: { name?: string }) =>
    api.post(`assets/${id}/clone`, { json: body }).json<AssetSummary>(),

  graph: () => api.get('assets/graph').json<AssetGraphResponse>(),
  tree: (params: { path?: string } = {}) =>
    api.get('assets/tree', { searchParams: cleanParams(params) }).json<AssetTreeResponse>(),
  createRelationship: (data: AssetRelationshipCreateInput) =>
    api.post('assets/relationships', { json: data }).json<AssetRelationshipSummary>(),
  updateRelationship: (id: string, data: AssetRelationshipUpdateInput) =>
    api.patch(`assets/relationships/${id}`, { json: data }).json<AssetRelationshipSummary>(),
  removeRelationship: (id: string) => api.delete(`assets/relationships/${id}`),

  protectiveCoverage: (id: string) =>
    api.get(`assets/${id}/protective-coverage`).json<ProtectiveCoverageResponse>(),

  // Per-package custom-field schema for the asset form. Filtered server-side
  // to enabled packages and appliesTo='asset'. The form persists values into
  // Asset.metadata.customFields[packageSlug][fieldKey].
  getCustomFieldSchema: () =>
    api.get('assets/custom-field-schema').json<AssetCustomFieldSchemaResponse>(),
};

export interface AssetCustomFieldRenderDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  options?: string[];
  required?: boolean;
  helpText?: string;
  sortOrder?: number;
}
export interface AssetCustomFieldSchemaResponse {
  packages: Array<{ slug: string; name: string; fields: AssetCustomFieldRenderDef[] }>;
}

// ─── CLUSTERS ──────────────────────────────────────────────

export const clustersApi = {
  list: () =>
    api.get('clusters').json<{ items: ClusterSummary[]; total: number }>(),
  get: (id: string) => api.get(`clusters/${id}`).json<ClusterDetail>(),
  create: (data: ClusterCreateInput) =>
    api.post('clusters', { json: data }).json<ClusterSummary>(),
  update: (id: string, data: Partial<ClusterCreateInput>) =>
    api.patch(`clusters/${id}`, { json: data }).json<ClusterSummary>(),
  remove: (id: string) => api.delete(`clusters/${id}`),
  clone: (id: string, body: { name?: string }) =>
    api.post(`clusters/${id}/clone`, { json: body }).json<ClusterSummary>(),
};

// ─── TEMPLATES ────────────────────────────────────────────

export interface TemplateListParams {
  search?: string;
  packageSlug?: string;
  moduleSlug?: string;
  assetType?: AssetType;
  category?: AssetCategory;
  /**
   * When true (server default), only templates from enabled packages are
   * returned. The asset-form subtype picker uses this so admins can hide
   * a package without breaking already-linked assets. Pass false from admin
   * tooling to see everything.
   */
  enabledOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface TemplateListResponse {
  items: AssetTemplateSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const templatesApi = {
  listPackages: () =>
    api.get('templates/packages').json<{ items: TemplatePackage[] }>(),
  listModules: (packageSlug: string) =>
    api.get(`templates/packages/${packageSlug}/modules`).json<{
      items: TemplateModule[];
      package: TemplatePackage;
    }>(),
  listAssetTemplates: (params: TemplateListParams = {}) =>
    api.get('templates/asset-templates', { searchParams: cleanParams(params) })
      .json<TemplateListResponse>(),
  getAssetTemplate: (id: string) =>
    api.get(`templates/asset-templates/${id}`).json<AssetTemplateDetail>(),
};

export const countermeasureTemplatesApi = {
  list: (params: CountermeasureTemplateListQuery = {}) =>
    api.get('templates/countermeasure-templates', { searchParams: cleanParams(params) })
      .json<{
        items: CountermeasureTemplateSummary[];
        total: number;
        page: number;
        pageSize: number;
      }>(),
  get: (id: string) =>
    api.get(`templates/countermeasure-templates/${id}`).json<CountermeasureTemplateDetail>(),
  listForThreatTemplate: (threatTemplateId: string) =>
    api.get(`templates/threat-templates/${threatTemplateId}/countermeasures`).json<{
      items: Array<{
        relevance: Relevance;
        rationale: string | null;
        countermeasureTemplate: CountermeasureTemplateSummary;
      }>;
    }>(),
};

// ─── ASSESSMENTS ──────────────────────────────────────────

export interface AssessmentListParams {
  search?: string;
  status?: AssessmentStatus;
  reviewStatus?: ReviewStatus;
  leadAssessorId?: string;
  complianceTag?: ComplianceTag;
  page?: number;
  pageSize?: number;
}

export interface AssessmentListResponse {
  items: AssessmentSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export const assessmentsApi = {
  list: (params: AssessmentListParams = {}) =>
    api.get('assessments', { searchParams: cleanParams(params) }).json<AssessmentListResponse>(),
  get: (id: string) => api.get(`assessments/${id}`).json<AssessmentDetail>(),
  create: (data: AssessmentCreateInput) => api.post('assessments', { json: data }).json<AssessmentSummary>(),
  update: (id: string, data: {
    title?: string;
    assessmentType?: string;
    approverId?: string | null;
    version?: string;
    period?: string | null;
    scopeDescription?: string | null;
    evidenceBasis?: EvidenceBasis;
    expertJustification?: string | null;
  }) =>
    api.patch(`assessments/${id}`, { json: data }).json<AssessmentSummary>(),
  remove: (id: string) => api.delete(`assessments/${id}`),
  advance: (id: string) => api.post(`assessments/${id}/advance`).json<{
    id: string; status: AssessmentStatus; currentStep: number; reviewStatus: ReviewStatus;
  }>(),
  review: (id: string, action: 'approve' | 'reject', notes = '') =>
    api.post(`assessments/${id}/review`, { json: { action, notes } }).json<{
      id: string; status: AssessmentStatus; currentStep: number; reviewStatus: ReviewStatus;
    }>(),

  // Threats
  suggestedThreats: (assessmentId: string) =>
    api.get(`assessments/${assessmentId}/suggested-threats`).json<{ items: SuggestedThreat[] }>(),
  addThreatFromTemplate: (assessmentId: string, targetAssetId: string, threatTemplateId: string) =>
    api.post(`assessments/${assessmentId}/threats/from-template`, {
      json: { targetAssetId, threatTemplateId },
    }).json<ThreatSummary>(),
  addThreat: (assessmentId: string, data: ThreatCreateInput) =>
    api.post(`assessments/${assessmentId}/threats`, { json: data }).json<ThreatSummary>(),
  updateThreat: (assessmentId: string, threatId: string, data: Partial<ThreatCreateInput>) =>
    api.patch(`assessments/${assessmentId}/threats/${threatId}`, { json: data }).json<ThreatSummary>(),
  removeThreat: (assessmentId: string, threatId: string) =>
    api.delete(`assessments/${assessmentId}/threats/${threatId}`),
  rateLikelihood: (assessmentId: string, threatId: string, likelihoodScore: number, likelihoodRationale: string) =>
    api.post(`assessments/${assessmentId}/threats/${threatId}/likelihood`, {
      json: { likelihoodScore, likelihoodRationale },
    }).json<ThreatSummary>(),
  rateImpact: (assessmentId: string, threatId: string, impactBreakdown: ImpactBreakdown, impactRationale: string) =>
    api.post(`assessments/${assessmentId}/threats/${threatId}/impact`, {
      json: { impactBreakdown, impactRationale },
    }).json<ThreatSummary>(),
  rateVulnerability: (assessmentId: string, threatId: string, vulnerabilityRating: VulnerabilityRating, vulnerabilityRationale: string) =>
    api.post(`assessments/${assessmentId}/threats/${threatId}/vulnerability`, {
      json: { vulnerabilityRating, vulnerabilityRationale },
    }).json<ThreatSummary>(),
  setTear: (assessmentId: string, threatId: string, tearStrategy: TearStrategy, alarpJustification: string | null) =>
    api.post(`assessments/${assessmentId}/threats/${threatId}/tear`, {
      json: { tearStrategy, alarpJustification },
    }).json<ThreatSummary>(),

  // Returns the PDF report as a Blob for client-side download trigger.
  downloadReport: (id: string) =>
    api.get(`assessments/${id}/report.pdf`, { timeout: 60_000 }).blob(),

  // Executive summary for finished assessments.
  getSummary: (id: string) =>
    api.get(`assessments/${id}/summary`).json<AssessmentSummaryResponse>(),

  // Snapshots
  listSnapshots: (assessmentId: string) =>
    api.get(`assessments/${assessmentId}/snapshots`).json<{ items: SnapshotSummary[] }>(),
  getSnapshot: (assessmentId: string, snapshotId: string) =>
    api.get(`assessments/${assessmentId}/snapshots/${snapshotId}`).json<SnapshotDetail>(),
  captureSnapshot: (assessmentId: string, note: string) =>
    api.post(`assessments/${assessmentId}/snapshots`, { json: { note } }).json<SnapshotSummary>(),
};

// ─── USERS ─ moved below alongside org settings (search for `usersApi`) ──

export type { UserSummary } from './csmp-types';

// ─── RECOMMENDATIONS ──────────────────────────────────────

export const recommendationsApi = {
  listForAssessment: (assessmentId: string) =>
    api.get(`assessments/${assessmentId}/recommendations`).json<{ items: Recommendation[] }>(),
  create: (assessmentId: string, data: RecommendationInput) =>
    api.post(`assessments/${assessmentId}/recommendations`, { json: data }).json<Recommendation>(),
  update: (recId: string, data: Partial<RecommendationInput>) =>
    api.patch(`recommendations/${recId}`, { json: data }).json<Recommendation>(),
  remove: (recId: string) => api.delete(`recommendations/${recId}`),
};

// ─── ACTION PLANS ─────────────────────────────────────────

export const actionPlansApi = {
  listForAssessment: (assessmentId: string) =>
    api.get(`assessments/${assessmentId}/action-plans`).json<{ items: ActionPlan[] }>(),
  create: (assessmentId: string, data: ActionPlanCreateInput) =>
    api.post(`assessments/${assessmentId}/action-plans`, { json: data }).json<ActionPlan>(),
  update: (planId: string, data: ActionPlanUpdateInput) =>
    api.patch(`action-plans/${planId}`, { json: data }).json<ActionPlan>(),
  remove: (planId: string) => api.delete(`action-plans/${planId}`),
};

// ─── THREATS (catalog, cross-assessment) ──────────────────

export const threatsApi = {
  list: (params: ThreatListParams = {}) =>
    api.get('threats', { searchParams: cleanParams(params) }).json<ThreatListResponse>(),
};

export type { ThreatCatalogItem };

// ─── COUNTERMEASURES ──────────────────────────────────────

export const countermeasuresApi = {
  list: (params: CountermeasureListQuery = {}) =>
    api
      .get('countermeasures', { searchParams: cleanParams(params) })
      .json<{ items: CountermeasureSummary[]; total: number }>(),
  get: (id: string) => api.get(`countermeasures/${id}`).json<CountermeasureDetail>(),
  create: (data: CountermeasureCreateInput) =>
    api.post('countermeasures', { json: data }).json<CountermeasureDetail>(),
  update: (id: string, data: CountermeasureUpdateInput) =>
    api.patch(`countermeasures/${id}`, { json: data }).json<CountermeasureDetail>(),
  remove: (id: string) => api.delete(`countermeasures/${id}`),
};

// ─── ADMIN TEMPLATES ──────────────────────────────────────

import type {
  AdminPackageWithTree, AdminModuleDetail,
  AdminPackageCreateInput, AdminPackageUpdateInput,
  AdminModuleCreateInput, AdminModuleUpdateInput,
  AdminAssetTemplateCreateInput, AdminAssetTemplateUpdateInput,
  AdminThreatTemplateCreateInput, AdminThreatTemplateUpdateInput,
  AdminCountermeasureTemplateCreateInput, AdminCountermeasureTemplateUpdateInput,
  JunctionUpsertInput, AdminImportResult, OnConflict,
} from './csmp-types';
import type {
  TemplateExportEnvelope, PackageBundleContent, ModuleExport,
  AssetTemplateExport, ThreatTemplateExport, CountermeasureTemplateExport,
  TemplateExportKind,
} from '@csmp/shared';

export const adminTemplatesApi = {
  listPackages: () =>
    api.get('admin/template-packages').json<{ items: AdminPackageWithTree[] }>(),
  createPackage: (data: AdminPackageCreateInput) =>
    api.post('admin/template-packages', { json: data }).json<AdminPackageWithTree>(),
  updatePackage: (id: string, data: AdminPackageUpdateInput) =>
    api.patch(`admin/template-packages/${id}`, { json: data }).json<AdminPackageWithTree>(),
  removePackage: (id: string) =>
    api.delete(`admin/template-packages/${id}`),
  forkPackage: (id: string, body: { slug: string; name: string }) =>
    api.post(`admin/template-packages/${id}/fork`, { json: body }).json<AdminPackageWithTree>(),

  getModule: (id: string) =>
    api.get(`admin/template-modules/${id}`).json<AdminModuleDetail>(),
  createModule: (packageId: string, data: AdminModuleCreateInput) =>
    api.post(`admin/template-packages/${packageId}/modules`, { json: data })
      .json<AdminModuleDetail>(),
  updateModule: (id: string, data: AdminModuleUpdateInput) =>
    api.patch(`admin/template-modules/${id}`, { json: data }).json<AdminModuleDetail>(),
  removeModule: (id: string) =>
    api.delete(`admin/template-modules/${id}`),

  createAssetTemplate: (moduleId: string, data: AdminAssetTemplateCreateInput) =>
    api.post(`admin/template-modules/${moduleId}/asset-templates`, { json: data })
      .json<AdminModuleDetail['assetTemplates'][number]>(),
  updateAssetTemplate: (id: string, data: AdminAssetTemplateUpdateInput) =>
    api.patch(`admin/asset-templates/${id}`, { json: data })
      .json<AdminModuleDetail['assetTemplates'][number]>(),
  removeAssetTemplate: (id: string) =>
    api.delete(`admin/asset-templates/${id}`),

  createThreatTemplate: (moduleId: string, data: AdminThreatTemplateCreateInput) =>
    api.post(`admin/template-modules/${moduleId}/threat-templates`, { json: data })
      .json<AdminModuleDetail['threatTemplates'][number]>(),
  updateThreatTemplate: (id: string, data: AdminThreatTemplateUpdateInput) =>
    api.patch(`admin/threat-templates/${id}`, { json: data })
      .json<AdminModuleDetail['threatTemplates'][number]>(),
  removeThreatTemplate: (id: string) =>
    api.delete(`admin/threat-templates/${id}`),

  createCountermeasureTemplate: (moduleId: string, data: AdminCountermeasureTemplateCreateInput) =>
    api.post(`admin/template-modules/${moduleId}/countermeasure-templates`, { json: data })
      .json<AdminModuleDetail['countermeasureTemplates'][number]>(),
  updateCountermeasureTemplate: (id: string, data: AdminCountermeasureTemplateUpdateInput) =>
    api.patch(`admin/countermeasure-templates/${id}`, { json: data })
      .json<AdminModuleDetail['countermeasureTemplates'][number]>(),
  removeCountermeasureTemplate: (id: string) =>
    api.delete(`admin/countermeasure-templates/${id}`),

  upsertAssetThreatLink: (
    assetTemplateId: string, threatTemplateId: string, data: JunctionUpsertInput,
  ) =>
    api.put(`admin/asset-templates/${assetTemplateId}/threats/${threatTemplateId}`, { json: data }),
  removeAssetThreatLink: (assetTemplateId: string, threatTemplateId: string) =>
    api.delete(`admin/asset-templates/${assetTemplateId}/threats/${threatTemplateId}`),

  upsertThreatCountermeasureLink: (
    threatTemplateId: string, countermeasureTemplateId: string, data: JunctionUpsertInput,
  ) =>
    api.put(
      `admin/threat-templates/${threatTemplateId}/countermeasures/${countermeasureTemplateId}`,
      { json: data },
    ),
  removeThreatCountermeasureLink: (threatTemplateId: string, countermeasureTemplateId: string) =>
    api.delete(
      `admin/threat-templates/${threatTemplateId}/countermeasures/${countermeasureTemplateId}`,
    ),

  // EXPORT
  exportPackageBundle: (slug: string) =>
    api.get(`admin/export/package/${slug}`).json<TemplateExportEnvelope<PackageBundleContent>>(),
  exportModule: (id: string) =>
    api.get(`admin/export/module/${id}`).json<TemplateExportEnvelope<ModuleExport>>(),
  exportAssetTemplate: (id: string) =>
    api.get(`admin/export/asset-template/${id}`).json<TemplateExportEnvelope<AssetTemplateExport>>(),
  exportThreatTemplate: (id: string) =>
    api.get(`admin/export/threat-template/${id}`).json<TemplateExportEnvelope<ThreatTemplateExport>>(),
  exportCountermeasureTemplate: (id: string) =>
    api.get(`admin/export/countermeasure-template/${id}`)
      .json<TemplateExportEnvelope<CountermeasureTemplateExport>>(),

  // IMPORT
  importPackage: (envelope: unknown, onConflict: OnConflict = 'skip') =>
    api.post('admin/import/package', {
      json: envelope,
      searchParams: { onConflict },
    }).json<AdminImportResult>(),
  importItem: (
    kind: Exclude<TemplateExportKind, 'package'>,
    envelope: unknown,
    opts: { moduleId: string; onConflict?: OnConflict },
  ) =>
    api.post(`admin/import/${kind}`, {
      json: envelope,
      searchParams: cleanParams({ moduleId: opts.moduleId, onConflict: opts.onConflict ?? 'skip' }),
    }).json<AdminImportResult>(),

  // Default editable package for end-user template creation. Auto-created on first
  // need so operators can create asset/threat/CM templates without picking a package.
  ensureUserPackage: async (): Promise<AdminPackageWithTree> => {
    const { items } = await adminTemplatesApi.listPackages();
    const existing = items.find((p) => p.slug === 'user' && !p.isSystem);
    if (existing) return existing;
    return adminTemplatesApi.createPackage({
      slug: 'user',
      name: 'User templates',
      version: '1.0.0',
      description: 'Templates created in the Templates page.',
      enabled: true,
    });
  },
};

// ─── SURVEYS (GRACE v2) ────────────────────────────────────

export const surveyTemplatesApi = {
  list: (params: { surveyType?: SurveyType; activeOnly?: boolean } = {}) =>
    api.get('survey-templates', { searchParams: cleanParams(params) })
      .json<{ items: SurveyTemplateSummary[] }>(),
  get: (id: string) => api.get(`survey-templates/${id}`).json<SurveyTemplateDetail>(),
  create: (data: SurveyTemplateCreateInput) =>
    api.post('survey-templates', { json: data }).json<SurveyTemplateDetail>(),
  update: (id: string, data: SurveyTemplateUpdateInput) =>
    api.patch(`survey-templates/${id}`, { json: data }).json<SurveyTemplateDetail>(),
  fork: (id: string, body: { name?: string } = {}) =>
    api.post(`survey-templates/${id}/fork`, { json: body }).json<SurveyTemplateDetail>(),
  remove: (id: string) => api.delete(`survey-templates/${id}`),
};

export type BuiltInSurveyTypeOverrideCode = 'PHYSICAL' | 'REMOTE_TECH' | 'DOC_REVIEW' | 'HYBRID';

export interface BuiltInSurveyTypeOverride {
  code: BuiltInSurveyTypeOverrideCode;
  name?: string;
  description?: string;
  requiresPhysical?: boolean;
}

export const surveysApi = {
  enabledTypes: () =>
    api.get('surveys/enabled-types').json<{
      enabledTypes: string[];
      customTypes: Array<{ code: string; name: string; description: string | null; requiresPhysical: boolean }>;
      builtInOverrides: BuiltInSurveyTypeOverride[];
    }>(),
  list: (params: { clusterId?: string; status?: SurveyStatus; surveyType?: SurveyType } = {}) =>
    api.get('surveys', { searchParams: cleanParams(params) })
      .json<{ items: SurveyResponseSummary[] }>(),
  get: (id: string) => api.get(`surveys/${id}`).json<SurveyResponseDetail>(),
  create: (data: SurveyResponseCreateInput) =>
    api.post('surveys', { json: data }).json<SurveyResponseDetail>(),
  fromScope: (data: SurveyResponseFromScopeInput) =>
    api.post('surveys/from-scope', { json: data }).json<SurveyResponseDetail>(),
  update: (id: string, data: SurveyResponseUpdateInput) =>
    api.patch(`surveys/${id}`, { json: data }).json<SurveyResponseDetail>(),
  submit: (id: string) =>
    api.post(`surveys/${id}/submit`).json<SurveyResponseDetail>(),
  remove: (id: string) => api.delete(`surveys/${id}`),
  drift: (id: string) =>
    api.get(`surveys/${id}/drift`).json<SurveyDriftResponse>(),
};

// ─── SURVEY QUESTION LIBRARY ───────────────────────────────

export const surveyQuestionsApi = {
  list: (params: { evidenceType?: SurveyType; search?: string; includeInactive?: boolean } = {}) =>
    api.get('survey-questions', {
      searchParams: cleanParams({
        ...params,
        includeInactive: params.includeInactive ? 'true' : undefined,
      }),
    }).json<{ items: SurveyQuestionLibraryItem[] }>(),
  get: (id: string) => api.get(`survey-questions/${id}`).json<SurveyQuestionLibraryItem>(),
  create: (data: SurveyQuestionCreateInput) =>
    api.post('survey-questions', { json: data }).json<SurveyQuestionLibraryItem>(),
  update: (id: string, data: SurveyQuestionUpdateInput) =>
    api.patch(`survey-questions/${id}`, { json: data }).json<SurveyQuestionLibraryItem>(),
  remove: (id: string) => api.delete(`survey-questions/${id}`),
};

// Per-template question link endpoints (asset/threat/cm).
export const templateQuestionsApi = {
  listAsset: (assetTemplateId: string) =>
    api.get(`admin/asset-templates/${assetTemplateId}/questions`)
      .json<{ items: TemplateQuestionLink[] }>(),
  upsertAsset: (assetTemplateId: string, questionId: string, body: TemplateQuestionLinkUpsertInput) =>
    api.put(`admin/asset-templates/${assetTemplateId}/questions/${questionId}`, { json: body })
      .json<{ ok: true }>(),
  removeAsset: (assetTemplateId: string, questionId: string) =>
    api.delete(`admin/asset-templates/${assetTemplateId}/questions/${questionId}`),

  listThreat: (threatTemplateId: string) =>
    api.get(`admin/threat-templates/${threatTemplateId}/questions`)
      .json<{ items: TemplateQuestionLink[] }>(),
  upsertThreat: (threatTemplateId: string, questionId: string, body: TemplateQuestionLinkUpsertInput) =>
    api.put(`admin/threat-templates/${threatTemplateId}/questions/${questionId}`, { json: body })
      .json<{ ok: true }>(),
  removeThreat: (threatTemplateId: string, questionId: string) =>
    api.delete(`admin/threat-templates/${threatTemplateId}/questions/${questionId}`),

  listCm: (cmTemplateId: string) =>
    api.get(`admin/countermeasure-templates/${cmTemplateId}/questions`)
      .json<{ items: TemplateQuestionLink[] }>(),
  upsertCm: (cmTemplateId: string, questionId: string, body: TemplateQuestionLinkUpsertInput) =>
    api.put(`admin/countermeasure-templates/${cmTemplateId}/questions/${questionId}`, { json: body })
      .json<{ ok: true }>(),
  removeCm: (cmTemplateId: string, questionId: string) =>
    api.delete(`admin/countermeasure-templates/${cmTemplateId}/questions/${questionId}`),

  // Reverse: list AAA templates that attach the given question.
  listAttachments: (questionId: string) =>
    api.get(`admin/survey-questions/${questionId}/template-attachments`)
      .json<QuestionTemplateAttachments>(),
};

// ─── CLUSTER SURVEY SCOPES ─────────────────────────────────

export const clusterSurveyScopesApi = {
  list: (params: { clusterId?: string; status?: ScopeStatus } = {}) =>
    api.get('cluster-survey-scopes', { searchParams: cleanParams(params) })
      .json<{ items: ClusterSurveyScopeSummary[] }>(),
  get: (id: string) => api.get(`cluster-survey-scopes/${id}`).json<ClusterSurveyScopeDetail>(),
  create: (data: ClusterSurveyScopeCreateInput) =>
    api.post('cluster-survey-scopes', { json: data }).json<ClusterSurveyScopeDetail>(),
  update: (id: string, data: ClusterSurveyScopeUpdateInput) =>
    api.patch(`cluster-survey-scopes/${id}`, { json: data }).json<ClusterSurveyScopeDetail>(),
  autoCompose: (id: string, mode: 'replace' | 'merge' = 'replace') =>
    api.post(`cluster-survey-scopes/${id}/auto-compose`, { searchParams: { mode } })
      .json<ClusterSurveyScopeDetail>(),
  approve: (id: string) =>
    api.post(`cluster-survey-scopes/${id}/approve`).json<ClusterSurveyScopeDetail>(),
  revise: (id: string) =>
    api.post(`cluster-survey-scopes/${id}/revise`).json<ClusterSurveyScopeDetail>(),
  archive: (id: string) =>
    api.post(`cluster-survey-scopes/${id}/archive`).json<ClusterSurveyScopeSummary>(),
  remove: (id: string) => api.delete(`cluster-survey-scopes/${id}`),
  addItem: (id: string, body: ScopeItemAddInput) =>
    api.post(`cluster-survey-scopes/${id}/items`, { json: body }).json<ClusterSurveyScopeDetail>(),
  updateItem: (id: string, itemId: string, body: ScopeItemUpdateInput) =>
    api.patch(`cluster-survey-scopes/${id}/items/${itemId}`, { json: body }).json<ClusterSurveyScopeDetail>(),
  removeItem: (id: string, itemId: string) =>
    api.delete(`cluster-survey-scopes/${id}/items/${itemId}`).json<ClusterSurveyScopeDetail>(),
};

export type DiffSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export interface SurveyDiffEntry {
  questionId: string;
  prompt: string;
  from: unknown;
  to: unknown;
  severity: DiffSeverity;
  reason: string;
}
export interface SurveyDriftResponse {
  hasPrevious: boolean;
  previousResponseId: string | null;
  previousConductedAt: string | null;
  topSeverity: DiffSeverity | null;
  diffs: SurveyDiffEntry[];
}

export const assessmentSurveyLinksApi = {
  list: (assessmentId: string) =>
    api.get(`assessments/${assessmentId}/surveys`).json<{ items: AssessmentSurveyLink[] }>(),
  link: (assessmentId: string, body: AssessmentSurveyLinkCreateInput) =>
    api.post(`assessments/${assessmentId}/surveys`, { json: body }).json<AssessmentSurveyLink>(),
  unlink: (assessmentId: string, surveyResponseId: string) =>
    api.delete(`assessments/${assessmentId}/surveys/${surveyResponseId}`),
};

// ─── ADMIN: survey config (P2) ────────────────────────────

export interface TenantSurveyCustomType {
  code: string;
  name: string;
  description?: string | null;
  requiresPhysical: boolean;
}

export interface TenantSurveyConfig {
  tenantId: string;
  enabledTypes: string[];
  customTypes: TenantSurveyCustomType[];
  builtInOverrides: BuiltInSurveyTypeOverride[];
  updatedAt: string;
}

export interface TenantSurveyConfigUpdate {
  enabledTypes?: string[];
  customTypes?: Array<TenantSurveyCustomType & {
    starterTemplate: {
      questions: Array<{
        id: string;
        category?: string;
        prompt: string;
        type: 'yes_no_partial' | 'number' | 'text' | 'select';
        weight: number;
        hint?: string;
        options?: string[];
        severityMap?: Record<string, 'ok' | 'warn' | 'bad'>;
      }>;
    };
  }>;
  builtInOverrides?: BuiltInSurveyTypeOverride[];
}

export interface AssetTypeSurveyDefault {
  id: string;
  assetType: AssetType;
  surveyType: SurveyType;
  isDefault: boolean;
  templateId: string | null;
  templateName: string | null;
  updatedAt: string;
}

export interface AssetTypeSurveyDefaultUpsert {
  assetType: AssetType;
  surveyType: SurveyType;
  isDefault: boolean;
  templateId?: string | null;
}

export interface SurveyTypeSuggestion {
  surveyType: SurveyType;
  templateId: string | null;
  templateName: string | null;
  reason: 'ASSET_TYPE_DEFAULT' | 'MAJORITY_VOTE' | 'FALLBACK';
}

export const adminSurveyConfigApi = {
  getConfig: () => api.get('admin/surveys/config').json<TenantSurveyConfig>(),
  updateConfig: (body: TenantSurveyConfigUpdate) =>
    api.put('admin/surveys/config', { json: body }).json<TenantSurveyConfig>(),
  listDefaults: () =>
    api.get('admin/surveys/defaults').json<{ items: AssetTypeSurveyDefault[] }>(),
  upsertDefault: (body: AssetTypeSurveyDefaultUpsert) =>
    api.put('admin/surveys/defaults', { json: body }).json<AssetTypeSurveyDefault>(),
  removeDefault: (id: string) => api.delete(`admin/surveys/defaults/${id}`),
  suggest: (clusterId: string) =>
    api.get('admin/surveys/suggest', { searchParams: { clusterId } })
      .json<SurveyTypeSuggestion>(),
};

// ─── SCHEDULES + NOTIFICATIONS (P3) ───────────────────────

export type ScheduleStatus = 'ACTIVE' | 'PAUSED';

export interface SurveyScheduleSummary {
  id: string;
  clusterId: string;
  clusterName: string | null;
  templateId: string;
  templateName: string | null;
  cron: string;
  assignedToId: string;
  assignedToName: string | null;
  status: ScheduleStatus;
  lastRunAt: string | null;
  nextRunAt: string | null;
  updatedAt: string;
}

export interface SurveyScheduleCreateInput {
  clusterId: string;
  templateId: string;
  assignedToId: string;
  cron: string;
  status?: ScheduleStatus;
}

export const surveySchedulesApi = {
  list: () =>
    api.get('survey-schedules').json<{ items: SurveyScheduleSummary[] }>(),
  create: (data: SurveyScheduleCreateInput) =>
    api.post('survey-schedules', { json: data }).json<SurveyScheduleSummary>(),
  update: (id: string, data: Partial<SurveyScheduleCreateInput>) =>
    api.patch(`survey-schedules/${id}`, { json: data }).json<SurveyScheduleSummary>(),
  runNow: (id: string) =>
    api.post(`survey-schedules/${id}/run-now`).json<SurveyScheduleSummary>(),
  remove: (id: string) => api.delete(`survey-schedules/${id}`),
};

export interface NotificationItem {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (params: { limit?: number; unreadOnly?: boolean } = {}) =>
    api.get('notifications', { searchParams: cleanParams(params) })
      .json<{ items: NotificationItem[]; unreadCount: number }>(),
  unreadCount: () =>
    api.get('notifications/unread-count').json<{ unreadCount: number }>(),
  markRead: (id: string) =>
    api.post(`notifications/${id}/read`).json<NotificationItem>(),
  markAllRead: () =>
    api.post('notifications/mark-all-read').json<{ updated: number }>(),
};

// ─── ORG SETTINGS / APPEARANCE ────────────────────────────

export interface OrgSettingsResponse {
  appearance: AppearanceSettings | null;
  organization: OrgSummary;
}

export const orgSettingsApi = {
  get: () => api.get('org/settings').json<OrgSettingsResponse>(),
  patchAppearance: (appearance: AppearanceSettings) =>
    api.patch('org/settings', { json: { appearance } }).json<{ appearance: AppearanceSettings }>(),
};

export const orgApi = {
  patch: (data: { name: string }) =>
    api.patch('org', { json: data }).json<{
      id: string; name: string; slug: string;
      subscriptionTier: 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
      isActive: boolean;
    }>(),
};

// ─── USERS ─────────────────────────────────────────────────

export interface UserListParams {
  role?: Role;
  active?: boolean;
}

export const usersApi = {
  list: (params: UserListParams = {}) =>
    api.get('users', { searchParams: cleanParams(params) }).json<{ items: UserSummary[] }>(),
  get: (id: string) => api.get(`users/${id}`).json<UserDetail>(),
  create: (data: UserCreateInput) =>
    api.post('users', { json: data }).json<{ user: UserDetail; tempPassword: string }>(),
  update: (id: string, data: UserUpdateInput) =>
    api.patch(`users/${id}`, { json: data }).json<UserDetail>(),
  changeRole: (id: string, role: Role) =>
    api.post(`users/${id}/role`, { json: { role } }).json<UserDetail>(),
  deactivate: (id: string) =>
    api.delete(`users/${id}`).json<{ ok: true }>(),
  reactivate: (id: string) =>
    api.post(`users/${id}/reactivate`).json<UserDetail>(),
  resetPassword: (id: string) =>
    api.post(`users/${id}/reset-password`).json<{ tempPassword: string }>(),
};

// ─── helper ───────────────────────────────────────────────

function cleanParams(p: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = String(v);
  }
  return out;
}
