import type {
  ActionPlan,
  Assessment,
  Asset,
  AssetType,
  IrvBand,
  Recommendation,
  Threat,
  User,
} from '@prisma/client';

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

export interface ReportData {
  organization: { name: string };
  assessment: Assessment;
  scope: { label: string; description: string | null };
  leadAssessor: UserRef | null;
  reviewer: UserRef | null;
  approver: UserRef | null;
  scopeAssets: ScopeAsset[];
  threats: ReportThreat[];
  actionPlans: ActionPlan[];
  recommendations: Recommendation[];
  changeLog: ChangeLogEntry[];
  generatedAt: Date;
}

export type AssetTypeKey = AssetType;
