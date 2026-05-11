/**
 * CSMP v2 — Nordica Logistics AG demo seeder.
 *
 * Ported from csmp-run/seed.py (frozen Python reference) to TypeScript/Prisma.
 * Adapted for the OSS-launch scope: Warszawa / Hamburg / Oslo sites, 4 users
 * matching csmp_v2 RBAC (no INCIDENT_RESPONDER / APPROVER / READ_ONLY), no
 * incidents / questionnaires / audit_log (out of scope for OSS launch).
 *
 * Usage:
 *   pnpm -F @csmp/server db:seed              # idempotent top-up (skip existing)
 *   pnpm -F @csmp/server db:seed -- --reset   # wipe Nordica org + reseed
 *
 * Default login after seeding:
 *   admin@nordica.demo       / Demo123!   (ADMIN)
 *   lead@nordica.demo        / Demo123!   (LEAD_ASSESSOR)
 *   assessor@nordica.demo    / Demo123!   (ASSESSOR)
 *   reviewer@nordica.demo    / Demo123!   (REVIEWER)
 *   stakeholder@nordica.demo / Demo123!   (STAKEHOLDER)
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORG_SLUG = 'nordica';
const ORG_NAME = 'Nordica Logistics AG';
const DEMO_PASSWORD = 'Demo123!';
const NOW = new Date();

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

// Mirror of slugify() in server/src/modules/assets/path.ts. Inlined here so
// the prisma/ seeder has no cross-folder dependency on src/. Seed inputs are
// curated to have unique sibling names, so collision-suffixing is unneeded.
function slugifySegment(name: string): string {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'asset';
}

// ═══════════════════════════════════════════════════════════
// SCENARIO DATA
// ═══════════════════════════════════════════════════════════

type UserSeed = {
  email: string;
  first: string;
  last: string;
  role: 'ADMIN' | 'LEAD_ASSESSOR' | 'ASSESSOR' | 'REVIEWER' | 'STAKEHOLDER';
  createdDaysAgo: number;
  lastLoginDaysAgo: number;
};

const USERS: UserSeed[] = [
  { email: 'admin@nordica.demo',       first: 'Marek',  last: 'Kowalski',  role: 'ADMIN',          createdDaysAgo: 90, lastLoginDaysAgo: 0 },
  { email: 'lead@nordica.demo',        first: 'Anna',   last: 'Schmidt',   role: 'LEAD_ASSESSOR',  createdDaysAgo: 85, lastLoginDaysAgo: 1 },
  { email: 'assessor@nordica.demo',    first: 'Jakub',  last: 'Kowal',     role: 'ASSESSOR',       createdDaysAgo: 85, lastLoginDaysAgo: 2 },
  { email: 'reviewer@nordica.demo',    first: 'Henrik', last: 'Sorensen',  role: 'REVIEWER',       createdDaysAgo: 85, lastLoginDaysAgo: 3 },
  { email: 'stakeholder@nordica.demo', first: 'Ingrid', last: 'Larsen',    role: 'STAKEHOLDER',    createdDaysAgo: 80, lastLoginDaysAgo: 5 },
];

type SiteSeed = {
  name: string;
  description: string;
  criticality: number;
  address: string;
  lat: number;
  lng: number;
};

const SITES: SiteSeed[] = [
  {
    name: 'Warszawa HQ',
    description: 'Corporate headquarters — executive offices, NOC, primary data center',
    criticality: 5,
    address: 'ul. Marszałkowska 100, 00-026 Warszawa, PL',
    lat: 52.2297, lng: 21.0122,
  },
  {
    name: 'Hamburg Distribution Hub',
    description: 'Primary cross-dock distribution hub — 24/7 ops, cold-chain certified',
    criticality: 5,
    address: 'Am Kaiserkai 56, 20457 Hamburg, DE',
    lat: 53.5511, lng: 9.9937,
  },
  {
    name: 'Oslo Regional Office',
    description: 'Nordic regional ops office — sales, compliance, secondary DR site',
    criticality: 4,
    address: 'Karl Johans gate 22, 0159 Oslo, NO',
    lat: 59.9139, lng: 10.7522,
  },
];

type AssetTypeSeed =
  | 'SITE' | 'BUILDING' | 'FLOOR' | 'ROOM' | 'ZONE' | 'EQUIPMENT'
  | 'VEHICLE' | 'PERSON' | 'INFORMATION' | 'IP' | 'PROCESS' | 'REPUTATION' | 'CONTINUITY';

type ChildAssetSeed = {
  parent: string;
  name: string;
  assetType: AssetTypeSeed;
  category: 'TANGIBLE' | 'INTANGIBLE';
  criticality: number;
  description: string;
  assetRole?: 'PROTECTED' | 'PROTECTIVE' | 'DUAL';
};

// Hierarchy: Site → Building → (Floor → Room) + Zone/Equipment/Information
const CHILD_ASSETS: ChildAssetSeed[] = [
  // Warszawa HQ
  { parent: 'Warszawa HQ',                 name: 'HQ Main Building',         assetType: 'BUILDING',    category: 'TANGIBLE',   criticality: 5, description: '9-storey corporate tower, 24/7 access' },
  { parent: 'HQ Main Building',            name: 'HQ Ground Floor',          assetType: 'FLOOR',       category: 'TANGIBLE',   criticality: 4, description: 'Reception, visitor mgmt, security desk' },
  { parent: 'HQ Ground Floor',             name: 'HQ Reception',             assetType: 'ROOM',        category: 'TANGIBLE',   criticality: 4, description: 'Manned reception with turnstile mantrap' },
  { parent: 'HQ Main Building',            name: 'HQ 8th Floor',             assetType: 'FLOOR',       category: 'TANGIBLE',   criticality: 5, description: 'C-suite and executive offices' },
  { parent: 'HQ 8th Floor',                name: 'HQ Executive Suite',       assetType: 'ROOM',        category: 'TANGIBLE',   criticality: 5, description: 'CEO / CFO offices, board room' },
  { parent: 'HQ Main Building',            name: 'HQ Server Room',           assetType: 'ROOM',        category: 'TANGIBLE',   criticality: 5, description: 'Tier-III data center, biometric entry' },
  { parent: 'Warszawa HQ',                 name: 'HQ Perimeter',             assetType: 'ZONE',        category: 'TANGIBLE',   criticality: 4, description: 'Anti-climb palisade, 2.4m, lit perimeter' },
  { parent: 'Warszawa HQ',                 name: 'HQ CCTV Array',            assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: '48 IP cameras, 30-day retention, VMS in NOC',          assetRole: 'PROTECTIVE' },
  { parent: 'Warszawa HQ',                 name: 'HQ Access Control System', assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 5, description: 'HID Edge controllers, 240 card readers',                assetRole: 'PROTECTIVE' },
  { parent: 'HQ 8th Floor',                name: 'HQ Executive Floor CCTV',  assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'PTZ cameras covering CEO/CFO suite + boardroom approaches', assetRole: 'PROTECTIVE' },
  { parent: 'HQ Server Room',              name: 'HQ Database Encryption',   assetType: 'PROCESS',     category: 'INTANGIBLE', criticality: 5, description: 'TDE + column-level encryption protecting customer PII at rest', assetRole: 'PROTECTIVE' },
  { parent: 'Warszawa HQ',                 name: 'Customer Database',        assetType: 'INFORMATION', category: 'INTANGIBLE', criticality: 5, description: 'PII of 2.1M customers, GDPR in scope' },

  // Hamburg Distribution Hub
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Warehouse',        assetType: 'BUILDING',    category: 'TANGIBLE',   criticality: 5, description: 'Cross-dock warehouse, 12 loading bays' },
  { parent: 'Hamburg Warehouse',           name: 'Hamburg Loading Dock A',   assetType: 'ZONE',        category: 'TANGIBLE',   criticality: 5, description: '12 bays, inbound — highest-value cargo' },
  { parent: 'Hamburg Warehouse',           name: 'Hamburg Cold Storage',     assetType: 'ROOM',        category: 'TANGIBLE',   criticality: 5, description: 'Pharma-grade -20C / +2-8C cold chain' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Perimeter',        assetType: 'ZONE',        category: 'TANGIBLE',   criticality: 4, description: '3 km perimeter, CCTV-monitored, 5 gates' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Main Gate',        assetType: 'ZONE',        category: 'TANGIBLE',   criticality: 5, description: 'Vehicle inspection bay, RFID + LPR' },
  { parent: 'Hamburg Warehouse',           name: 'Hamburg Dock CCTV',        assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: '16 cameras covering bays 1-12, with LPR feed',         assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Warehouse',           name: 'Hamburg Cold Storage IDS', assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'Door contacts + glass-break + thermal anomaly detection', assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Gate ACS',         assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 5, description: 'Vehicle bollards + RFID/LPR enforcement at the main gate', assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Perimeter Fence',  assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: '3 km anti-climb fence with 1.2 km fibre-optic intrusion detection', assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Perimeter CCTV',   assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'Thermal + PTZ cameras every 200m along the fence line',  assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Security Patrol',  assetType: 'PERSON',      category: 'TANGIBLE',   criticality: 4, description: 'Two licensed guards, 24/7 mobile patrol, 5-min response SLA', assetRole: 'PROTECTIVE' },

  // Oslo Regional Office
  { parent: 'Oslo Regional Office',        name: 'Oslo Office Building',     assetType: 'BUILDING',    category: 'TANGIBLE',   criticality: 4, description: '3-storey office, shared lobby' },
  { parent: 'Oslo Office Building',        name: 'Oslo DR Server Room',      assetType: 'ROOM',        category: 'TANGIBLE',   criticality: 4, description: 'Secondary DR hot site, async replication from Warszawa' },
  { parent: 'Oslo Office Building',        name: 'Oslo Office ACS',          assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'Card reader on shared lobby + biometric on DR room',    assetRole: 'PROTECTIVE' },
];

// ═══════════════════════════════════════════════════════════
// ASSESSMENT — 1 APPROVED, ~8 threats, mix of TEAR strategies + ALARP
// ═══════════════════════════════════════════════════════════

type ThreatSeed = {
  target: string;
  adversaryType: 'CRIMINAL' | 'TERRORIST' | 'INSIDER' | 'COMPETITOR' | 'ACTIVIST' | 'NATION_STATE' | 'OPPORTUNIST' | 'NATURAL';
  adversaryDescription: string;
  actionType: 'THEFT' | 'DAMAGE' | 'DISRUPTION' | 'ESPIONAGE' | 'SABOTAGE' | 'ASSAULT' | 'INTRUSION' | 'FRAUD' | 'ARSON' | 'BOMB' | 'CYBER' | 'NATURAL_DISASTER';
  actionDescription: string;
  locationContext: string;
  facilitatingFactors: string;
  timeContext: string;
  likelihood: number;
  likelihoodRationale: string;
  impactBreakdown: { people: number; property: number; operations: number; reputation: number; financial: number };
  impactRationale: string;
  vulnerability: 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
  vulnerabilityRationale: string;
  tearStrategy: 'TRANSFER' | 'ELIMINATE' | 'ACCEPT' | 'REDUCE';
  alarpJustification: string;
  complianceTags: string[];
};

const ASSESSMENT_THREATS: ThreatSeed[] = [
  {
    target: 'HQ Server Room',
    adversaryType: 'INSIDER',
    adversaryDescription: 'Disgruntled IT ops engineer with privileged physical access',
    actionType: 'SABOTAGE',
    actionDescription: 'Tampering with cooling or power to disrupt data-center operations',
    locationContext: 'After-hours access via badge with vendor escort override',
    facilitatingFactors: 'Insider access credentials; limited dual-control on cooling panel',
    timeContext: 'Night shift, weekends',
    likelihood: 3,
    likelihoodRationale: 'Background checks in place; recent layoffs increase grievance risk',
    impactBreakdown: { people: 2, property: 4, operations: 5, reputation: 4, financial: 4 },
    impactRationale: 'Data-center outage cascades to customer-facing systems; 2h outage ≈ EUR 180k revenue loss',
    vulnerability: 'BASELINE',
    vulnerabilityRationale: 'Two-person rule on critical panels; monitoring gaps on BMS overrides',
    tearStrategy: 'REDUCE',
    alarpJustification: 'Zero-cost admin control (two-person rule) directly addresses insider vector; residual monitored via SIEM.',
    complianceTags: ['ISO_31000', 'NIS2_ART_21'],
  },
  {
    target: 'Customer Database',
    adversaryType: 'NATION_STATE',
    adversaryDescription: 'Advanced persistent threat actor targeting EU logistics PII',
    actionType: 'CYBER',
    actionDescription: 'Exfiltration of 2.1M customer records via compromised admin workstation',
    locationContext: 'Remote C2 + insider handoff of credentials',
    facilitatingFactors: 'Flat internal network; admin endpoints with local admin rights',
    timeContext: 'Anytime — persistent campaign',
    likelihood: 4,
    likelihoodRationale: 'Sector-specific targeting observed in ENISA 2025 threat landscape',
    impactBreakdown: { people: 3, property: 1, operations: 3, reputation: 5, financial: 5 },
    impactRationale: 'GDPR max fine exposure + loss of B2B contracts under SSR 2027 regulations',
    vulnerability: 'BARELY_ADEQUATE',
    vulnerabilityRationale: 'No network segmentation between corp and ops; endpoint detection gap',
    tearStrategy: 'REDUCE',
    alarpJustification: 'NIS2 Art.21 mandates technical measures; VLAN + PAW rollout ALARP-justified vs. EUR 2.4M exposure.',
    complianceTags: ['NIS2_ART_21', 'ISO_31000'],
  },
  {
    target: 'HQ Reception',
    adversaryType: 'OPPORTUNIST',
    adversaryDescription: 'Opportunistic delivery-person tailgating through reception',
    actionType: 'INTRUSION',
    actionDescription: 'Unauthorized access to lobby and elevators by piggybacking on authorized staff',
    locationContext: 'Reception, morning rush hour',
    facilitatingFactors: 'Single-door access; courtesy hold-open culture',
    timeContext: '07:30-09:30 weekdays',
    likelihood: 4,
    likelihoodRationale: 'Observed during December 2025 walk-through audit',
    impactBreakdown: { people: 2, property: 2, operations: 1, reputation: 2, financial: 1 },
    impactRationale: 'Limited downstream impact — interior floors badge-controlled',
    vulnerability: 'BARELY_ADEQUATE',
    vulnerabilityRationale: 'No mantrap at reception; awareness training completed Jun 2025',
    tearStrategy: 'REDUCE',
    alarpJustification: 'Mantrap turnstile installation Q2 2026; awareness refresher closes gap at low marginal cost.',
    complianceTags: ['ASIS_SPC_1'],
  },
  {
    target: 'Hamburg Loading Dock A',
    adversaryType: 'CRIMINAL',
    adversaryDescription: 'Organized cargo-theft crew targeting high-value electronics',
    actionType: 'THEFT',
    actionDescription: 'Coordinated distraction + forced entry during inbound unloading',
    locationContext: 'Dock A, peak inbound window 02:00-05:00',
    facilitatingFactors: 'Schedule leaks; contractor drivers with minimal vetting',
    timeContext: 'Weeknights, 02:00-05:00',
    likelihood: 4,
    likelihoodRationale: '3 near-misses Q4 2025 at Benelux ports per Europol SOCTA-2025',
    impactBreakdown: { people: 3, property: 5, operations: 4, reputation: 3, financial: 5 },
    impactRationale: 'Single container loss can exceed EUR 800k; insurance retention EUR 250k',
    vulnerability: 'BASELINE',
    vulnerabilityRationale: '24/7 patrol + CCTV; contractor vetting inconsistent',
    tearStrategy: 'REDUCE',
    alarpJustification: 'K9 patrol + AI video analytics + TAPA FSR Level A vetting; annualized saving > programme cost.',
    complianceTags: ['ISO_28000', 'ASIS_SPC_1'],
  },
  {
    target: 'Hamburg Main Gate',
    adversaryType: 'TERRORIST',
    adversaryDescription: 'Vehicle-borne improvised explosive device — critical-infrastructure target profile',
    actionType: 'BOMB',
    actionDescription: 'VBIED ramming main gate at shift change',
    locationContext: 'Main gate vehicle lane',
    facilitatingFactors: 'Limited standoff distance; wedge barriers retracted during shift change',
    timeContext: '06:00, 14:00, 22:00 shift changes',
    likelihood: 2,
    likelihoodRationale: 'Low base rate for logistics vs. govt/mil; critical infra on NIS2/CER list',
    impactBreakdown: { people: 5, property: 5, operations: 5, reputation: 5, financial: 4 },
    impactRationale: 'Mass-casualty potential + full site denial for 2+ weeks',
    vulnerability: 'BARELY_ADEQUATE',
    vulnerabilityRationale: 'Wedge barriers present but no perimeter standoff; no under-vehicle scan',
    tearStrategy: 'REDUCE',
    alarpJustification: 'K12/L3 wedge + 15m standoff is sole ALARP control for mass-casualty VBIED; high capex accepted.',
    complianceTags: ['CER', 'NIS2_ART_23'],
  },
  {
    target: 'Hamburg Cold Storage',
    adversaryType: 'NATURAL',
    adversaryDescription: 'Power outage — GxP-regulated temperature excursion',
    actionType: 'NATURAL_DISASTER',
    actionDescription: 'Loss of cold-chain due to grid + generator dual failure',
    locationContext: 'Hamburg warehouse — cold storage rooms',
    facilitatingFactors: 'Aging generator; no N+1 redundancy on chillers',
    timeContext: 'Any time',
    likelihood: 2,
    likelihoodRationale: 'Grid failures rare; generator tested monthly',
    impactBreakdown: { people: 1, property: 3, operations: 4, reputation: 4, financial: 5 },
    impactRationale: 'Pharma-grade cargo loss + GxP violation reporting to regulator',
    vulnerability: 'BASELINE',
    vulnerabilityRationale: '72h generator autonomy, but no geographically-separate redundancy',
    tearStrategy: 'TRANSFER',
    alarpJustification: 'Residual risk transferred via cold-chain insurance policy; generator replacement 2027 capex cycle.',
    complianceTags: ['ISO_28000'],
  },
  {
    target: 'HQ Executive Suite',
    adversaryType: 'ACTIVIST',
    adversaryDescription: 'Climate-activist protest targeting logistics executives',
    actionDescription: 'Office occupation + glue-lock protest; social-media livestream',
    actionType: 'DISRUPTION',
    locationContext: 'HQ 8th floor, executive suite',
    facilitatingFactors: 'Published CEO schedule; single elevator bank to exec floor',
    timeContext: 'Daytime — media impact maximized',
    likelihood: 2,
    likelihoodRationale: 'Two comparable incidents in Frankfurt/Berlin Q1 2026',
    impactBreakdown: { people: 1, property: 2, operations: 3, reputation: 4, financial: 2 },
    impactRationale: 'Board disruption + viral coverage damages stakeholder trust',
    vulnerability: 'BASELINE',
    vulnerabilityRationale: 'Access control + CCTV; no dedicated activist-liaison or crisis-comms playbook',
    tearStrategy: 'ACCEPT',
    alarpJustification: 'Residual risk accepted — further hardening disproportionate to exposure; monitored via threat intel.',
    complianceTags: ['ISO_31000'],
  },
  {
    target: 'Oslo DR Server Room',
    adversaryType: 'INSIDER',
    adversaryDescription: 'Former sysadmin with retained knowledge of DR architecture',
    actionType: 'ESPIONAGE',
    actionDescription: 'Competitor-sponsored data exfiltration from DR replication stream',
    locationContext: 'Oslo DR hot site',
    facilitatingFactors: 'Slow credential revocation after terminations',
    timeContext: 'Post-termination 30-day window',
    likelihood: 2,
    likelihoodRationale: 'Industry-wide risk; no confirmed incidents internally',
    impactBreakdown: { people: 1, property: 1, operations: 2, reputation: 4, financial: 4 },
    impactRationale: 'Trade-secret loss + competitive disadvantage',
    vulnerability: 'STRONG',
    vulnerabilityRationale: '24h credential-revocation SLA enforced; quarterly audit of active accounts',
    tearStrategy: 'ELIMINATE',
    alarpJustification: 'Credential revocation SLA eliminates the attack window; control verified quarterly.',
    complianceTags: ['NIS2_ART_21'],
  },
];

// ═══════════════════════════════════════════════════════════
// COUNTERMEASURES (SHAPE framework, linked to threats)
// ═══════════════════════════════════════════════════════════

type CountermeasureSeed = {
  name: string;
  description: string;
  shapeCategory: 'SECURITY_PROGRAMME' | 'HUMAN' | 'ARCHITECTURAL' | 'PROCEDURAL' | 'EQUIPMENT';
  ppsFunctions: ('DETER' | 'DETECT' | 'DELAY' | 'DENY' | 'DISRUPT' | 'DEFEAT' | 'RECOVER')[];
  domain: 'PERIMETER' | 'BUILDING' | 'ACCESS' | 'SURVEILLANCE' | 'INFORMATION' | 'PERSONNEL' | 'COUNTERTERRORISM';
  implementationStatus: 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED' | 'DECOMMISSIONED';
  costEstimate: number;
  annualCost: number;
  effectivenessRating: 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
  assignedToAsset: string;
  linkTargetAsset: string;
  linkActionType: ThreatSeed['actionType'];
  tearStrategy: 'TRANSFER' | 'ELIMINATE' | 'ACCEPT' | 'REDUCE';
  alarpJustification: string;
};

const COUNTERMEASURES: CountermeasureSeed[] = [
  {
    name: 'Two-person rule — server room cooling panels',
    description: 'All cooling/power panel access requires two authorized personnel; logged in BMS',
    shapeCategory: 'PROCEDURAL',
    ppsFunctions: ['DETER', 'DETECT'],
    domain: 'BUILDING',
    implementationStatus: 'IMPLEMENTED',
    costEstimate: 0, annualCost: 0,
    effectivenessRating: 'STRONG',
    assignedToAsset: 'HQ Server Room',
    linkTargetAsset: 'HQ Server Room',
    linkActionType: 'SABOTAGE',
    tearStrategy: 'REDUCE',
    alarpJustification: 'Zero-cost administrative control; directly addresses insider vector.',
  },
  {
    name: 'Network segmentation — corp ↔ ops VLANs',
    description: 'VLAN segmentation + east-west firewall; privileged-access workstations for admins',
    shapeCategory: 'EQUIPMENT',
    ppsFunctions: ['DENY', 'DETECT'],
    domain: 'INFORMATION',
    implementationStatus: 'IN_PROGRESS',
    costEstimate: 180000, annualCost: 24000,
    effectivenessRating: 'BASELINE',
    assignedToAsset: 'Customer Database',
    linkTargetAsset: 'Customer Database',
    linkActionType: 'CYBER',
    tearStrategy: 'REDUCE',
    alarpJustification: 'Addresses NIS2 Art.21 technical measures; residual accepted with monitoring.',
  },
  {
    name: 'Optical turnstile mantrap at HQ reception',
    description: 'Full-height mantrap replacing current single-door flow; anti-tailgate sensors',
    shapeCategory: 'ARCHITECTURAL',
    ppsFunctions: ['DENY', 'DELAY'],
    domain: 'ACCESS',
    implementationStatus: 'APPROVED',
    costEstimate: 75000, annualCost: 4000,
    effectivenessRating: 'STRONG',
    assignedToAsset: 'HQ Reception',
    linkTargetAsset: 'HQ Reception',
    linkActionType: 'INTRUSION',
    tearStrategy: 'REDUCE',
    alarpJustification: 'Directly addresses primary vulnerability; Q2 2026 installation.',
  },
  {
    name: '24/7 K9 patrol — Hamburg Dock A',
    description: 'Minimum 4 officers + K9 unit on rotating patrol, radio check-in every 20 min',
    shapeCategory: 'HUMAN',
    ppsFunctions: ['DETER', 'DETECT', 'DELAY'],
    domain: 'PERIMETER',
    implementationStatus: 'IMPLEMENTED',
    costEstimate: 380000, annualCost: 380000,
    effectivenessRating: 'STRONG',
    assignedToAsset: 'Hamburg Loading Dock A',
    linkTargetAsset: 'Hamburg Loading Dock A',
    linkActionType: 'THEFT',
    tearStrategy: 'REDUCE',
    alarpJustification: 'Cost justified vs. EUR 800k+ single-event exposure; residual risk accepted.',
  },
  {
    name: 'K12/L3 wedge barriers + 15m standoff',
    description: 'Crash-rated wedge barriers with vehicle inspection bay and under-vehicle scanner',
    shapeCategory: 'ARCHITECTURAL',
    ppsFunctions: ['DENY', 'DELAY'],
    domain: 'COUNTERTERRORISM',
    implementationStatus: 'PROPOSED',
    costEstimate: 420000, annualCost: 12000,
    effectivenessRating: 'STRONG',
    assignedToAsset: 'Hamburg Main Gate',
    linkTargetAsset: 'Hamburg Main Gate',
    linkActionType: 'BOMB',
    tearStrategy: 'REDUCE',
    alarpJustification: 'High-cost but only ALARP control for mass-casualty VBIED; CER Art.13 alignment.',
  },
];

// ═══════════════════════════════════════════════════════════
// ACTION PLANS
// ═══════════════════════════════════════════════════════════

type ActionPlanSeed = {
  linkTargetAsset: string;
  linkActionType: ThreatSeed['actionType'];
  actionRequired: string;
  responsiblePerson: string;
  targetDaysFromNow: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  completionDaysAgo?: number;
  evidence?: string;
  roiEstimate: { avoided_losses: number; programme_cost: number; roi_ratio: number };
  complianceTags: string[];
};

const ACTION_PLANS: ActionPlanSeed[] = [
  {
    linkTargetAsset: 'Customer Database',
    linkActionType: 'CYBER',
    actionRequired: 'Network segmentation: isolate corp LAN from ops VLAN; deploy EDR on admin endpoints',
    responsiblePerson: 'M. Laine (Head of IT Security)',
    targetDaysFromNow: 45,
    status: 'IN_PROGRESS',
    roiEstimate: { avoided_losses: 2400000, programme_cost: 380000, roi_ratio: 6.3 },
    complianceTags: ['NIS2_ART_21', 'ISO_31000'],
  },
  {
    linkTargetAsset: 'HQ Reception',
    linkActionType: 'INTRUSION',
    actionRequired: 'Install optical turnstile mantrap at reception; refresh tailgating awareness training',
    responsiblePerson: 'Anna Schmidt',
    targetDaysFromNow: 90,
    status: 'PENDING',
    roiEstimate: { avoided_losses: 120000, programme_cost: 65000, roi_ratio: 1.8 },
    complianceTags: ['ASIS_SPC_1'],
  },
  {
    linkTargetAsset: 'HQ Server Room',
    linkActionType: 'SABOTAGE',
    actionRequired: 'Enforce two-person rule on BMS/cooling panel changes; add audit logging on override events',
    responsiblePerson: 'M. Laine (Head of IT Security)',
    targetDaysFromNow: -7, // intentionally past-due
    status: 'PENDING',
    roiEstimate: { avoided_losses: 540000, programme_cost: 0, roi_ratio: 100 },
    complianceTags: ['ISO_31000', 'NIS2_ART_21'],
  },
  {
    linkTargetAsset: 'Hamburg Loading Dock A',
    linkActionType: 'THEFT',
    actionRequired: 'Roll out contractor-driver vetting aligned to TAPA FSR Level A',
    responsiblePerson: 'Henrik Sorensen',
    targetDaysFromNow: 60,
    status: 'IN_PROGRESS',
    roiEstimate: { avoided_losses: 800000, programme_cost: 90000, roi_ratio: 8.9 },
    complianceTags: ['ISO_28000', 'ASIS_SPC_1'],
  },
  {
    linkTargetAsset: 'Hamburg Main Gate',
    linkActionType: 'BOMB',
    actionRequired: 'Extend perimeter standoff via relocated visitor parking + under-vehicle scanners',
    responsiblePerson: 'Henrik Sorensen',
    targetDaysFromNow: 180,
    status: 'PENDING',
    roiEstimate: { avoided_losses: 15000000, programme_cost: 420000, roi_ratio: 35.7 },
    complianceTags: ['CER', 'NIS2_ART_23'],
  },
  {
    linkTargetAsset: 'HQ Executive Suite',
    linkActionType: 'DISRUPTION',
    actionRequired: 'Draft crisis-comms playbook + designate activist-liaison officer',
    responsiblePerson: 'Anna Schmidt',
    targetDaysFromNow: -30,
    status: 'COMPLETED',
    completionDaysAgo: 5,
    evidence: 'Playbook v1.0 signed off by comms + legal 2026-04-13. Liaison officer named (A. Schmidt, backup: H. Sorensen).',
    roiEstimate: { avoided_losses: 250000, programme_cost: 5000, roi_ratio: 50 },
    complianceTags: ['ISO_31000'],
  },
];

// ═══════════════════════════════════════════════════════════
// RISK MATRICES (inline copies of server/src/lib/risk-engine.ts)
// ═══════════════════════════════════════════════════════════

type IrvBand = 'NEGLIGIBLE' | 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
type RiskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST';

const IRV_MATRIX: IrvBand[][] = [
  ['NEGLIGIBLE', 'NEGLIGIBLE', 'LOW',      'LOW',      'MODERATE'],
  ['NEGLIGIBLE', 'LOW',        'LOW',      'MODERATE', 'HIGH'],
  ['NEGLIGIBLE', 'LOW',        'MODERATE', 'HIGH',     'HIGH'],
  ['LOW',        'MODERATE',   'HIGH',     'HIGH',     'EXTREME'],
  ['LOW',        'MODERATE',   'HIGH',     'EXTREME',  'EXTREME'],
];

const PRIORITY_MATRIX: RiskPriority[][] = [
  ['LOW',    'LOW',    'LOW',     'LOW'],     // NEGLIGIBLE
  ['LOW',    'LOW',    'LOW',     'MEDIUM'],  // LOW
  ['LOW',    'LOW',    'MEDIUM',  'HIGH'],    // MODERATE
  ['LOW',    'MEDIUM', 'HIGH',    'HIGHEST'], // HIGH
  ['MEDIUM', 'HIGH',   'HIGHEST', 'HIGHEST'], // EXTREME
];

const IRV_IDX: Record<IrvBand, number> = { NEGLIGIBLE: 0, LOW: 1, MODERATE: 2, HIGH: 3, EXTREME: 4 };
const VULN_IDX = { STRONG: 0, BASELINE: 1, BARELY_ADEQUATE: 2, INADEQUATE: 3 } as const;

function calculateIrv(likelihood: number, impact: number): IrvBand {
  const l = Math.max(1, Math.min(5, likelihood)) - 1;
  const i = Math.max(1, Math.min(5, impact)) - 1;
  return IRV_MATRIX[l]![i]!;
}

function calculatePriority(irv: IrvBand, vulnerability: keyof typeof VULN_IDX): RiskPriority {
  return PRIORITY_MATRIX[IRV_IDX[irv]]![VULN_IDX[vulnerability]]!;
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function wipeNordica() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) return;
  const tid = org.id;

  // FK-safe order
  await prisma.actionPlan.deleteMany({ where: { assessment: { tenantId: tid } } });
  await prisma.assessmentSnapshot.deleteMany({ where: { assessment: { tenantId: tid } } });
  await prisma.countermeasure.deleteMany({ where: { tenantId: tid } });
  await prisma.threat.deleteMany({ where: { assessment: { tenantId: tid } } });
  await prisma.assessment.deleteMany({ where: { tenantId: tid } });
  await prisma.assetClusterMembership.deleteMany({ where: { cluster: { tenantId: tid } } });
  await prisma.assetCluster.deleteMany({ where: { tenantId: tid } });
  await prisma.assetRelationship.deleteMany({ where: { tenantId: tid } });
  await prisma.asset.deleteMany({ where: { tenantId: tid } });
  await prisma.user.deleteMany({ where: { tenantId: tid } });
  await prisma.organization.delete({ where: { id: tid } });
}

async function main() {
  const reset = process.argv.includes('--reset');
  console.log(`[csmp-v2 seed] Nordica Logistics AG  ${reset ? '(--reset)' : '(idempotent top-up)'}`);

  if (reset) {
    console.log('  • wiping existing Nordica data…');
    await wipeNordica();
  }

  // ── Organization ────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      subscriptionTier: 'ENTERPRISE',
      createdAt: daysAgo(95),
    },
  });
  console.log(`  • organization: ${org.name} (${org.id})`);

  // ── Users ───────────────────────────────────────────────────
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userByEmail = new Map<string, string>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: org.id, email: u.email } },
      update: {},
      create: {
        tenantId: org.id,
        email: u.email,
        passwordHash: pwHash,
        firstName: u.first,
        lastName: u.last,
        role: u.role,
        lastLoginAt: daysAgo(u.lastLoginDaysAgo),
        createdAt: daysAgo(u.createdDaysAgo),
      },
    });
    userByEmail.set(u.email, user.id);
  }
  console.log(`  • users: ${USERS.length}`);

  const adminId = userByEmail.get('admin@nordica.demo')!;
  const leadId = userByEmail.get('lead@nordica.demo')!;
  const assessorId = userByEmail.get('assessor@nordica.demo')!;
  const reviewerId = userByEmail.get('reviewer@nordica.demo')!;

  // ── Assets: sites then children ─────────────────────────────
  const assetByName = new Map<string, string>();
  const pathByName = new Map<string, string>();

  for (const site of SITES) {
    const existing = await prisma.asset.findFirst({
      where: { tenantId: org.id, name: site.name, parentId: null },
    });
    if (existing) {
      assetByName.set(site.name, existing.id);
      pathByName.set(site.name, existing.path);
      continue;
    }
    const segment = slugifySegment(site.name);
    const created = await prisma.asset.create({
      data: {
        tenantId: org.id,
        name: site.name,
        assetType: 'SITE',
        category: 'TANGIBLE',
        description: site.description,
        criticality: site.criticality,
        status: 'ACTIVE',
        location: { lat: site.lat, lng: site.lng, address: site.address } as Prisma.InputJsonValue,
        createdById: adminId,
        createdAt: daysAgo(90),
        pathSegment: segment,
        path: segment,
      },
    });
    assetByName.set(site.name, created.id);
    pathByName.set(site.name, created.path);
  }

  for (const child of CHILD_ASSETS) {
    const existing = await prisma.asset.findFirst({
      where: { tenantId: org.id, name: child.name },
    });
    if (existing) {
      assetByName.set(child.name, existing.id);
      pathByName.set(child.name, existing.path);
      continue;
    }
    const parentId = assetByName.get(child.parent);
    if (!parentId) throw new Error(`Parent not found: ${child.parent}`);
    const parentPath = pathByName.get(child.parent);
    if (!parentPath) throw new Error(`Parent path not cached: ${child.parent}`);
    const segment = slugifySegment(child.name);
    const path = `${parentPath}/${segment}`;
    const created = await prisma.asset.create({
      data: {
        tenantId: org.id,
        parentId,
        name: child.name,
        assetType: child.assetType,
        category: child.category,
        description: child.description,
        criticality: child.criticality,
        status: 'ACTIVE',
        assetRole: child.assetRole ?? 'PROTECTED',
        createdById: adminId,
        createdAt: daysAgo(88),
        pathSegment: segment,
        path,
      },
    });
    assetByName.set(child.name, created.id);
    pathByName.set(child.name, created.path);
  }
  console.log(`  • assets: ${SITES.length} sites + ${CHILD_ASSETS.length} children`);

  // ── Clusters ────────────────────────────────────────────────
  const clusters = [
    {
      name: 'HQ IT Infrastructure',
      clusterType: 'LOGICAL' as const,
      description: 'Warszawa HQ technology stack — server room, access control, CCTV, customer DB',
      members: ['HQ Server Room', 'HQ Access Control System', 'HQ CCTV Array', 'Customer Database'],
    },
    {
      name: 'Hamburg Perimeter Zone',
      clusterType: 'SPATIAL' as const,
      description: 'Hamburg outer-ring perimeter controls',
      members: ['Hamburg Perimeter', 'Hamburg Main Gate', 'Hamburg Loading Dock A'],
    },
  ];
  for (const c of clusters) {
    const existing = await prisma.assetCluster.findFirst({
      where: { tenantId: org.id, name: c.name },
    });
    const clusterId = existing?.id ?? (await prisma.assetCluster.create({
      data: {
        tenantId: org.id,
        name: c.name,
        description: c.description,
        clusterType: c.clusterType,
        criticalityMode: 'HIGHEST',
        statusPropagation: 'CASCADE_UP',
        createdAt: daysAgo(80),
      },
    })).id;
    for (const m of c.members) {
      const assetId = assetByName.get(m);
      if (!assetId) continue;
      await prisma.assetClusterMembership.upsert({
        where: { clusterId_assetId: { clusterId, assetId } },
        update: {},
        create: { clusterId, assetId, roleInCluster: 'MEMBER', isCritical: true, dependencyWeight: 0.7 },
      });
    }
  }
  console.log(`  • clusters: ${clusters.length}`);

  // ── Relationships (so /relationships view has data) ────────
  const relationships: Array<{
    source: string; target: string;
    type: 'DEPENDS_ON' | 'PROTECTS' | 'SERVES' | 'CONTAINS' | 'COMMUNICATES_WITH' | 'ADJACENT_TO' | 'SUPPLIES' | 'MONITORS';
    impactPropagation: boolean;
  }> = [
    // Topology / dependency
    { source: 'HQ Server Room',           target: 'Customer Database',     type: 'CONTAINS',   impactPropagation: true  },
    { source: 'Oslo DR Server Room',      target: 'HQ Server Room',        type: 'DEPENDS_ON', impactPropagation: true  },
    { source: 'Hamburg Cold Storage',     target: 'Hamburg Warehouse',     type: 'DEPENDS_ON', impactPropagation: true  },

    // Protective coverage — Warszawa HQ
    { source: 'HQ Access Control System', target: 'HQ Reception',          type: 'PROTECTS',   impactPropagation: false },
    { source: 'HQ Access Control System', target: 'HQ Server Room',        type: 'PROTECTS',   impactPropagation: false },
    { source: 'HQ CCTV Array',            target: 'HQ Perimeter',          type: 'PROTECTS',   impactPropagation: false },
    { source: 'HQ CCTV Array',            target: 'HQ Reception',          type: 'MONITORS',   impactPropagation: false },
    { source: 'HQ Executive Floor CCTV',  target: 'HQ Executive Suite',    type: 'MONITORS',   impactPropagation: false },
    { source: 'HQ Database Encryption',   target: 'Customer Database',     type: 'PROTECTS',   impactPropagation: false },

    // Protective coverage — Hamburg
    { source: 'Hamburg Dock CCTV',        target: 'Hamburg Loading Dock A', type: 'MONITORS',  impactPropagation: false },
    { source: 'Hamburg Cold Storage IDS', target: 'Hamburg Cold Storage',   type: 'PROTECTS',  impactPropagation: false },
    { source: 'Hamburg Gate ACS',         target: 'Hamburg Main Gate',      type: 'PROTECTS',  impactPropagation: false },
    { source: 'Hamburg Perimeter Fence',  target: 'Hamburg Perimeter',      type: 'PROTECTS',  impactPropagation: false },
    { source: 'Hamburg Perimeter CCTV',   target: 'Hamburg Perimeter',      type: 'MONITORS',  impactPropagation: false },
    { source: 'Hamburg Security Patrol',  target: 'Hamburg Warehouse',      type: 'PROTECTS',  impactPropagation: false },

    // Protective coverage — Oslo
    { source: 'Oslo Office ACS',          target: 'Oslo DR Server Room',    type: 'PROTECTS',  impactPropagation: false },
  ];
  for (const r of relationships) {
    const sourceAssetId = assetByName.get(r.source);
    const targetAssetId = assetByName.get(r.target);
    if (!sourceAssetId || !targetAssetId) continue;
    const existing = await prisma.assetRelationship.findFirst({
      where: { tenantId: org.id, sourceAssetId, targetAssetId, relationshipType: r.type },
    });
    if (existing) continue;
    await prisma.assetRelationship.create({
      data: {
        tenantId: org.id,
        sourceAssetId,
        targetAssetId,
        relationshipType: r.type,
        direction: 'UNIDIRECTIONAL',
        impactPropagation: r.impactPropagation,
      },
    });
  }
  console.log(`  • relationships: ${relationships.length}`);

  // ── Assessment (1 APPROVED with full 8-threat scoring) ──────
  const assessmentTitle = 'HQ Annual Security Review 2026';
  const hqAssetId = assetByName.get('Warszawa HQ')!;
  const startedAt = daysAgo(45);
  const completedAt = daysAgo(14);

  let assessment = await prisma.assessment.findFirst({
    where: { tenantId: org.id, title: assessmentTitle },
  });
  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: {
        tenantId: org.id,
        assetId: hqAssetId,
        title: assessmentTitle,
        assessmentType: 'FULL_SRA',
        status: 'APPROVED',
        currentStep: 7,
        leadAssessorId: leadId,
        reviewStatus: 'APPROVED',
        reviewedById: reviewerId,
        reviewNotes: 'Comprehensive review. Insider-threat scoring well-justified. Approved for FY26 risk register.',
        startedAt,
        completedAt,
        createdAt: startedAt,
      },
    });
  }
  console.log(`  • assessment: "${assessmentTitle}" [APPROVED]`);

  // ── Threats ─────────────────────────────────────────────────
  const threatIdByKey = new Map<string, string>(); // key = `${targetAsset}|${actionType}`
  for (const t of ASSESSMENT_THREATS) {
    const targetAssetId = assetByName.get(t.target);
    if (!targetAssetId) throw new Error(`Threat target not found: ${t.target}`);
    const impactScore = Math.max(
      t.impactBreakdown.people, t.impactBreakdown.property, t.impactBreakdown.operations,
      t.impactBreakdown.reputation, t.impactBreakdown.financial,
    );
    const irv = calculateIrv(t.likelihood, impactScore);
    const priority = calculatePriority(irv, t.vulnerability);

    const key = `${t.target}|${t.actionType}`;
    const existing = await prisma.threat.findFirst({
      where: {
        assessmentId: assessment.id,
        targetAssetId,
        actionType: t.actionType,
      },
    });
    if (existing) {
      threatIdByKey.set(key, existing.id);
      continue;
    }
    const created = await prisma.threat.create({
      data: {
        assessmentId: assessment.id,
        targetAssetId,
        adversaryType: t.adversaryType,
        adversaryDescription: t.adversaryDescription,
        actionType: t.actionType,
        actionDescription: t.actionDescription,
        locationContext: t.locationContext,
        facilitatingFactors: t.facilitatingFactors,
        timeContext: t.timeContext,
        likelihoodScore: t.likelihood,
        likelihoodRationale: t.likelihoodRationale,
        impactScore,
        impactRationale: t.impactRationale,
        impactBreakdown: t.impactBreakdown as Prisma.InputJsonValue,
        irv,
        vulnerabilityRating: t.vulnerability,
        vulnerabilityRationale: t.vulnerabilityRationale,
        riskTreatmentPriority: priority,
        tearStrategy: t.tearStrategy,
        alarpJustification: t.alarpJustification,
        complianceTags: t.complianceTags,
        createdAt: startedAt,
      },
    });
    threatIdByKey.set(key, created.id);
  }
  console.log(`  • threats: ${ASSESSMENT_THREATS.length}`);

  // ── Countermeasures ─────────────────────────────────────────
  for (const cm of COUNTERMEASURES) {
    const assignedToAssetId = assetByName.get(cm.assignedToAsset) ?? null;
    const linkKey = `${cm.linkTargetAsset}|${cm.linkActionType}`;
    const assignedToThreatId = threatIdByKey.get(linkKey) ?? null;

    const existing = await prisma.countermeasure.findFirst({
      where: { tenantId: org.id, name: cm.name },
    });
    if (existing) continue;
    await prisma.countermeasure.create({
      data: {
        tenantId: org.id,
        name: cm.name,
        description: cm.description,
        shapeCategory: cm.shapeCategory,
        ppsFunctions: cm.ppsFunctions,
        domain: cm.domain,
        implementationStatus: cm.implementationStatus,
        costEstimate: cm.costEstimate,
        annualCost: cm.annualCost,
        effectivenessRating: cm.effectivenessRating,
        assignedToAssetId,
        assignedToThreatId,
        tearStrategy: cm.tearStrategy,
        alarpJustification: cm.alarpJustification,
        createdAt: daysAgo(30),
      },
    });
  }
  console.log(`  • countermeasures: ${COUNTERMEASURES.length}`);

  // ── Action plans ────────────────────────────────────────────
  for (const ap of ACTION_PLANS) {
    const threatId = threatIdByKey.get(`${ap.linkTargetAsset}|${ap.linkActionType}`);
    if (!threatId) continue;
    const threat = await prisma.threat.findUnique({ where: { id: threatId } });
    if (!threat) continue;

    const existing = await prisma.actionPlan.findFirst({
      where: { assessmentId: assessment.id, threatId, actionRequired: ap.actionRequired },
    });
    if (existing) continue;

    await prisma.actionPlan.create({
      data: {
        assessmentId: assessment.id,
        threatId,
        riskPriority: threat.riskTreatmentPriority ?? 'MEDIUM',
        actionRequired: ap.actionRequired,
        responsiblePerson: ap.responsiblePerson,
        targetDate: daysFromNow(ap.targetDaysFromNow),
        status: ap.status,
        completionDate: ap.completionDaysAgo != null ? daysAgo(ap.completionDaysAgo) : null,
        evidence: ap.evidence ?? null,
        roiEstimate: ap.roiEstimate as Prisma.InputJsonValue,
        complianceTags: ap.complianceTags,
        createdAt: daysAgo(20),
      },
    });
  }
  console.log(`  • action plans: ${ACTION_PLANS.length}`);

  // ── Snapshots (history timeline) ────────────────────────────
  const existingSnapshots = await prisma.assessmentSnapshot.count({
    where: { assessmentId: assessment.id },
  });
  if (existingSnapshots === 0) {
    await captureSnapshotInline(assessment.id, leadId, 'SUBMITTED_FOR_REVIEW',
      'Submitted for review after Step 7 treatment decisions.', daysAgo(20));
    await captureSnapshotInline(assessment.id, assessorId, 'MANUAL_SAVE',
      'Manual checkpoint before reviewer sign-off.', daysAgo(16));
    await captureSnapshotInline(assessment.id, reviewerId, 'APPROVED',
      'Approved for FY26 risk register.', daysAgo(14));
    console.log('  • snapshots: 3 (SUBMITTED_FOR_REVIEW + MANUAL_SAVE + APPROVED)');
  } else {
    console.log(`  • snapshots: ${existingSnapshots} (existing — skipped)`);
  }

  // ── Summary ─────────────────────────────────────────────────
  const counts = {
    users:           await prisma.user.count({ where: { tenantId: org.id } }),
    assets:          await prisma.asset.count({ where: { tenantId: org.id } }),
    clusters:        await prisma.assetCluster.count({ where: { tenantId: org.id } }),
    relationships:   await prisma.assetRelationship.count({ where: { tenantId: org.id } }),
    assessments:     await prisma.assessment.count({ where: { tenantId: org.id } }),
    threats:         await prisma.threat.count({ where: { assessment: { tenantId: org.id } } }),
    countermeasures: await prisma.countermeasure.count({ where: { tenantId: org.id } }),
    actionPlans:     await prisma.actionPlan.count({ where: { assessment: { tenantId: org.id } } }),
    snapshots:       await prisma.assessmentSnapshot.count({ where: { assessment: { tenantId: org.id } } }),
  };
  console.log('\n  Seeded:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`    ${k.padEnd(18)} ${v}`);
  }
  console.log('\n  Login:');
  for (const u of USERS) {
    console.log(`    ${u.email.padEnd(28)} / ${DEMO_PASSWORD}   [${u.role}]`);
  }
  console.log(`  Org slug: ${ORG_SLUG}\n`);
}

/**
 * Snapshot capture inlined here (instead of importing captureSnapshot from
 * server/src/modules/assessments/snapshots.ts) to avoid pulling in Fastify
 * at seed-time. The payload shape mirrors that function's output.
 */
async function captureSnapshotInline(
  assessmentId: string,
  capturedById: string,
  reason: 'SUBMITTED_FOR_REVIEW' | 'APPROVED' | 'REJECTED' | 'MANUAL_SAVE',
  note: string,
  capturedAt: Date,
) {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      asset: { select: { id: true, name: true } },
      cluster: { select: { id: true, name: true } },
      leadAssessor: { select: { id: true, firstName: true, lastName: true } },
      threats: { select: { id: true, riskTreatmentPriority: true } },
    },
  });
  if (!a) return;

  const threats = await prisma.threat.findMany({
    where: { assessmentId: a.id },
    include: { targetAsset: { select: { id: true, name: true } } },
    orderBy: [{ createdAt: 'asc' }],
  });
  const actionPlans = await prisma.actionPlan.findMany({
    where: { assessmentId: a.id },
    orderBy: [{ createdAt: 'asc' }],
  });

  const PRIORITY_RANK: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST', number> = {
    LOW: 1, MEDIUM: 2, HIGH: 3, HIGHEST: 4,
  };
  let highestPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST' | null = null;
  for (const t of a.threats) {
    if (!t.riskTreatmentPriority) continue;
    if (!highestPriority || PRIORITY_RANK[t.riskTreatmentPriority] > PRIORITY_RANK[highestPriority]) {
      highestPriority = t.riskTreatmentPriority;
    }
  }

  const leadName = a.leadAssessor
    ? `${a.leadAssessor.firstName} ${a.leadAssessor.lastName}`.trim()
    : null;

  const payload = {
    assessment: {
      id: a.id,
      title: a.title,
      assessmentType: a.assessmentType,
      status: a.status,
      currentStep: a.currentStep,
      reviewStatus: a.reviewStatus,
      assetId: a.assetId,
      clusterId: a.clusterId,
      assetName: a.asset?.name ?? null,
      clusterName: a.cluster?.name ?? null,
      leadAssessorId: a.leadAssessorId,
      leadAssessorName: leadName,
      threatCount: a.threats.length,
      highestPriority,
      startedAt: a.startedAt?.toISOString() ?? null,
      completedAt: a.completedAt?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
      reviewedById: a.reviewedById,
      reviewNotes: a.reviewNotes,
    },
    threats: threats.map((t) => ({
      id: t.id,
      assessmentId: t.assessmentId,
      targetAssetId: t.targetAssetId,
      targetAssetName: t.targetAsset?.name ?? null,
      adversaryType: t.adversaryType,
      actionType: t.actionType,
      adversaryDescription: t.adversaryDescription,
      actionDescription: t.actionDescription,
      locationContext: t.locationContext,
      facilitatingFactors: t.facilitatingFactors,
      timeContext: t.timeContext,
      likelihoodScore: t.likelihoodScore,
      likelihoodRationale: t.likelihoodRationale,
      impactScore: t.impactScore,
      impactRationale: t.impactRationale,
      impactBreakdown: t.impactBreakdown,
      irv: t.irv,
      vulnerabilityRating: t.vulnerabilityRating,
      vulnerabilityRationale: t.vulnerabilityRationale,
      riskTreatmentPriority: t.riskTreatmentPriority,
      tearStrategy: t.tearStrategy,
      alarpJustification: t.alarpJustification,
      complianceTags: t.complianceTags,
      dbtReferenceId: t.dbtReferenceId,
    })),
    actionPlans: actionPlans.map((p) => ({
      id: p.id,
      threatId: p.threatId,
      riskPriority: p.riskPriority,
      actionRequired: p.actionRequired,
      responsiblePerson: p.responsiblePerson,
      targetDate: p.targetDate?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      completionDate: p.completionDate?.toISOString().slice(0, 10) ?? null,
      evidence: p.evidence,
      complianceTags: p.complianceTags,
    })),
    note,
  };

  await prisma.assessmentSnapshot.create({
    data: {
      assessmentId,
      capturedById,
      capturedAt,
      reason,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
