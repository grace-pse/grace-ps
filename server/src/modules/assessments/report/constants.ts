import type {
  AdversaryType,
  ActionType,
  IrvBand,
  RiskPriority,
  TearStrategy,
  VulnerabilityRating,
  AssetType,
} from '@prisma/client';

// Ordered IRV bands — severity ascending (index 0 = NEGLIGIBLE, 4 = EXTREME).
export const IRV_BANDS: IrvBand[] = ['NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME'];
export const PRIORITIES: RiskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'HIGHEST'];
export const TEARS: TearStrategy[] = ['TRANSFER', 'ELIMINATE', 'ACCEPT', 'REDUCE'];

// Print-safe muted palette (matches report-parts.jsx).
export const IRV_FILL: Record<IrvBand, string> = {
  NEGLIGIBLE: '#eeece6',
  LOW: '#d8dccf',
  MODERATE: '#e8d9a8',
  HIGH: '#d9b995',
  EXTREME: '#c08874',
};
export const IRV_INK: Record<IrvBand, string> = {
  NEGLIGIBLE: '#6b6b68',
  LOW: '#3d5233',
  MODERATE: '#6a4d0a',
  HIGH: '#6b3a12',
  EXTREME: '#5f2013',
};
export const PRIORITY_FILL: Record<RiskPriority, string> = {
  LOW: '#d8dccf',
  MEDIUM: '#e8d9a8',
  HIGH: '#d9b995',
  HIGHEST: '#c08874',
};
export const PRIORITY_INK_KEY: Record<RiskPriority, IrvBand> = {
  LOW: 'LOW',
  MEDIUM: 'MODERATE',
  HIGH: 'HIGH',
  HIGHEST: 'EXTREME',
};

export const ADVERSARY_LABEL: Record<AdversaryType, string> = {
  CRIMINAL: 'Criminal',
  TERRORIST: 'Terrorist',
  INSIDER: 'Insider',
  COMPETITOR: 'Competitor',
  ACTIVIST: 'Activist',
  NATION_STATE: 'Nation-state',
  OPPORTUNIST: 'Opportunist',
  NATURAL: 'Natural',
};

export const ACTION_LABEL: Record<ActionType, string> = {
  THEFT: 'Theft',
  DAMAGE: 'Damage',
  DISRUPTION: 'Disruption',
  ESPIONAGE: 'Espionage',
  SABOTAGE: 'Sabotage',
  ASSAULT: 'Assault',
  INTRUSION: 'Intrusion',
  FRAUD: 'Fraud',
  ARSON: 'Arson',
  BOMB: 'Bomb',
  CYBER: 'Cyber',
  NATURAL_DISASTER: 'Natural disaster',
};

export const VULN_LABEL: Record<VulnerabilityRating, string> = {
  STRONG: 'Strong',
  BASELINE: 'Baseline',
  BARELY_ADEQUATE: 'Barely adequate',
  INADEQUATE: 'Inadequate',
};

export const TEAR_LABEL: Record<TearStrategy, string> = {
  TRANSFER: 'Transfer',
  ELIMINATE: 'Eliminate',
  ACCEPT: 'Accept',
  REDUCE: 'Reduce',
};

export const COMPLIANCE_ORDER = [
  'ISO_31000',
  'NIS2_ART_21',
  'NIS2_ART_23',
  'CER',
  'ASIS_SPC_1',
  'ISO_28000',
] as const;

export const COMPLIANCE_LABEL: Record<string, string> = {
  ISO_31000: 'ISO 31000',
  NIS2_ART_21: 'NIS2 Art. 21',
  NIS2_ART_23: 'NIS2 Art. 23',
  CER: 'CER Directive',
  ASIS_SPC_1: 'ASIS SPC.1',
  ISO_28000: 'ISO 28000',
};

// Cluster grouping for asset register.
export const CLUSTER_ORDER: AssetType[] = [
  'SITE',
  'SYSTEM',
  'BUILDING',
  'FLOOR',
  'ROOM',
  'ZONE',
  'EQUIPMENT',
  'VEHICLE',
  'PERSON',
  'INFORMATION',
  'IP',
  'PROCESS',
  'REPUTATION',
  'CONTINUITY',
];

export const CLUSTER_LABEL: Partial<Record<AssetType, string>> = {
  SITE: 'Sites',
  SYSTEM: 'Systems & domains',
  BUILDING: 'Buildings',
  FLOOR: 'Floors',
  ROOM: 'Rooms',
  ZONE: 'Zones',
  EQUIPMENT: 'Equipment',
  VEHICLE: 'Vehicles',
  PERSON: 'Personnel',
  INFORMATION: 'Information assets',
  IP: 'Intellectual property',
  PROCESS: 'Processes',
  REPUTATION: 'Reputation assets',
  CONTINUITY: 'Continuity assets',
};
