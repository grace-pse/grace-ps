import type {
  ActionPlan,
  Assessment,
  Asset,
  AssetType,
  Countermeasure,
  CountermeasureGap,
  IrvBand,
  Recommendation,
  Threat,
  User,
} from '@prisma/client';
import type { ProtectiveCoverageItem } from '../../../lib/protective-coverage.js';

export type UserRef = Pick<User, 'firstName' | 'lastName' | 'email'> & {
  role?: string | null;
};

export type ScopeAsset = Pick<Asset, 'id' | 'name' | 'assetType' | 'criticality'>;

export interface ReportDbtReference {
  id: string;
  scenarioName: string;
  csmpUnitReference: string | null;
  typicalActions: string[];
  indicators: string[];
}

export type ReportThreat = Threat & {
  targetAsset: Pick<Asset, 'id' | 'name' | 'assetType' | 'criticality'> | null;
  dbtReference: ReportDbtReference | null;
  // Computed in data.ts — not stored.
  irvScore: number;
  residualIrvIdx: number;
  residualIrv: IrvBand;
};

export interface ChangeLogEntry {
  date: Date;
  user: string;
  action: string;
  detail: string;
}

export type ReportCountermeasure = Pick<
  Countermeasure,
  'id' | 'name' | 'shapeCategory' | 'ppsFunctions' | 'domain'
  | 'implementationStatus' | 'effectivenessRating' | 'effectivenessScore'
  | 'surveyRatingNumeric' | 'gapDelta' | 'isExisting'
  | 'assignedToAssetId' | 'assignedToThreatId'
> & { assignedToAssetName: string | null };

export type ReportCountermeasureGap = Pick<
  CountermeasureGap,
  'id' | 'threatId' | 'countermeasureId' | 'gapType' | 'gapSeverity'
  | 'description' | 'recommendedAction' | 'drivesTreatmentPriority' | 'isOpen'
  | 'createdAt'
> & { countermeasureName: string | null };

export interface ReportData {
  organization: { name: string };
  assessment: Assessment;
  scope: { label: string; description: string | null };
  leadAssessor: UserRef | null;
  reviewer: UserRef | null;
  approver: UserRef | null;
  scopeAssets: ScopeAsset[];
  protectiveCoverage: ProtectiveCoverageItem[];
  threats: ReportThreat[];
  actionPlans: ActionPlan[];
  recommendations: Recommendation[];
  changeLog: ChangeLogEntry[];
  // Step 6 bridge — populated by buildReportData.
  existingCountermeasures: ReportCountermeasure[];
  openGaps: ReportCountermeasureGap[];
  generatedAt: Date;
}

export type AssetTypeKey = AssetType;
