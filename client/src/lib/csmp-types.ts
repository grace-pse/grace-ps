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

export interface AssetDetail extends Omit<AssetSummary, 'childCount'> {
  description: string | null;
  location: Record<string, unknown> | null;
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
}
