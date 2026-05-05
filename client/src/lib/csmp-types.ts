export type AssetType =
  | 'SITE' | 'BUILDING' | 'FLOOR' | 'ROOM' | 'ZONE'
  | 'EQUIPMENT' | 'VEHICLE' | 'PERSON' | 'INFORMATION'
  | 'IP' | 'PROCESS' | 'REPUTATION' | 'CONTINUITY';

export type AssetCategory = 'TANGIBLE' | 'INTANGIBLE';
export type AssetStatus = 'ACTIVE' | 'DECOMMISSIONED' | 'UNDER_REVIEW' | 'COMPROMISED';
export type AssetRole = 'PROTECTED' | 'PROTECTIVE' | 'DUAL';
export type OperationalStatus = 'OPERATIONAL' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';
export type ClusterType = 'OPERATIONAL' | 'SPATIAL' | 'LOGICAL' | 'TEMPORAL';
export type CriticalityMode = 'HIGHEST' | 'AVERAGE' | 'CUSTOM';
export type PropagationMode = 'CASCADE_DOWN' | 'CASCADE_UP' | 'BIDIRECTIONAL' | 'NONE';
export type Relevance = 'HIGH' | 'MEDIUM' | 'LOW';

export const ASSET_TYPES: AssetType[] = [
  'SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE',
  'EQUIPMENT', 'VEHICLE', 'PERSON', 'INFORMATION',
  'IP', 'PROCESS', 'REPUTATION', 'CONTINUITY',
];
export const ASSET_CATEGORIES: AssetCategory[] = ['TANGIBLE', 'INTANGIBLE'];
export const ASSET_STATUSES: AssetStatus[] = ['ACTIVE', 'DECOMMISSIONED', 'UNDER_REVIEW', 'COMPROMISED'];
export const ASSET_ROLES: AssetRole[] = ['PROTECTED', 'PROTECTIVE', 'DUAL'];
export const ASSET_ROLE_LABEL: Record<AssetRole, string> = {
  PROTECTED: 'Protected',
  PROTECTIVE: 'Protective',
  DUAL: 'Dual',
};
export const ASSET_ROLE_DESCRIPTION: Record<AssetRole, string> = {
  PROTECTED: 'Asset whose compromise would harm the organization. Enters clusters and is targeted by Step 2 threats.',
  PROTECTIVE: 'Security system that protects other assets (CCTV, access control, alarms). Excluded from clusters; surfaced in Step 6.',
  DUAL: 'Both protected and protective (e.g. safe, mantrap). Enters clusters as a target; protective edges still inform Step 6.',
};
export const OPERATIONAL_STATUSES: OperationalStatus[] = ['OPERATIONAL', 'DEGRADED', 'FAILED', 'UNKNOWN'];
export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
  OPERATIONAL: 'Operational',
  DEGRADED: 'Degraded',
  FAILED: 'Failed',
  UNKNOWN: 'Unknown',
};
export const CLUSTER_TYPES: ClusterType[] = ['OPERATIONAL', 'SPATIAL', 'LOGICAL', 'TEMPORAL'];
export const CRITICALITY_MODES: CriticalityMode[] = ['HIGHEST', 'AVERAGE', 'CUSTOM'];
export const PROPAGATION_MODES: PropagationMode[] = ['CASCADE_DOWN', 'CASCADE_UP', 'BIDIRECTIONAL', 'NONE'];

export interface AssetSummary {
  id: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  criticality: number;
  status: AssetStatus;
  assetRole: AssetRole;
  operationalStatus: OperationalStatus;
  degradedControlPosture: boolean;
  degradedControlSince: string | null;
  parentId: string | null;
  tags: string[];
  childCount: number;
  updatedAt: string;
}

export interface AssetLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface AssetDetail extends Omit<AssetSummary, 'childCount'> {
  description: string | null;
  location: AssetLocation | null;
  metadata: Record<string, unknown> | null;
  sourceTemplateId: string | null;
  createdById: string;
  createdAt: string;
  parent: { id: string; name: string } | null;
  children: AssetSummary[];
}

export interface AssetCreateInput {
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  description?: string | null;
  criticality?: number;
  status?: AssetStatus;
  assetRole?: AssetRole;
  operationalStatus?: OperationalStatus;
  parentId?: string | null;
  tags?: string[];
  sourceTemplateId?: string | null;
  /** Free-form metadata bag. Reserved key `customFields` carries
   * per-package user inputs ({ [packageSlug]: { [fieldKey]: value } }) —
   * see CustomFieldsSection. Engine-set keys live alongside it. */
  metadata?: Record<string, unknown> | null;
}

export type AssetUpdateInput = Partial<AssetCreateInput>;

export interface ClusterSummary {
  id: string;
  name: string;
  description: string | null;
  clusterType: ClusterType;
  criticalityMode: CriticalityMode;
  statusPropagation: PropagationMode;
  memberCount: number;
  derivedCriticality: number | null;
  updatedAt: string;
}

export interface ClusterMembership {
  assetId: string;
  asset: { id: string; name: string; assetType: string; criticality: number };
  roleInCluster: string | null;
  isCritical: boolean;
  dependencyWeight: number;
}

export interface ClusterDetail extends ClusterSummary {
  memberships: ClusterMembership[];
  assets: AssetSummary[];
}

export interface ClusterMemberInput {
  assetId: string;
  roleInCluster?: string | null;
  isCritical: boolean;
  dependencyWeight: number;
}

export interface ClusterCreateInput {
  name: string;
  description?: string | null;
  clusterType: ClusterType;
  criticalityMode?: CriticalityMode;
  statusPropagation?: PropagationMode;
  members: ClusterMemberInput[];
}

export interface TemplatePackage {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  version: string;
  description: string | null;
  complianceRefs: string[];
  enabled: boolean;
  moduleCount: number;
  assetTemplateCount: number;
}

export interface TemplateModule {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  assetTemplateCount: number;
}

export interface AssetTemplateSummary {
  id: string;
  slug: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  defaultCriticality: number;
  /** PROTECTED/PROTECTIVE/DUAL pre-set on the subtype; null = no opinion. */
  defaultAssetRole: AssetRole | null;
  description: string | null;
  tags: string[];
  module: {
    id: string;
    slug: string;
    name: string;
    package: { id: string; slug: string; name: string; enabled: boolean };
  };
}

export interface AssetTemplateDetail extends AssetTemplateSummary {
  parentSlug: string | null;
  attributes: Record<string, unknown> | null;
  recommendedThreats: Array<{
    relevance: Relevance;
    rationale: string | null;
    threatTemplate: {
      id: string;
      slug: string;
      scenarioName: string;
      adversaryType: string;
      actionType: string;
    };
  }>;
}

// ─── RELATIONSHIPS ────────────────────────────────────────

export type RelationshipType =
  | 'DEPENDS_ON' | 'PROTECTS' | 'SERVES' | 'CONTAINS'
  | 'COMMUNICATES_WITH' | 'ADJACENT_TO' | 'SUPPLIES' | 'MONITORS';

export type RelDirection = 'UNIDIRECTIONAL' | 'BIDIRECTIONAL';

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'DEPENDS_ON', 'PROTECTS', 'SERVES', 'CONTAINS',
  'COMMUNICATES_WITH', 'ADJACENT_TO', 'SUPPLIES', 'MONITORS',
];

export const RELATIONSHIP_TYPE_LABEL: Record<RelationshipType, string> = {
  DEPENDS_ON: 'depends on',
  PROTECTS: 'protects',
  SERVES: 'serves',
  CONTAINS: 'contains',
  COMMUNICATES_WITH: 'communicates with',
  ADJACENT_TO: 'adjacent to',
  SUPPLIES: 'supplies',
  MONITORS: 'monitors',
};

export type ProtectiveRelationshipType = 'PROTECTS' | 'MONITORS';

// Source of a coverage entry. EDGE entries come from explicit
// AssetRelationship rows and are fed to propagateAssetRisk; IMPLICIT_LOCATION
// entries come from the topology hierarchy (a PROTECTIVE asset living inside
// the threat-target's parent_id subtree) and are display-only — the §4 bridge
// invariant intentionally stays edge-only.
export type CoverageSource = 'EDGE' | 'IMPLICIT_LOCATION';

export interface ProtectiveCoverageItem {
  protectiveAssetId: string;
  name: string;
  assetType: AssetType;
  criticality: number;
  source: CoverageSource;
  relationshipType: ProtectiveRelationshipType | null;
  operationalStatus: OperationalStatus;
  degradedSince: string | null;
}

export interface ProtectiveCoverageResponse {
  targetAssetId: string;
  items: ProtectiveCoverageItem[];
}

export interface AssetRelationshipSummary {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: RelationshipType;
  direction: RelDirection;
  impactPropagation: boolean;
  description: string | null;
}

export interface AssetGraphNode {
  id: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  criticality: number;
  status: AssetStatus;
  parentId: string | null;
  assetRole: AssetRole;
}

export interface AssetGraphResponse {
  nodes: AssetGraphNode[];
  edges: AssetRelationshipSummary[];
}

export type AssetTreeCoverageStatus = 'covered' | 'uncovered' | 'na';

export interface AssetTreeNode {
  id: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  criticality: number;
  status: AssetStatus;
  assetRole: AssetRole;
  operationalStatus: OperationalStatus;
  parentId: string | null;
  tags: string[];
  childCount: number;
  coverageStatus: AssetTreeCoverageStatus;
  inDegree: number;
  outDegree: number;
}

export interface AssetTreeResponse {
  items: AssetTreeNode[];
}

export interface AssetRelationshipCreateInput {
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: RelationshipType;
  direction?: RelDirection;
  impactPropagation?: boolean;
  description?: string | null;
}

export interface AssetRelationshipUpdateInput {
  relationshipType?: RelationshipType;
  direction?: RelDirection;
  impactPropagation?: boolean;
  description?: string | null;
}

export function criticalityToRiskLevel(c: number): 'Negligible' | 'Low' | 'Moderate' | 'High' | 'Extreme' {
  if (c <= 1) return 'Negligible';
  if (c === 2) return 'Low';
  if (c === 3) return 'Moderate';
  if (c === 4) return 'High';
  return 'Extreme';
}

// ─── ASSESSMENTS ─────────────────────────────────────────

export type AssessmentType = 'FULL_SRA' | 'VULNERABILITY_ASSESSMENT' | 'THREAT_ASSESSMENT' | 'SURVEY' | 'AUDIT';
export type AssessmentStatus =
  | 'DRAFT'
  | 'STEP_1_ASSETS' | 'STEP_2_THREATS' | 'STEP_3_LIKELIHOOD' | 'STEP_4_IMPACT'
  | 'STEP_5_IRV' | 'STEP_6_VULNERABILITY' | 'STEP_7_TREATMENT'
  | 'REVIEW' | 'APPROVED' | 'ARCHIVED';
export type ReviewStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
export type AdversaryType =
  | 'CRIMINAL' | 'TERRORIST' | 'INSIDER' | 'COMPETITOR' | 'ACTIVIST'
  | 'NATION_STATE' | 'OPPORTUNIST' | 'NATURAL';
export type ActionType =
  | 'THEFT' | 'DAMAGE' | 'DISRUPTION' | 'ESPIONAGE' | 'SABOTAGE'
  | 'ASSAULT' | 'INTRUSION' | 'FRAUD' | 'ARSON' | 'BOMB' | 'CYBER' | 'NATURAL_DISASTER';
export type IrvBand = 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
export type VulnerabilityRating = 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
export type RiskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';
export type TearStrategy = 'TRANSFER' | 'ELIMINATE' | 'ACCEPT' | 'REDUCE';
export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
export type ComplianceTag =
  | 'ISO_31000' | 'NIS2_ART_21' | 'NIS2_ART_23' | 'CER' | 'ASIS_SPC_1' | 'ISO_28000';

export const COMPLIANCE_TAGS: ComplianceTag[] = [
  'ISO_31000', 'NIS2_ART_21', 'NIS2_ART_23', 'CER', 'ASIS_SPC_1', 'ISO_28000',
];

export const COMPLIANCE_TAG_LABEL: Record<ComplianceTag, string> = {
  ISO_31000: 'ISO 31000',
  NIS2_ART_21: 'NIS2 Art. 21',
  NIS2_ART_23: 'NIS2 Art. 23',
  CER: 'CER Directive',
  ASIS_SPC_1: 'ASIS SPC.1',
  ISO_28000: 'ISO 28000',
};

export const ADVERSARY_TYPES: AdversaryType[] = [
  'CRIMINAL', 'TERRORIST', 'INSIDER', 'COMPETITOR', 'ACTIVIST',
  'NATION_STATE', 'OPPORTUNIST', 'NATURAL',
];
export const ACTION_TYPES: ActionType[] = [
  'THEFT', 'DAMAGE', 'DISRUPTION', 'ESPIONAGE', 'SABOTAGE',
  'ASSAULT', 'INTRUSION', 'FRAUD', 'ARSON', 'BOMB', 'CYBER', 'NATURAL_DISASTER',
];
export const VULNERABILITY_RATINGS: VulnerabilityRating[] = [
  'STRONG', 'BASELINE', 'BARELY_ADEQUATE', 'INADEQUATE',
];
export const TEAR_STRATEGIES: TearStrategy[] = ['TRANSFER', 'ELIMINATE', 'ACCEPT', 'REDUCE'];
export const ACTION_STATUSES: ActionStatus[] = [
  'PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED',
];

export type EvidenceBasis = 'EXPERT_JUDGMENT' | 'SURVEY_LINKED' | 'MIXED';

export const EVIDENCE_BASIS_OPTIONS: EvidenceBasis[] = [
  'EXPERT_JUDGMENT',
  'SURVEY_LINKED',
  'MIXED',
];

export const EVIDENCE_BASIS_LABEL: Record<EvidenceBasis, string> = {
  EXPERT_JUDGMENT: 'Expert judgment',
  SURVEY_LINKED: 'Survey-linked',
  MIXED: 'Mixed',
};

export interface AssessmentSummary {
  id: string;
  title: string;
  assessmentType: AssessmentType;
  status: AssessmentStatus;
  currentStep: number;
  reviewStatus: ReviewStatus;
  assetId: string | null;
  clusterId: string | null;
  assetName: string | null;
  clusterName: string | null;
  leadAssessorId: string;
  leadAssessorName: string | null;
  approverId: string | null;
  version: string;
  period: string | null;
  scopeDescription: string | null;
  threatCount: number;
  highestPriority: RiskPriority | null;
  startedAt: string | null;
  completedAt: string | null;
  signedOffAt: string | null;
  updatedAt: string;
  evidenceBasis: EvidenceBasis;
  surveyPending: boolean;
  lastSurveyDate: string | null;
  expertJustification: string | null;
}

export interface Recommendation {
  id: string;
  assessmentId: string;
  ref: string;
  priority: RiskPriority;
  title: string;
  body: string;
  owner: string | null;
  horizon: string | null;
  cost: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationInput {
  ref?: string;
  priority: RiskPriority;
  title: string;
  body: string;
  owner?: string | null;
  horizon?: string | null;
  cost?: string | null;
  sortOrder?: number;
}

export interface ThreatSummary {
  id: string;
  assessmentId: string;
  targetAssetId: string;
  targetAssetName: string | null;
  adversaryType: AdversaryType;
  actionType: ActionType;
  adversaryDescription: string | null;
  actionDescription: string | null;
  locationContext: string | null;
  facilitatingFactors: string | null;
  timeContext: string | null;
  likelihoodScore: number | null;
  likelihoodRationale: string | null;
  impactScore: number | null;
  impactRationale: string | null;
  impactBreakdown: Record<string, number> | null;
  irv: IrvBand | null;
  vulnerabilityRating: VulnerabilityRating | null;
  vulnerabilityRationale: string | null;
  riskTreatmentPriority: RiskPriority | null;
  tearStrategy: TearStrategy | null;
  alarpJustification: string | null;
  complianceTags: ComplianceTag[];
  dbtReferenceId: string | null;
}

export interface AssessmentDetail extends AssessmentSummary {
  threats: ThreatSummary[];
  reviewedById: string | null;
  reviewNotes: string | null;
}

export interface ThreatCatalogItem extends ThreatSummary {
  assessmentTitle: string | null;
  assessmentStatus: AssessmentStatus;
  dbtScenarioName: string | null;
  dbtCsmpUnitReference: string | null;
  countermeasureCount: number;
  actionPlanCount: number;
  updatedAt: string;
}

export interface ThreatListParams {
  search?: string;
  adversaryType?: AdversaryType;
  actionType?: ActionType;
  targetAssetId?: string;
  assessmentId?: string;
  irv?: IrvBand;
  riskTreatmentPriority?: RiskPriority;
  vulnerabilityRating?: VulnerabilityRating;
  tearStrategy?: TearStrategy;
  dbtLinked?: 'yes' | 'no';
  complianceTag?: ComplianceTag;
  page?: number;
  pageSize?: number;
}

export interface ThreatListResponse {
  items: ThreatCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AssessmentCreateInput {
  title: string;
  assessmentType?: AssessmentType;
  assetId?: string | null;
  clusterId?: string | null;
  evidenceBasis?: EvidenceBasis;
  expertJustification?: string | null;
}

export interface ThreatCreateInput {
  targetAssetId: string;
  adversaryType: AdversaryType;
  actionType: ActionType;
  adversaryDescription?: string | null;
  actionDescription?: string | null;
  locationContext?: string | null;
  facilitatingFactors?: string | null;
  timeContext?: string | null;
  complianceTags?: ComplianceTag[];
  dbtReferenceId?: string | null;
}

export interface ImpactBreakdown {
  people: number;
  property: number;
  operations: number;
  reputation: number;
  financial: number;
}

export interface ActionPlan {
  id: string;
  assessmentId: string;
  threatId: string;
  riskPriority: RiskPriority;
  actionRequired: string;
  responsiblePerson: string | null;
  targetDate: string | null;
  status: ActionStatus;
  completionDate: string | null;
  evidence: string | null;
  complianceTags: ComplianceTag[];
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedThreat {
  assetId: string;
  assetName: string;
  threatTemplateId: string;
  scenarioName: string;
  adversaryType: AdversaryType;
  actionType: ActionType;
  relevance: Relevance;
  rationale: string | null;
  csmpUnitReference: string | null;
  alreadyAdded: boolean;
}

export interface ActionPlanCreateInput {
  threatId: string;
  actionRequired: string;
  responsiblePerson?: string | null;
  targetDate?: string | null;
  status?: ActionStatus;
  complianceTags?: ComplianceTag[];
}

export interface ActionPlanUpdateInput {
  actionRequired?: string;
  responsiblePerson?: string | null;
  targetDate?: string | null;
  status?: ActionStatus;
  completionDate?: string | null;
  evidence?: string | null;
  complianceTags?: ComplianceTag[];
}

// ─── SNAPSHOTS ────────────────────────────────────────────

export type SnapshotReason =
  | 'SUBMITTED_FOR_REVIEW' | 'APPROVED' | 'REJECTED' | 'MANUAL_SAVE'
  | 'STEP_ADVANCED' | 'THREAT_ADDED' | 'THREAT_REMOVED'
  | 'RECOMMENDATION_ADDED' | 'METADATA_UPDATED';

export const SNAPSHOT_REASON_LABEL: Record<SnapshotReason, string> = {
  SUBMITTED_FOR_REVIEW: 'Submitted for review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  MANUAL_SAVE: 'Manual save',
  STEP_ADVANCED: 'Step advanced',
  THREAT_ADDED: 'Threat added',
  THREAT_REMOVED: 'Threat removed',
  RECOMMENDATION_ADDED: 'Recommendation added',
  METADATA_UPDATED: 'Metadata updated',
};

export interface SnapshotSummary {
  id: string;
  assessmentId: string;
  capturedAt: string;
  capturedById: string;
  capturedByName: string | null;
  reason: SnapshotReason;
  note: string | null;
}

export interface SnapshotPayload {
  assessment: AssessmentSummary & {
    reviewedById: string | null;
    reviewNotes: string | null;
  };
  threats: ThreatSummary[];
  actionPlans: Array<Omit<ActionPlan, 'assessmentId' | 'createdAt' | 'updatedAt'>>;
  note?: string | null;
}

export interface SnapshotDetail extends SnapshotSummary {
  payload: SnapshotPayload;
}

// ─── ASSESSMENT EXECUTIVE SUMMARY ─────────────────────────

export interface SummaryBucket {
  key: string;
  count: number;
  pct: number;
}

export interface AssessmentSummaryHero {
  id: string;
  title: string;
  version: string;
  status: AssessmentStatus;
  assetName: string | null;
  clusterName: string | null;
  period: string | null;
  scopeDescription: string | null;
  evidenceBasis: EvidenceBasis;
  leadAssessorName: string | null;
  approverName: string | null;
  reviewerName: string | null;
  reviewNotes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  signedOffAt: string | null;
}

export interface AssessmentSummaryPosture {
  totalThreats: number;
  highestPriority: RiskPriority | null;
  highOrExtremeIrvCount: number;
  unscoredThreatsCount: number;
}

export interface AssessmentSummaryActionPlan {
  total: number;
  byStatus: SummaryBucket[];
  completionPct: number;
  overdueCount: number;
  nextDueDate: string | null;
}

export interface AssessmentSummaryRecommendation {
  id: string;
  ref: string;
  priority: RiskPriority;
  title: string;
  body: string;
  owner: string | null;
  horizon: string | null;
  cost: string | null;
}

export interface ProtectiveCoverageItem {
  protectiveAssetId: string;
  name: string;
  assetType: AssetType;
  criticality: number;
  source: 'EDGE' | 'IMPLICIT_LOCATION';
  relationshipType: 'PROTECTS' | 'MONITORS' | null;
  operationalStatus: OperationalStatus;
  degradedSince: string | null;
}

export interface AssessmentSummaryResponse {
  hero: AssessmentSummaryHero;
  posture: AssessmentSummaryPosture;
  irvDistribution: SummaryBucket[];
  priorityDistribution: SummaryBucket[];
  tearMix: SummaryBucket[];
  vulnerabilityMix: SummaryBucket[];
  topThreats: ThreatSummary[];
  actionPlan: AssessmentSummaryActionPlan;
  compliance: Array<{ tag: ComplianceTag; threatCount: number }>;
  recommendations: AssessmentSummaryRecommendation[];
  protectiveCoverage: ProtectiveCoverageItem[];
}

// ─── COUNTERMEASURES ──────────────────────────────────────

export type ShapeCategory =
  | 'SECURITY_PROGRAMME' | 'HUMAN' | 'ARCHITECTURAL' | 'PROCEDURAL' | 'EQUIPMENT';
export type PpsFunction =
  | 'DETER' | 'DETECT' | 'DELAY' | 'DENY' | 'DISRUPT' | 'DEFEAT' | 'RECOVER';
export type ProtectionDomain =
  | 'PERIMETER' | 'BUILDING' | 'ACCESS' | 'SURVEILLANCE'
  | 'INFORMATION' | 'PERSONNEL' | 'COUNTERTERRORISM';
export type ImplementationStatus =
  | 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED' | 'DECOMMISSIONED';

export const SHAPE_CATEGORIES: ShapeCategory[] = [
  'SECURITY_PROGRAMME', 'HUMAN', 'ARCHITECTURAL', 'PROCEDURAL', 'EQUIPMENT',
];
export const PPS_FUNCTIONS: PpsFunction[] = [
  'DETER', 'DETECT', 'DELAY', 'DENY', 'DISRUPT', 'DEFEAT', 'RECOVER',
];
export const PROTECTION_DOMAINS: ProtectionDomain[] = [
  'PERIMETER', 'BUILDING', 'ACCESS', 'SURVEILLANCE',
  'INFORMATION', 'PERSONNEL', 'COUNTERTERRORISM',
];
export const IMPLEMENTATION_STATUSES: ImplementationStatus[] = [
  'PROPOSED', 'APPROVED', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'DECOMMISSIONED',
];

export const SHAPE_CATEGORY_LABEL: Record<ShapeCategory, string> = {
  SECURITY_PROGRAMME: 'Security programme',
  HUMAN: 'Human',
  ARCHITECTURAL: 'Architectural',
  PROCEDURAL: 'Procedural',
  EQUIPMENT: 'Equipment',
};

export interface CountermeasureSummary {
  id: string;
  name: string;
  shapeCategory: ShapeCategory;
  ppsFunctions: PpsFunction[];
  domain: ProtectionDomain;
  implementationStatus: ImplementationStatus;
  effectivenessRating: VulnerabilityRating | null;
  tearStrategy: TearStrategy | null;
  costEstimate: number | null;
  annualCost: number | null;
  assignedToAssetId: string | null;
  assignedToThreatId: string | null;
  assignedToAssetName: string | null;
  assignedToThreatTitle: string | null;
  updatedAt: string;
}

export interface CountermeasureDetail extends CountermeasureSummary {
  description: string | null;
  alarpJustification: string | null;
  createdAt: string;
  sourceTemplateId: string | null;
}

export interface CountermeasureCreateInput {
  name: string;
  description?: string | null;
  shapeCategory: ShapeCategory;
  ppsFunctions: PpsFunction[];
  domain: ProtectionDomain;
  implementationStatus?: ImplementationStatus;
  effectivenessRating?: VulnerabilityRating | null;
  tearStrategy?: TearStrategy | null;
  costEstimate?: number | null;
  annualCost?: number | null;
  assignedToAssetId?: string | null;
  assignedToThreatId?: string | null;
  alarpJustification?: string | null;
  sourceTemplateId?: string | null;
}

export type CountermeasureUpdateInput = Partial<CountermeasureCreateInput>;

export interface CountermeasureListQuery {
  shapeCategory?: ShapeCategory;
  ppsFunction?: PpsFunction;
  domain?: ProtectionDomain;
  implementationStatus?: ImplementationStatus;
  assignedToAssetId?: string;
  assignedToThreatId?: string;
  q?: string;
}

// ─── COUNTERMEASURE TEMPLATES ─────────────────────────────

export interface CountermeasureTemplateSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  shapeCategory: ShapeCategory;
  ppsFunctions: PpsFunction[];
  domain: ProtectionDomain;
  defaultTearStrategy: TearStrategy | null;
  defaultEffectiveness: VulnerabilityRating | null;
  typicalCostEstimate: number | null;
  typicalAnnualCost: number | null;
  tags: string[];
  csmpUnitReference: string | null;
  module: {
    id: string;
    slug: string;
    name: string;
    package: { id: string; slug: string; name: string };
  };
}

export interface CountermeasureTemplateDetail extends CountermeasureTemplateSummary {
  threatLinks: Array<{
    relevance: Relevance;
    rationale: string | null;
    threatTemplate: {
      id: string;
      slug: string;
      scenarioName: string;
      adversaryType: string;
      actionType: string;
    };
  }>;
}

export interface CountermeasureTemplateListQuery {
  search?: string;
  packageSlug?: string;
  moduleSlug?: string;
  shapeCategory?: ShapeCategory;
  domain?: ProtectionDomain;
  ppsFunction?: PpsFunction;
  page?: number;
  pageSize?: number;
}

// ─── ADMIN TEMPLATES ──────────────────────────────────────

export type OnConflict = 'skip' | 'overwrite' | 'rename';

/**
 * Per-package custom-field definition. Stored on TemplatePackage.customFieldSchema
 * as an array of these. The asset form renders inputs for fields with
 * appliesTo === 'asset' and persists values into Asset.metadata.customFields.
 */
export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';
export type CustomFieldAppliesTo = 'asset' | 'threat' | 'assessment' | 'countermeasure';
export const CUSTOM_FIELD_TYPES: CustomFieldType[] = ['text', 'number', 'select', 'date', 'boolean'];
export const CUSTOM_FIELD_APPLIES_TO: CustomFieldAppliesTo[] = ['asset', 'threat', 'assessment', 'countermeasure'];
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

export interface AdminPackage {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  version: string;
  regionScope: string | null;
  description: string | null;
  complianceRefs: string[];
  isSystem: boolean;
  enabled: boolean;
  /** Legacy packages may have null/object/{}; new code should treat
   * a non-array value as if no custom fields were defined. */
  customFieldSchema: CustomFieldDef[] | Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPackageWithTree extends AdminPackage {
  modules: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    sortOrder: number;
    assetTemplateCount: number;
    threatTemplateCount: number;
    countermeasureTemplateCount: number;
  }>;
}

export interface AdminAssetTemplate {
  id: string;
  slug: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  defaultCriticality: number;
  defaultAssetRole: AssetRole | null;
  description: string | null;
  parentSlug: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
}

export interface AdminThreatTemplate {
  id: string;
  slug: string;
  scenarioName: string;
  adversaryType: AdversaryType;
  actionType: ActionType;
  adversaryProfile: Record<string, unknown> | null;
  typicalActions: string[];
  targetAssetTypes: string[];
  indicators: string[];
  suggestedLikelihood: number | null;
  csmpUnitReference: string | null;
  attributes: Record<string, unknown>;
}

export interface AdminCountermeasureTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  shapeCategory: ShapeCategory;
  ppsFunctions: PpsFunction[];
  domain: ProtectionDomain;
  defaultTearStrategy: TearStrategy | null;
  defaultEffectiveness: VulnerabilityRating | null;
  typicalCostEstimate: number | null;
  typicalAnnualCost: number | null;
  tags: string[];
  csmpUnitReference: string | null;
  attributes: Record<string, unknown>;
}

export interface AdminModuleDetail {
  id: string;
  slug: string;
  name: string;
  packageId: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  assetTemplates: AdminAssetTemplate[];
  threatTemplates: AdminThreatTemplate[];
  countermeasureTemplates: AdminCountermeasureTemplate[];
  assetThreatLinks: Array<{
    assetTemplateId: string;
    threatTemplateId: string;
    relevance: Relevance;
    rationale: string | null;
  }>;
  threatCountermeasureLinks: Array<{
    threatTemplateId: string;
    countermeasureTemplateId: string;
    relevance: Relevance;
    rationale: string | null;
  }>;
}

export interface AdminPackageCreateInput {
  slug: string;
  name: string;
  industry?: string | null;
  version?: string;
  regionScope?: string | null;
  description?: string | null;
  complianceRefs?: string[];
  enabled?: boolean;
  customFieldSchema?: CustomFieldDef[] | null;
}
export type AdminPackageUpdateInput = Partial<AdminPackageCreateInput>;

export interface AdminModuleCreateInput {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  sortOrder?: number;
}
export type AdminModuleUpdateInput = Partial<AdminModuleCreateInput>;

export interface AdminAssetTemplateCreateInput {
  slug: string;
  name: string;
  assetType: AssetType;
  category: AssetCategory;
  defaultCriticality?: number;
  defaultAssetRole?: AssetRole | null;
  description?: string | null;
  parentSlug?: string | null;
  tags?: string[];
  attributes?: Record<string, unknown>;
}
export type AdminAssetTemplateUpdateInput = Partial<AdminAssetTemplateCreateInput>;

export interface AdminThreatTemplateCreateInput {
  slug: string;
  scenarioName: string;
  adversaryType: AdversaryType;
  actionType: ActionType;
  adversaryProfile?: Record<string, unknown> | null;
  typicalActions?: string[];
  targetAssetTypes?: string[];
  indicators?: string[];
  suggestedLikelihood?: number | null;
  csmpUnitReference?: string | null;
  attributes?: Record<string, unknown>;
}
export type AdminThreatTemplateUpdateInput = Partial<AdminThreatTemplateCreateInput>;

export interface AdminCountermeasureTemplateCreateInput {
  slug: string;
  name: string;
  description?: string | null;
  shapeCategory: ShapeCategory;
  ppsFunctions?: PpsFunction[];
  domain: ProtectionDomain;
  defaultTearStrategy?: TearStrategy | null;
  defaultEffectiveness?: VulnerabilityRating | null;
  typicalCostEstimate?: number | null;
  typicalAnnualCost?: number | null;
  tags?: string[];
  csmpUnitReference?: string | null;
  attributes?: Record<string, unknown>;
}
export type AdminCountermeasureTemplateUpdateInput = Partial<AdminCountermeasureTemplateCreateInput>;

export interface JunctionUpsertInput {
  relevance?: Relevance;
  rationale?: string | null;
}

export interface AdminImportResult {
  created: string[];
  updated: string[];
  skipped: string[];
  renamed: Array<{ from: string; to: string }>;
}

// ─── SURVEYS (GRACE Survey Model v2) ──────────────────────
export type SurveyType = 'PHYSICAL' | 'REMOTE_TECH' | 'DOC_REVIEW' | 'HYBRID' | 'CUSTOM';
export type SurveyRating = 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
export type SurveyStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export const SURVEY_TYPES: SurveyType[] = ['PHYSICAL', 'REMOTE_TECH', 'DOC_REVIEW', 'HYBRID', 'CUSTOM'];
export const SURVEY_STATUSES: SurveyStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export interface SurveyQuestion {
  id: string;
  category?: string;
  prompt: string;
  type: 'yes_no_partial' | 'number' | 'text' | 'select';
  weight: number;
  hint?: string;
  options?: string[];
  severityMap?: Record<string, 'ok' | 'warn' | 'bad'>;
}

export interface SurveyTemplateContent {
  questions: SurveyQuestion[];
}

export interface SurveyTemplateSummary {
  id: string;
  tenantId: string | null;
  name: string;
  description: string | null;
  surveyType: SurveyType;
  applicableClusterTypes: string[];
  applicableAssetTypes: string[];
  requiresPhysical: boolean;
  isSystem: boolean;
  isActive: boolean;
  questionCount: number;
  updatedAt: string;
}

export interface SurveyTemplateDetail extends SurveyTemplateSummary {
  schema: SurveyTemplateContent;
}

export interface SurveyTemplateCreateInput {
  name: string;
  description?: string;
  surveyType: SurveyType;
  applicableClusterTypes?: string[];
  applicableAssetTypes?: string[];
  requiresPhysical?: boolean;
  schema: SurveyTemplateContent;
}

export interface SurveyTemplateUpdateInput extends Partial<SurveyTemplateCreateInput> {
  isActive?: boolean;
}

export interface SurveyResponseSummary {
  id: string;
  clusterId: string;
  clusterName: string | null;
  templateId: string;
  templateName: string | null;
  surveyType: SurveyType;
  conductedById: string;
  conductedByName: string | null;
  conductedAt: string;
  scorePct: number | null;
  rating: SurveyRating | null;
  evidenceSource: string | null;
  requiresPhysical: boolean;
  status: SurveyStatus;
  updatedAt: string;
}

export interface SurveyResponseDetail extends SurveyResponseSummary {
  answers: Record<string, unknown>;
  template: SurveyTemplateDetail;
}

export interface SurveyResponseCreateInput {
  clusterId: string;
  templateId: string;
  evidenceSource?: string;
  answers?: Record<string, unknown>;
  conductedAt?: string;
}

export interface SurveyResponseUpdateInput {
  answers?: Record<string, unknown>;
  evidenceSource?: string | null;
}

export interface AssessmentSurveyLink {
  surveyResponseId: string;
  surveyType: SurveyType;
  templateName: string;
  clusterName: string | null;
  status: SurveyStatus;
  rating: SurveyRating | null;
  scorePct: number | null;
  conductedAt: string;
  linkedAt: string;
  linkedByName: string | null;
  vulnerabilityOverride: boolean;
}

export interface AssessmentSurveyLinkCreateInput {
  surveyResponseId: string;
  vulnerabilityOverride?: boolean;
}

// ─── ORG SETTINGS / USERS ADMIN ────────────────────────────

export type SubscriptionTier = 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'REVIEWER' | 'STAKEHOLDER';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type UserDetail = UserSummary;

export interface UserCreateInput {
  email: string;
  firstName: string;
  lastName: string;
  role: UserSummary['role'];
}

export interface UserUpdateInput {
  email?: string;
  firstName?: string;
  lastName?: string;
}
