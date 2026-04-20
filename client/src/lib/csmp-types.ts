export type AssetType =
  | 'SITE' | 'BUILDING' | 'FLOOR' | 'ROOM' | 'ZONE'
  | 'EQUIPMENT' | 'VEHICLE' | 'PERSON' | 'INFORMATION'
  | 'IP' | 'PROCESS' | 'REPUTATION' | 'CONTINUITY';

export type AssetCategory = 'TANGIBLE' | 'INTANGIBLE';
export type AssetStatus = 'ACTIVE' | 'DECOMMISSIONED' | 'UNDER_REVIEW' | 'COMPROMISED';
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
  parentId?: string | null;
  tags?: string[];
  sourceTemplateId?: string | null;
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
  description: string | null;
  tags: string[];
  module: {
    id: string;
    slug: string;
    name: string;
    package: { id: string; slug: string; name: string };
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
  | 'COMMUNICATES_WITH' | 'ADJACENT_TO' | 'SUPPLIES';

export type RelDirection = 'UNIDIRECTIONAL' | 'BIDIRECTIONAL';

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'DEPENDS_ON', 'PROTECTS', 'SERVES', 'CONTAINS',
  'COMMUNICATES_WITH', 'ADJACENT_TO', 'SUPPLIES',
];

export const RELATIONSHIP_TYPE_LABEL: Record<RelationshipType, string> = {
  DEPENDS_ON: 'depends on',
  PROTECTS: 'protects',
  SERVES: 'serves',
  CONTAINS: 'contains',
  COMMUNICATES_WITH: 'communicates with',
  ADJACENT_TO: 'adjacent to',
  SUPPLIES: 'supplies',
};

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
}

export interface AssetGraphResponse {
  nodes: AssetGraphNode[];
  edges: AssetRelationshipSummary[];
}

export interface AssetRelationshipCreateInput {
  sourceAssetId: string;
  targetAssetId: string;
  relationshipType: RelationshipType;
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
  threatCount: number;
  highestPriority: RiskPriority | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
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

export interface AssessmentCreateInput {
  title: string;
  assessmentType?: AssessmentType;
  assetId?: string | null;
  clusterId?: string | null;
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
  | 'SUBMITTED_FOR_REVIEW' | 'APPROVED' | 'REJECTED' | 'MANUAL_SAVE';

export const SNAPSHOT_REASON_LABEL: Record<SnapshotReason, string> = {
  SUBMITTED_FOR_REVIEW: 'Submitted for review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  MANUAL_SAVE: 'Manual save',
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
