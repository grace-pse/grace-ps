import { api } from './api';
import type {
  AssetSummary, AssetDetail, AssetCreateInput, AssetUpdateInput,
  AssetGraphResponse, AssetRelationshipSummary, AssetRelationshipCreateInput,
  ClusterSummary, ClusterDetail, ClusterCreateInput,
  TemplatePackage, TemplateModule, AssetTemplateSummary, AssetTemplateDetail,
  AssetType, AssetCategory, AssetStatus,
  AssessmentSummary, AssessmentDetail, AssessmentCreateInput, AssessmentStatus, ReviewStatus,
  ThreatSummary, ThreatCreateInput, ImpactBreakdown, VulnerabilityRating, TearStrategy,
  ActionPlan, ActionPlanCreateInput, ActionPlanUpdateInput, SuggestedThreat,
  ComplianceTag, SnapshotSummary, SnapshotDetail,
} from './csmp-types';

// ─── ASSETS ───────────────────────────────────────────────

export interface AssetListParams {
  search?: string;
  assetType?: AssetType;
  category?: AssetCategory;
  status?: AssetStatus;
  parentId?: string | 'none';
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

  graph: () => api.get('assets/graph').json<AssetGraphResponse>(),
  createRelationship: (data: AssetRelationshipCreateInput) =>
    api.post('assets/relationships', { json: data }).json<AssetRelationshipSummary>(),
  removeRelationship: (id: string) => api.delete(`assets/relationships/${id}`),
};

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
};

// ─── TEMPLATES ────────────────────────────────────────────

export interface TemplateListParams {
  search?: string;
  packageSlug?: string;
  moduleSlug?: string;
  assetType?: AssetType;
  category?: AssetCategory;
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
  update: (id: string, data: { title?: string; assessmentType?: string }) =>
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

  // Snapshots
  listSnapshots: (assessmentId: string) =>
    api.get(`assessments/${assessmentId}/snapshots`).json<{ items: SnapshotSummary[] }>(),
  getSnapshot: (assessmentId: string, snapshotId: string) =>
    api.get(`assessments/${assessmentId}/snapshots/${snapshotId}`).json<SnapshotDetail>(),
  captureSnapshot: (assessmentId: string, note: string) =>
    api.post(`assessments/${assessmentId}/snapshots`, { json: { note } }).json<SnapshotSummary>(),
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

// ─── helper ───────────────────────────────────────────────

function cleanParams(p: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '' && v !== null) out[k] = String(v);
  }
  return out;
}
