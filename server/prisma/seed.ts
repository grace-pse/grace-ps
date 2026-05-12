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

  // ── Extra protective tangibles (demo coverage for more PPS controls) ──
  { parent: 'HQ Reception',                name: 'HQ Visitor Mantrap',           assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'Optical full-height turnstile mantrap with anti-tailgate sensors',                       assetRole: 'PROTECTIVE' },
  { parent: 'HQ Main Building',            name: 'HQ Bollards & Standoff',       assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'K4-rated bollards with 6m vehicle standoff covering the main entrance approach',         assetRole: 'PROTECTIVE' },
  { parent: 'Warszawa HQ',                 name: 'HQ Lobby Security Officer',    assetType: 'PERSON',      category: 'TANGIBLE',   criticality: 3, description: 'Single licensed guard at reception, 24/7 rotation, panic-button-equipped',                assetRole: 'PROTECTIVE' },
  { parent: 'Warszawa HQ',                 name: 'HQ Network Firewall Cluster',  assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 5, description: 'Border + east-west NGFW cluster (HA pair) with IDS/IPS, protecting all HQ information assets', assetRole: 'PROTECTIVE' },
  { parent: 'Oslo Office Building',        name: 'Oslo Lobby CCTV',              assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 3, description: '8 IP cameras in shared lobby + lift area, 14-day retention',                            assetRole: 'PROTECTIVE' },
  { parent: 'Oslo Office Building',        name: 'Oslo Office Alarm Panel',      assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 3, description: 'EN50131-3 intruder alarm with monitoring-centre uplink and dual-path comms',             assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg K9 Patrol Unit',       assetType: 'PERSON',      category: 'TANGIBLE',   criticality: 4, description: '4 officers + 2 K9s on rotating perimeter patrol, after-dark dock-A coverage',              assetRole: 'PROTECTIVE' },
  { parent: 'Hamburg Main Gate',           name: 'Hamburg Gate Bollards K12/L3', assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 5, description: 'Crash-rated K12/L3 wedge barriers with under-vehicle scanner integration',                assetRole: 'PROTECTIVE' },

  // ── Intangibles — protected (REPUTATION / IP / INFORMATION / CONTINUITY) ──
  { parent: 'Warszawa HQ',                 name: 'Nordica Brand Reputation',          assetType: 'REPUTATION',  category: 'INTANGIBLE', criticality: 5, description: 'Brand equity, customer trust, NPS positioning across EU logistics market' },
  { parent: 'Warszawa HQ',                 name: 'Routing Algorithm IP',              assetType: 'IP',          category: 'INTANGIBLE', criticality: 5, description: 'Proprietary multi-modal route optimisation algorithm — patented EP3xx and trade-secret components' },
  { parent: 'Warszawa HQ',                 name: 'Vendor Master Data',                assetType: 'INFORMATION', category: 'INTANGIBLE', criticality: 4, description: 'Curated supplier records — KYC, contracts, payment terms; ~3 200 active vendors' },
  { parent: 'HQ Executive Suite',          name: 'Executive Travel Itineraries',      assetType: 'INFORMATION', category: 'INTANGIBLE', criticality: 4, description: 'C-suite travel calendar incl. hotels + transport — kidnap/ransom-relevant PII' },
  { parent: 'Hamburg Distribution Hub',    name: 'Customs & Cargo Manifest Data',     assetType: 'INFORMATION', category: 'INTANGIBLE', criticality: 5, description: 'Live cargo manifests, customs filings, declared values — UCC + AEO scope' },
  { parent: 'Hamburg Distribution Hub',    name: 'Cold-Chain Compliance Certifications', assetType: 'IP',      category: 'INTANGIBLE', criticality: 4, description: 'GDP, IATA-CEIV-Pharma and BRCGS Storage & Distribution certifications enabling pharma cargo' },
  { parent: 'Hamburg Distribution Hub',    name: 'Cross-Border Operations Continuity', assetType: 'CONTINUITY', category: 'INTANGIBLE', criticality: 5, description: 'Capacity to keep cross-border DE↔PL↔NO movements flowing during disruption (BCP scope)' },

  // ── Intangibles — protective (governance + DR processes) ──
  { parent: 'Warszawa HQ',                 name: 'Insider Threat Programme',         assetType: 'PROCESS',     category: 'INTANGIBLE', criticality: 4, description: 'Vetting + behavioural analytics + 24h revocation SLA; quarterly account audit',          assetRole: 'PROTECTIVE' },
  { parent: 'Warszawa HQ',                 name: 'Vendor Risk Management Process',   assetType: 'PROCESS',     category: 'INTANGIBLE', criticality: 4, description: 'Onboarding due-diligence + tiered recurring re-assessment + breach-notification clauses', assetRole: 'PROTECTIVE' },
  { parent: 'Oslo DR Server Room',         name: 'Disaster Recovery Runbook',        assetType: 'PROCESS',     category: 'INTANGIBLE', criticality: 5, description: 'Documented failover playbook (RTO 4h / RPO 15min), tabletop-tested quarterly',           assetRole: 'PROTECTIVE' },

  // ── Extra protected tangibles ──
  { parent: 'Hamburg Warehouse',           name: 'Hamburg Forklift Fleet',           assetType: 'VEHICLE',     category: 'TANGIBLE',   criticality: 3, description: '14 electric forklifts + 2 reach-trucks supporting dock-to-rack movements' },
  { parent: 'Hamburg Distribution Hub',    name: 'Hamburg Backup Generator',         assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: '800 kVA diesel genset, 48h fuel, weekly load-bank tested' },
  { parent: 'HQ Main Building',            name: 'HQ Document Archive Room',         assetType: 'ROOM',        category: 'TANGIBLE',   criticality: 3, description: 'Fire-rated archive — contracts, HR records, legal hold; basement level' },
  { parent: 'Oslo DR Server Room',         name: 'Oslo DR Backup Tapes',             assetType: 'EQUIPMENT',   category: 'TANGIBLE',   criticality: 4, description: 'LTO-9 tape library with weekly offsite rotation to bank-vault custodian' },
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
  // Survey artefacts: SurveyResponse.tenantId has no FK cascade, so wipe explicitly.
  // AssessmentSurvey + SurveyResponseAaaScore cascade from SurveyResponse delete.
  // ClusterSurveyScope + ClusterSurveyScopeItem cascade from tenant delete (later).
  await prisma.surveyResponse.deleteMany({ where: { tenantId: tid } });
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
    {
      name: 'HQ Information Assets',
      clusterType: 'LOGICAL' as const,
      description: 'Intangible information assets handled at Warszawa HQ — customer PII, vendors, IP, exec data',
      members: ['Customer Database', 'Vendor Master Data', 'Routing Algorithm IP', 'Executive Travel Itineraries'],
    },
    {
      name: 'Oslo Continuity Stack',
      clusterType: 'LOGICAL' as const,
      description: 'Oslo DR site continuity scope — physical DR room, backup tapes, runbook, cross-border continuity',
      members: ['Oslo DR Server Room', 'Oslo DR Backup Tapes', 'Disaster Recovery Runbook', 'Cross-Border Operations Continuity'],
    },
  ];
  const clusterByName = new Map<string, string>();
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
    clusterByName.set(c.name, clusterId);
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

    // Extra protective coverage — new assets
    { source: 'HQ Visitor Mantrap',          target: 'HQ Reception',                       type: 'PROTECTS', impactPropagation: false },
    { source: 'HQ Bollards & Standoff',      target: 'HQ Main Building',                   type: 'PROTECTS', impactPropagation: false },
    { source: 'HQ Lobby Security Officer',   target: 'HQ Reception',                       type: 'PROTECTS', impactPropagation: false },
    { source: 'HQ Network Firewall Cluster', target: 'Customer Database',                  type: 'PROTECTS', impactPropagation: false },
    { source: 'HQ Network Firewall Cluster', target: 'Vendor Master Data',                 type: 'PROTECTS', impactPropagation: false },
    { source: 'HQ Network Firewall Cluster', target: 'Routing Algorithm IP',               type: 'PROTECTS', impactPropagation: false },
    { source: 'Insider Threat Programme',    target: 'Customer Database',                  type: 'PROTECTS', impactPropagation: false },
    { source: 'Vendor Risk Management Process', target: 'Vendor Master Data',              type: 'PROTECTS', impactPropagation: false },
    { source: 'Disaster Recovery Runbook',   target: 'Cross-Border Operations Continuity', type: 'PROTECTS', impactPropagation: false },
    { source: 'Oslo Office Alarm Panel',     target: 'Oslo DR Server Room',                type: 'PROTECTS', impactPropagation: false },
    { source: 'Hamburg Gate Bollards K12/L3', target: 'Hamburg Main Gate',                 type: 'PROTECTS', impactPropagation: false },
    { source: 'Hamburg K9 Patrol Unit',      target: 'Hamburg Cold Storage',               type: 'PROTECTS', impactPropagation: false },
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

  // ── Open assessments — one per wizard step (1..7) + 1 REVIEW ──
  const openCtx: OpenCtx = {
    orgId: org.id,
    userByEmail,
    assetByName,
    clusterByName,
  };
  for (const seed of OPEN_ASSESSMENTS) {
    await createOpenAssessment(openCtx, seed);
  }
  console.log(`  • open assessments: ${OPEN_ASSESSMENTS.length} (steps 1..7 + REVIEW)`);

  // ── Survey scopes + responses (P4 AAA-driven evidence) ────
  await seedSurveys({
    orgId: org.id,
    adminId,
    leadId,
    assessorId,
    reviewerId,
    assetByName,
    clusterByName,
  });

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

  // Assessment status breakdown
  const byStatus = await prisma.assessment.groupBy({
    by: ['status'],
    where: { tenantId: org.id },
    _count: { _all: true },
  });
  const statusParts = byStatus
    .map((row) => `${row._count._all} ${row.status}`)
    .sort();
  console.log(`    ${'  by status'.padEnd(18)} ${statusParts.join(', ')}`);

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

// ═══════════════════════════════════════════════════════════
// OPEN ASSESSMENTS — one parked at each wizard step (1..7) + 1 REVIEW
// ═══════════════════════════════════════════════════════════

type OpenStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'REVIEW';

type OpenThreatSeed = {
  targetAsset: string;
  adversaryType: ThreatSeed['adversaryType'];
  adversaryDescription: string;
  actionType: ThreatSeed['actionType'];
  actionDescription: string;
  locationContext: string;
  facilitatingFactors: string;
  timeContext: string;
  // populated when step >= 3
  likelihood?: number;
  likelihoodRationale?: string;
  // populated when step >= 4
  impactBreakdown?: { people: number; property: number; operations: number; reputation: number; financial: number };
  impactRationale?: string;
  // populated when step >= 6
  vulnerability?: 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE';
  vulnerabilityRationale?: string;
  // populated when step >= 7 — may still be omitted for "decision pending" threats
  tearStrategy?: 'TRANSFER' | 'ELIMINATE' | 'ACCEPT' | 'REDUCE';
  alarpJustification?: string;
  complianceTags?: string[];
};

type OpenActionPlanSeed = {
  targetAsset: string;
  actionType: ThreatSeed['actionType'];
  actionRequired: string;
  responsiblePerson: string;
  targetDaysFromNow: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  roiEstimate?: { avoided_losses: number; programme_cost: number; roi_ratio: number };
  complianceTags?: string[];
};

type OpenAssessmentSeed = {
  title: string;
  step: OpenStep;
  scope: { assetName?: string; clusterName?: string };
  leadEmail: string;
  reviewerEmail?: string;
  startedDaysAgo: number;
  scopeDescription: string;
  expertJustification?: string;
  threats: OpenThreatSeed[];
  actionPlans?: OpenActionPlanSeed[];
  snapshot?: { reason: 'MANUAL_SAVE' | 'SUBMITTED_FOR_REVIEW'; note: string; daysAgo: number };
};

type OpenCtx = {
  orgId: string;
  userByEmail: Map<string, string>;
  assetByName: Map<string, string>;
  clusterByName: Map<string, string>;
};

const OPEN_ASSESSMENTS: OpenAssessmentSeed[] = [
  // ── Step 1 — Scope ─────────────────────────────────────────
  {
    title: 'Oslo Office Refit 2026 Q3 — Initial Scope',
    step: 1,
    scope: { assetName: 'Oslo Office Building' },
    leadEmail: 'assessor@nordica.demo',
    startedDaysAgo: 3,
    scopeDescription: [
      'Q3 2026 office refit drives a fresh physical-security risk assessment for the Oslo regional site.',
      'In scope: shared lobby + reception flow, Oslo DR Server Room, Oslo Office ACS, Oslo Lobby CCTV, Oslo Office Alarm Panel, and the DR Backup Tapes custody chain.',
      'Out of scope: Warszawa HQ ↔ Oslo replication links (covered separately by the HQ IT Infrastructure assessment) and personnel-only sales workflows.',
      'Drivers: refurbished 1F open-plan, new visitor flow through the shared lobby, and tabletop validation of the DR Runbook against the 4h RTO target.',
      'Expected deliverables: updated threat register for the Oslo footprint, gap analysis against the HQ baseline, and a treatment plan to feed FY27 capex.',
    ].join(' '),
    threats: [],
    snapshot: { reason: 'MANUAL_SAVE', note: 'Initial scope captured; threat identification scheduled for next workshop.', daysAgo: 1 },
  },

  // ── Step 2 — Threats (3 A's identified, no scoring yet) ────
  {
    title: 'Hamburg Cold-Chain Threat Brief',
    step: 2,
    scope: { assetName: 'Hamburg Cold Storage' },
    leadEmail: 'lead@nordica.demo',
    startedDaysAgo: 6,
    scopeDescription: 'Focused threat-identification pass on the pharma-grade cold storage at the Hamburg hub ahead of the IATA-CEIV recertification audit. Goal: confirm the threat list captures every adversary × action pairing relevant to high-value cold-chain cargo before we move into scoring.',
    threats: [
      {
        targetAsset: 'Hamburg Cold Storage',
        adversaryType: 'CRIMINAL',
        adversaryDescription: 'Organised cargo-theft crew with prior intelligence on shipment manifests — pattern observed across DE/NL pharma corridors',
        actionType: 'THEFT',
        actionDescription: 'Forced or insider-facilitated entry to lift high-value pharma pallets during night shift',
        locationContext: 'Cold Storage room adjacent to Dock A; pallet stacks within 30m of a roll-up door',
        facilitatingFactors: 'Manifest data leakage via shared TMS; limited dock-door delay rating; 4-min mean time between patrol passes',
        timeContext: 'Sun 02:00–04:00 local; shoulder of shift handover',
      },
      {
        targetAsset: 'Hamburg Cold Storage',
        adversaryType: 'INSIDER',
        adversaryDescription: 'Disgruntled shift supervisor with HMI access to refrigeration setpoints and after-hours physical access',
        actionType: 'SABOTAGE',
        actionDescription: 'Covertly raise setpoints or disable alarm thresholds to ruin pharma shipments and trigger reputational + contractual loss',
        locationContext: 'Cold Storage HMI; bypass via BMS engineering console in the adjacent plant room',
        facilitatingFactors: 'Single-user authorisation on setpoint changes; no SIEM alert on out-of-band BMS changes',
        timeContext: 'Weekend shifts; statutory holidays',
      },
      {
        targetAsset: 'Hamburg Cold Storage',
        adversaryType: 'NATURAL',
        adversaryDescription: 'North-Sea winter storm / Sturmflut overlapping with regional grid instability',
        actionType: 'NATURAL_DISASTER',
        actionDescription: 'Sustained grid outage exceeding 48h diesel reserve, with road closures preventing fuel resupply',
        locationContext: 'Whole Hamburg site; cold-chain impact concentrated in Cold Storage',
        facilitatingFactors: 'Single grid feed; 48h on-site diesel without contracted refuel SLA <12h',
        timeContext: 'Q4–Q1 storm season',
      },
    ],
    snapshot: { reason: 'MANUAL_SAVE', note: 'Threat shortlist complete; scoring workshop scheduled.', daysAgo: 2 },
  },

  // ── Step 3 — Likelihood scored ─────────────────────────────
  {
    title: 'Nordica Brand Reputation — Activist Risk Review',
    step: 3,
    scope: { assetName: 'Nordica Brand Reputation' },
    leadEmail: 'lead@nordica.demo',
    startedDaysAgo: 9,
    scopeDescription: 'Targeted assessment of intangible brand-reputation exposure to activist and competitor-led narrative campaigns, triggered by the recent EU public-procurement window and visible rail-blockade activity across Germany.',
    threats: [
      {
        targetAsset: 'Nordica Brand Reputation',
        adversaryType: 'ACTIVIST',
        adversaryDescription: 'Climate-activist coalition with a track record of occupying logistics sites and amplifying claims via mainstream + social media',
        actionType: 'DISRUPTION',
        actionDescription: 'Coordinated site occupation at Warszawa HQ entrance + parallel social-media campaign portraying Nordica as a fossil-fuel-supply enabler',
        locationContext: 'HQ Reception and street-facing facade; secondary attack surface is the corporate LinkedIn / X presence',
        facilitatingFactors: 'Public address; visible signage; absence of a designated activist-liaison officer pre-2026',
        timeContext: 'EU tender season (Apr–Sep) — overlaps with COP-adjacent activism calendar',
        likelihood: 3,
        likelihoodRationale: 'Three documented HQ-occupation incidents in EU peer logistics firms in the past 12 months; one Nordica-adjacent rail blockade in March 2026.',
      },
      {
        targetAsset: 'Nordica Brand Reputation',
        adversaryType: 'COMPETITOR',
        adversaryDescription: 'Tier-1 EU competitor using a grey-PR firm to seed disinformation during competitive RFPs',
        actionType: 'ESPIONAGE',
        actionDescription: 'Targeted leak of selectively-edited internal documents to trade press during tender evaluation',
        locationContext: 'Information surface: legal hold archive, exec email, vendor onboarding paperwork',
        facilitatingFactors: 'Several recent contractor terminations; partial DLP coverage on external mail egress',
        timeContext: 'Final 30 days of major tender evaluation windows',
        likelihood: 2,
        likelihoodRationale: 'No confirmed prior incidents; industry-wide chatter and one near-miss involving a leaked draft RFP response in 2025.',
      },
    ],
    snapshot: { reason: 'MANUAL_SAVE', note: 'Likelihood scoring complete for both threats; impact workshop next.', daysAgo: 3 },
  },

  // ── Step 4 — Impact (5-dimension breakdown) ────────────────
  {
    title: 'Customer Database — Intangibles Impact Deep-Dive',
    step: 4,
    scope: { clusterName: 'HQ Information Assets' },
    leadEmail: 'lead@nordica.demo',
    startedDaysAgo: 11,
    scopeDescription: 'Cluster-scoped impact assessment on the HQ intangible information stack (Customer Database, Vendor Master Data, Routing Algorithm IP, Executive Travel Itineraries). Driven by NIS2 Art.21 evidence requirements and the upcoming Group Risk Committee.',
    threats: [
      {
        targetAsset: 'Customer Database',
        adversaryType: 'NATION_STATE',
        adversaryDescription: 'State-aligned APT actor targeting EU logistics supply-chain telemetry',
        actionType: 'CYBER',
        actionDescription: 'Long-dwell intrusion exfiltrating PII + freight-routing patterns over months via compromised admin endpoint',
        locationContext: 'HQ Server Room; admin egress via corp VPN; partial east-west FW visibility',
        facilitatingFactors: 'Privileged-access workstations rollout not yet complete; SIEM coverage gaps on identity store',
        timeContext: 'Persistent campaign — quiet periods + bursts around major EU policy events',
        likelihood: 4,
        likelihoodRationale: 'Sector-peer breach disclosed Feb 2026; CTI reporting elevates likelihood to 4 for FY26.',
        impactBreakdown: { people: 3, property: 2, operations: 5, reputation: 5, financial: 5 },
        impactRationale: 'GDPR fines + customer churn dominate; freight-routing leakage would compromise EU customers’ competitive positions and trigger SLA penalties cascading into >EUR 10M financial exposure.',
      },
      {
        targetAsset: 'Routing Algorithm IP',
        adversaryType: 'INSIDER',
        adversaryDescription: 'Departing senior engineer with deep access to the routing codebase',
        actionType: 'ESPIONAGE',
        actionDescription: 'Bulk export of algorithm source + design docs to a personal cloud bucket during notice period',
        locationContext: 'HQ Server Room repos; mirrored to engineer workstation',
        facilitatingFactors: 'No DLP on the repo egress path; 30-day revocation window historically uneven',
        timeContext: 'Notice-period windows (typically 3 months)',
        likelihood: 2,
        likelihoodRationale: 'Industry-wide concern; no confirmed incidents internally but one near-miss in 2025-Q4.',
        impactBreakdown: { people: 1, property: 1, operations: 3, reputation: 4, financial: 5 },
        impactRationale: 'Trade-secret loss collapses Nordica’s differentiation in the SME segment; ~EUR 6–8M revenue at risk over 24 months until algorithm regenerates a moat.',
      },
      {
        targetAsset: 'Vendor Master Data',
        adversaryType: 'CRIMINAL',
        adversaryDescription: 'BEC fraud syndicate targeting AP teams of mid-sized EU logistics firms',
        actionType: 'FRAUD',
        actionDescription: 'Vendor bank-detail change via spoofed email leading to a single large mis-direction of payment',
        locationContext: 'Finance team mailboxes; vendor master update workflow',
        facilitatingFactors: 'Single-approver bank-detail changes for vendors below EUR 50k threshold',
        timeContext: 'Quarter-end payment runs',
        likelihood: 3,
        likelihoodRationale: 'Several attempts blocked by mail filters monthly; one near-success in March 2026 caught at AP control.',
        impactBreakdown: { people: 1, property: 1, operations: 3, reputation: 4, financial: 4 },
        impactRationale: 'Single-event direct loss bounded ≈ EUR 200–500k; reputational impact via trade press if disclosed.',
      },
    ],
    snapshot: { reason: 'MANUAL_SAVE', note: 'Impact breakdown captured; pending IRV review.', daysAgo: 4 },
  },

  // ── Step 5 — IRV computed (matrix visible) ────────────────
  {
    title: 'Hamburg Perimeter — IRV Review',
    step: 5,
    scope: { clusterName: 'Hamburg Perimeter Zone' },
    leadEmail: 'assessor@nordica.demo',
    startedDaysAgo: 13,
    scopeDescription: 'Hamburg outer-ring perimeter cluster — IRV review across theft, terrorism, opportunistic intrusion and state-actor sabotage scenarios feeding into the FY27 perimeter capex line.',
    threats: [
      {
        targetAsset: 'Hamburg Loading Dock A',
        adversaryType: 'CRIMINAL',
        adversaryDescription: 'Organised cargo-theft crew exploiting dock-shift handover gaps',
        actionType: 'THEFT',
        actionDescription: 'Tailgated truck + insider-facilitated lift of high-value cross-dock pallets',
        locationContext: 'Loading Dock A bays 6–9; near-perimeter parking outside the inspection bay',
        facilitatingFactors: 'High inbound volume; partial RFID-only inspection during peak hours',
        timeContext: 'Sun 02:00–04:00',
        likelihood: 4,
        likelihoodRationale: 'TAPA EMEA bulletins place this corridor in tier-1 risk; two attempts blocked in FY25.',
        impactBreakdown: { people: 1, property: 4, operations: 4, reputation: 3, financial: 4 },
        impactRationale: 'Single-event exposure EUR 800k+ cargo plus contractual penalties.',
      },
      {
        targetAsset: 'Hamburg Main Gate',
        adversaryType: 'TERRORIST',
        adversaryDescription: 'Low-sophistication VBIED scenario aligned with CER Art.13 baseline',
        actionType: 'BOMB',
        actionDescription: 'Vehicle-borne IED attempting to penetrate the inspection bay and reach the warehouse',
        locationContext: 'Main Gate approach lane; visitor parking still within standoff distance',
        facilitatingFactors: 'No K12/L3 barriers yet; under-vehicle scanner deployment pending',
        timeContext: 'Daytime, high-occupancy windows',
        likelihood: 2,
        likelihoodRationale: 'Low base rate; elevated by sector signalling and 2025 EU advisory.',
        impactBreakdown: { people: 5, property: 4, operations: 4, reputation: 3, financial: 4 },
        impactRationale: 'Mass-casualty risk; multi-week ops outage; regulatory inquiry.',
      },
      {
        targetAsset: 'Hamburg Perimeter',
        adversaryType: 'OPPORTUNIST',
        adversaryDescription: 'Lone-actor opportunist scaling the perimeter for petty theft',
        actionType: 'INTRUSION',
        actionDescription: 'Climb-over at low-coverage segment; foot-pad survey of dock area',
        locationContext: 'Northwest fence segment, 200m from camera tower N3',
        facilitatingFactors: 'Vegetation overgrowth reducing camera line-of-sight on a 30m run',
        timeContext: 'Late evenings; lower public footfall',
        likelihood: 3,
        likelihoodRationale: 'Three intrusion alerts in past 6 months from FOIDS fibre sensors.',
        impactBreakdown: { people: 1, property: 2, operations: 2, reputation: 1, financial: 1 },
        impactRationale: 'Limited single-event loss; reputational signal if pattern repeats.',
      },
      {
        targetAsset: 'Hamburg Main Gate',
        adversaryType: 'NATION_STATE',
        adversaryDescription: 'Capable state-aligned actor seeking to disrupt EU pharma cold-chain logistics',
        actionType: 'SABOTAGE',
        actionDescription: 'Forced denial of the Main Gate combined with synchronised network disruption',
        locationContext: 'Main Gate ACS + linked TMS network segment',
        facilitatingFactors: 'Single chokepoint for both vehicle ingress and ACS logic',
        timeContext: 'Coincident with cross-border geopolitical events',
        likelihood: 4,
        likelihoodRationale: 'Recent EU CERT advisories specifically call out logistics gate ACS targeting.',
        impactBreakdown: { people: 3, property: 3, operations: 5, reputation: 5, financial: 5 },
        impactRationale: 'Multi-week outage cascading to all customers; brand and contractual implications.',
      },
    ],
    snapshot: { reason: 'MANUAL_SAVE', note: 'IRV matrix populated; vulnerability rating workshop scheduled.', daysAgo: 5 },
  },

  // ── Step 6 — Vulnerability rated + Priority computed ───────
  {
    title: 'HQ IT Infrastructure — Controls Assessment',
    step: 6,
    scope: { clusterName: 'HQ IT Infrastructure' },
    leadEmail: 'lead@nordica.demo',
    startedDaysAgo: 15,
    scopeDescription: 'Controls-effectiveness pass on the HQ IT Infrastructure cluster (Server Room, ACS, CCTV, Customer Database). Demonstrates expert-judgement scoring across the full vulnerability spectrum ahead of the May 2026 physical survey.',
    expertJustification: 'Vulnerability ratings derived from expert judgement of the HQ Security Lead based on the 2026-Q1 quarterly walk-through audit, retained penetration-test findings (Trail of Bits, 2025-12), and SIEM coverage analysis. Physical survey to validate ratings is scheduled for May 2026; ratings will be re-confirmed once the survey response is linked.',
    threats: [
      {
        targetAsset: 'HQ Server Room',
        adversaryType: 'INSIDER',
        adversaryDescription: 'Disgruntled IT ops engineer with privileged physical access',
        actionType: 'SABOTAGE',
        actionDescription: 'Tampering with cooling or power to disrupt data-center operations',
        locationContext: 'Server Room HVAC + power panels',
        facilitatingFactors: 'Two-person rule recently implemented; SIEM ingest of BMS still partial',
        timeContext: 'Weekend / night shifts',
        likelihood: 3,
        likelihoodRationale: 'Recent layoffs raise grievance exposure; controls strong but residual remains.',
        impactBreakdown: { people: 2, property: 4, operations: 5, reputation: 4, financial: 4 },
        impactRationale: 'Multi-hour outage; cascading SLA penalties.',
        vulnerability: 'STRONG',
        vulnerabilityRationale: 'Two-person rule + BMS logging cover the primary insider pathway; residual is procedural rather than technical.',
      },
      {
        targetAsset: 'Customer Database',
        adversaryType: 'NATION_STATE',
        adversaryDescription: 'State-aligned APT actor — long-dwell exfiltration profile',
        actionType: 'CYBER',
        actionDescription: 'Slow exfiltration of customer PII + freight routing telemetry via compromised admin endpoint',
        locationContext: 'Admin VPN ingress; lateral east-west to DB tier',
        facilitatingFactors: 'PAW rollout in progress; partial east-west FW visibility',
        timeContext: 'Persistent; bursts around EU policy events',
        likelihood: 4,
        likelihoodRationale: 'Sector-peer breach in Feb 2026 establishes a credible recent precedent.',
        impactBreakdown: { people: 3, property: 2, operations: 5, reputation: 5, financial: 5 },
        impactRationale: 'GDPR + churn + freight intelligence loss.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'NGFW + segmentation underway but PAW rollout incomplete; partial coverage of identity logging.',
      },
      {
        targetAsset: 'HQ Access Control System',
        adversaryType: 'OPPORTUNIST',
        adversaryDescription: 'Lone-actor tailgater exploiting reception flow',
        actionType: 'INTRUSION',
        actionDescription: 'Tailgating through reception during a courier delivery wave',
        locationContext: 'HQ Reception during 09:00–11:00 visitor peak',
        facilitatingFactors: 'Single reception flow without mantrap (Q2 2026 install pending)',
        timeContext: 'Weekday business hours',
        likelihood: 2,
        likelihoodRationale: 'Historical tailgating attempts logged at 1–2/quarter.',
        impactBreakdown: { people: 1, property: 2, operations: 3, reputation: 2, financial: 1 },
        impactRationale: 'Bounded if intruder remains on ground floor; serious if escalated.',
        vulnerability: 'BARELY_ADEQUATE',
        vulnerabilityRationale: 'Reception flow unchanged since 2019; the optical mantrap is approved but not yet installed — controls are people-dependent.',
      },
      {
        targetAsset: 'HQ CCTV Array',
        adversaryType: 'CRIMINAL',
        adversaryDescription: 'Petty thief looking for unattended equipment in low-coverage areas',
        actionType: 'THEFT',
        actionDescription: 'Lift of unsecured electronics from common areas during overnight cleaning shifts',
        locationContext: 'Common-area corridors, break rooms',
        facilitatingFactors: 'Camera blind spots above 8th-floor approach; retention only 30d',
        timeContext: 'Overnight cleaning crew window',
        likelihood: 2,
        likelihoodRationale: 'Two low-value incidents in past 12 months.',
        impactBreakdown: { people: 1, property: 2, operations: 1, reputation: 1, financial: 1 },
        impactRationale: 'Low single-event financial impact.',
        vulnerability: 'INADEQUATE',
        vulnerabilityRationale: 'Documented camera dead zones above the 8th-floor approach; no thermal coverage; PTZ presets last refreshed 2022.',
      },
    ],
    snapshot: { reason: 'MANUAL_SAVE', note: 'All vulnerability ratings captured with expert justification; treatment workshop scheduled.', daysAgo: 6 },
  },

  // ── Step 7 — Treatment (mid-decision; some TEAR set, some not) ─
  {
    title: 'Group-Wide Pre-FY27 Treatment Workshop',
    step: 7,
    scope: { assetName: 'Warszawa HQ' },
    leadEmail: 'admin@nordica.demo',
    startedDaysAgo: 17,
    scopeDescription: 'Cross-functional TEAR-strategy workshop covering the top group-wide risks at Warszawa HQ feeding the FY27 risk register. Mid-decision: not all strategies are locked yet — final lock-in expected after the May Risk Committee.',
    threats: [
      {
        targetAsset: 'HQ Server Room',
        adversaryType: 'INSIDER',
        adversaryDescription: 'Disgruntled IT ops engineer with privileged access',
        actionType: 'SABOTAGE',
        actionDescription: 'BMS / cooling tampering to induce data-centre outage',
        locationContext: 'Server Room mechanical plant',
        facilitatingFactors: 'Recent layoffs; gaps in BMS audit logging',
        timeContext: 'Weekends',
        likelihood: 3,
        likelihoodRationale: 'Layoff-driven grievance window remains for the next 6 months.',
        impactBreakdown: { people: 2, property: 4, operations: 5, reputation: 4, financial: 4 },
        impactRationale: 'Multi-hour outage cascades to customer-facing systems.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'Two-person rule and BMS logging cover the primary vector; residual monitored via SIEM.',
        tearStrategy: 'REDUCE',
        alarpJustification: 'Zero-cost admin control directly addresses the insider vector; residual monitored — ALARP demonstrated.',
        complianceTags: ['ISO_31000', 'NIS2_ART_21'],
      },
      {
        targetAsset: 'Customer Database',
        adversaryType: 'NATION_STATE',
        adversaryDescription: 'State-aligned APT — long-dwell exfiltration',
        actionType: 'CYBER',
        actionDescription: 'Slow PII + routing exfiltration via compromised admin endpoint',
        locationContext: 'Admin VPN + east-west lateral path',
        facilitatingFactors: 'PAW rollout incomplete',
        timeContext: 'Persistent',
        likelihood: 4,
        likelihoodRationale: 'Sector-peer breach in Feb 2026.',
        impactBreakdown: { people: 3, property: 2, operations: 5, reputation: 5, financial: 5 },
        impactRationale: 'GDPR + churn dominate.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'NGFW + segmentation in progress.',
        tearStrategy: 'REDUCE',
        alarpJustification: 'NGFW rollout + PAW deployment + EDR baseline materially reduce residual; further hardening tracked under NIS2 programme.',
        complianceTags: ['NIS2_ART_21'],
      },
      {
        targetAsset: 'Routing Algorithm IP',
        adversaryType: 'COMPETITOR',
        adversaryDescription: 'Competitor seeking algorithm trade secrets via insider channel',
        actionType: 'ESPIONAGE',
        actionDescription: 'Bulk repo export by departing engineer',
        locationContext: 'Repo egress paths',
        facilitatingFactors: 'Historic 30-day revocation lag',
        timeContext: 'Notice-period windows',
        likelihood: 2,
        likelihoodRationale: 'No confirmed incident; near-miss in 2025-Q4.',
        impactBreakdown: { people: 1, property: 1, operations: 3, reputation: 4, financial: 5 },
        impactRationale: 'Trade-secret loss; revenue impact over 24 months.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'Repo audit + DLP partial; revocation SLA tightened.',
        tearStrategy: 'ELIMINATE',
        alarpJustification: 'Eliminate external repo egress entirely (allow-list only) — removes the credible exfiltration path; control retained as standing requirement.',
        complianceTags: ['NIS2_ART_21'],
      },
      {
        targetAsset: 'HQ Main Building',
        adversaryType: 'NATURAL',
        adversaryDescription: 'Severe weather / flood event in central Warszawa',
        actionType: 'NATURAL_DISASTER',
        actionDescription: 'Localised flooding affecting ground-floor and basement archive',
        locationContext: 'HQ Main Building basement + ground floor',
        facilitatingFactors: 'Limited site drainage; aging sump pump',
        timeContext: 'Spring snow-melt',
        likelihood: 1,
        likelihoodRationale: 'Low base rate; modelled as 1-in-30-year by site survey.',
        impactBreakdown: { people: 1, property: 3, operations: 2, reputation: 1, financial: 2 },
        impactRationale: 'Property + archive damage; limited operational interruption with DR site.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'Sump + flood-barrier maintenance in place; archive elevation acceptable.',
        tearStrategy: 'TRANSFER',
        alarpJustification: 'Risk transferred to property insurer with adequate sub-limits for archive and IT capital; retained risk within tolerance.',
        complianceTags: ['ISO_31000'],
      },
      {
        targetAsset: 'HQ Document Archive Room',
        adversaryType: 'CRIMINAL',
        adversaryDescription: 'Arson scenario — disgruntled former contractor',
        actionType: 'ARSON',
        actionDescription: 'Deliberate ignition in basement archive corridor',
        locationContext: 'Basement archive approach',
        facilitatingFactors: 'Shared courier access route to archive intake',
        timeContext: 'After-hours',
        likelihood: 2,
        likelihoodRationale: 'No history; raised on plausibility from threat intel.',
        impactBreakdown: { people: 2, property: 4, operations: 3, reputation: 3, financial: 3 },
        impactRationale: 'Loss of legal-hold records; potential litigation exposure.',
        vulnerability: 'BARELY_ADEQUATE',
        vulnerabilityRationale: 'Fire compartmentation good; access control around the archive vestibule is single-factor and shared with cleaning crew.',
        // TEAR intentionally left undecided — workshop unresolved
      },
    ],
    snapshot: { reason: 'MANUAL_SAVE', note: 'Workshop interim save — 4 of 5 TEAR strategies agreed, arson scenario deferred to May Risk Committee.', daysAgo: 7 },
  },

  // ── REVIEW — fully scored, awaiting reviewer sign-off ──────
  {
    title: 'Oslo DR Continuity Plan Review',
    step: 'REVIEW',
    scope: { clusterName: 'Oslo Continuity Stack' },
    leadEmail: 'lead@nordica.demo',
    reviewerEmail: 'reviewer@nordica.demo',
    startedDaysAgo: 22,
    scopeDescription: 'Closing review of the Oslo continuity stack — DR Server Room, DR Backup Tapes, DR Runbook and Cross-Border Operations Continuity — covering the FY26 BCP commitment. All scoring and treatment selected; awaiting reviewer sign-off.',
    threats: [
      {
        targetAsset: 'Oslo DR Server Room',
        adversaryType: 'NATURAL',
        adversaryDescription: 'Winter-storm grid outage in central Oslo exceeding on-site fuel reserve',
        actionType: 'NATURAL_DISASTER',
        actionDescription: 'Sustained grid outage + roads-out scenario preventing fuel resupply within 24h',
        locationContext: 'Oslo DR site; shared building utilities',
        facilitatingFactors: 'No N+1 UPS; diesel only commissioned for portable units',
        timeContext: 'Q4–Q1',
        likelihood: 2,
        likelihoodRationale: 'Two regional outage events >12h in past 5 years.',
        impactBreakdown: { people: 1, property: 2, operations: 4, reputation: 3, financial: 3 },
        impactRationale: 'Loss of secondary DR capability; degraded RTO during HQ failover.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'Runbook tested; fuel reserve sized for typical events.',
        tearStrategy: 'REDUCE',
        alarpJustification: 'N+1 UPS commissioning + fuel SLA proposed; ALARP at FY27 capex line.',
        complianceTags: ['ISO_31000', 'NIS2_ART_21'],
      },
      {
        targetAsset: 'Disaster Recovery Runbook',
        adversaryType: 'INSIDER',
        adversaryDescription: 'Departing platform engineer with deep runbook knowledge',
        actionType: 'ESPIONAGE',
        actionDescription: 'Disclosure of runbook internals to competitor recruiter',
        locationContext: 'Documentation repository',
        facilitatingFactors: 'Runbook stored in shared wiki accessible to broader IT team',
        timeContext: 'Notice-period window',
        likelihood: 2,
        likelihoodRationale: 'Industry-wide concern; minimal Nordica-specific signal.',
        impactBreakdown: { people: 1, property: 1, operations: 2, reputation: 3, financial: 2 },
        impactRationale: 'Operational secrecy loss but limited direct customer exposure.',
        vulnerability: 'STRONG',
        vulnerabilityRationale: 'Access tiering + audit + quarterly review keeps exposure bounded.',
        tearStrategy: 'ACCEPT',
        alarpJustification: 'Residual within tolerance; further controls would yield diminishing returns relative to cost — ALARP.',
        complianceTags: ['ISO_31000'],
      },
      {
        targetAsset: 'Oslo DR Backup Tapes',
        adversaryType: 'CRIMINAL',
        adversaryDescription: 'Targeted ransomware affiliate seeking backup destruction',
        actionType: 'CYBER',
        actionDescription: 'Encryption + deletion of online backups to force ransom payment',
        locationContext: 'DR Tape library + replication endpoints',
        facilitatingFactors: 'Online tape catalog reachable from admin network',
        timeContext: 'Coincident with primary-site ransomware event',
        likelihood: 3,
        likelihoodRationale: 'Pattern observed in 3 EU peer incidents in past 12 months.',
        impactBreakdown: { people: 1, property: 2, operations: 4, reputation: 4, financial: 4 },
        impactRationale: 'Loss of recoverability — would force lengthy data reconstruction.',
        vulnerability: 'BASELINE',
        vulnerabilityRationale: 'Off-site rotation in place but catalog reachable from prod admin segment.',
        tearStrategy: 'REDUCE',
        alarpJustification: 'Tape encryption + dual-custodian rotation + admin-segment isolation reduce residual to within tolerance.',
        complianceTags: ['NIS2_ART_21', 'ISO_28000'],
      },
    ],
    actionPlans: [
      {
        targetAsset: 'Oslo DR Server Room',
        actionType: 'NATURAL_DISASTER',
        actionRequired: 'Commission N+1 UPS + diesel genset at Oslo DR; align with HQ runbook RTO/RPO targets and contract a <12h fuel-resupply SLA',
        responsiblePerson: 'Henrik Sorensen',
        targetDaysFromNow: 90,
        status: 'PENDING',
        roiEstimate: { avoided_losses: 950000, programme_cost: 220000, roi_ratio: 4.3 },
        complianceTags: ['ISO_31000', 'NIS2_ART_21'],
      },
      {
        targetAsset: 'Oslo DR Backup Tapes',
        actionType: 'CYBER',
        actionRequired: 'Implement AES-256 tape encryption + dual-custodian off-site rotation (bank vault) + isolate the tape catalog from prod admin segment',
        responsiblePerson: 'M. Laine (Head of IT Security)',
        targetDaysFromNow: 60,
        status: 'PENDING',
        roiEstimate: { avoided_losses: 1800000, programme_cost: 75000, roi_ratio: 24 },
        complianceTags: ['NIS2_ART_21', 'ISO_28000'],
      },
    ],
    snapshot: { reason: 'SUBMITTED_FOR_REVIEW', note: 'Submitted to reviewer with treatment decisions and 2 action plans.', daysAgo: 4 },
  },
];

async function createOpenAssessment(ctx: OpenCtx, seed: OpenAssessmentSeed): Promise<void> {
  const existing = await prisma.assessment.findFirst({
    where: { tenantId: ctx.orgId, title: seed.title },
  });
  if (existing) return;

  const leadId = ctx.userByEmail.get(seed.leadEmail);
  if (!leadId) throw new Error(`Lead not found: ${seed.leadEmail}`);
  const reviewerId = seed.reviewerEmail ? ctx.userByEmail.get(seed.reviewerEmail) ?? null : null;

  const assetId = seed.scope.assetName ? ctx.assetByName.get(seed.scope.assetName) ?? null : null;
  const clusterId = seed.scope.clusterName ? ctx.clusterByName.get(seed.scope.clusterName) ?? null : null;
  if (!assetId && !clusterId) {
    throw new Error(`Scope missing for ${seed.title}: ${JSON.stringify(seed.scope)}`);
  }

  const isReview = seed.step === 'REVIEW';
  const stepNum = isReview ? 7 : (seed.step as number);
  const statusByStep: Record<number, 'STEP_1_ASSETS' | 'STEP_2_THREATS' | 'STEP_3_LIKELIHOOD' | 'STEP_4_IMPACT' | 'STEP_5_IRV' | 'STEP_6_VULNERABILITY' | 'STEP_7_TREATMENT'> = {
    1: 'STEP_1_ASSETS',
    2: 'STEP_2_THREATS',
    3: 'STEP_3_LIKELIHOOD',
    4: 'STEP_4_IMPACT',
    5: 'STEP_5_IRV',
    6: 'STEP_6_VULNERABILITY',
    7: 'STEP_7_TREATMENT',
  };
  const status = isReview ? 'REVIEW' : statusByStep[stepNum];
  const startedAt = daysAgo(seed.startedDaysAgo);

  const assessment = await prisma.assessment.create({
    data: {
      tenantId: ctx.orgId,
      assetId,
      clusterId,
      title: seed.title,
      assessmentType: 'FULL_SRA',
      status,
      currentStep: stepNum,
      leadAssessorId: leadId,
      reviewStatus: isReview ? 'IN_REVIEW' : 'PENDING',
      reviewedById: reviewerId,
      scopeDescription: seed.scopeDescription,
      expertJustification: seed.expertJustification ?? null,
      evidenceBasis: 'EXPERT_JUDGMENT',
      surveyPending: true,
      startedAt,
      createdAt: startedAt,
    },
  });

  for (const t of seed.threats) {
    const targetAssetId = ctx.assetByName.get(t.targetAsset);
    if (!targetAssetId) throw new Error(`Threat target not found in '${seed.title}': ${t.targetAsset}`);

    const reachesLikelihood = stepNum >= 3 && t.likelihood != null;
    const reachesImpact = stepNum >= 4 && t.impactBreakdown != null;
    const impactScore = reachesImpact && t.impactBreakdown
      ? Math.max(
          t.impactBreakdown.people,
          t.impactBreakdown.property,
          t.impactBreakdown.operations,
          t.impactBreakdown.reputation,
          t.impactBreakdown.financial,
        )
      : null;
    const reachesIrv = stepNum >= 5 && reachesLikelihood && reachesImpact && t.likelihood != null && impactScore != null;
    const irv = reachesIrv ? calculateIrv(t.likelihood!, impactScore!) : null;
    const reachesVuln = stepNum >= 6 && t.vulnerability != null;
    const priority = reachesVuln && irv && t.vulnerability ? calculatePriority(irv, t.vulnerability) : null;
    const reachesTear = (stepNum >= 7 || isReview) && t.tearStrategy != null;

    await prisma.threat.create({
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
        likelihoodScore: reachesLikelihood ? t.likelihood! : null,
        likelihoodRationale: reachesLikelihood ? t.likelihoodRationale ?? null : null,
        impactScore: reachesImpact ? impactScore : null,
        impactRationale: reachesImpact ? t.impactRationale ?? null : null,
        ...(reachesImpact && t.impactBreakdown
          ? { impactBreakdown: t.impactBreakdown as Prisma.InputJsonValue }
          : {}),
        irv,
        vulnerabilityRating: reachesVuln ? t.vulnerability! : null,
        vulnerabilityRationale: reachesVuln ? t.vulnerabilityRationale ?? null : null,
        riskTreatmentPriority: priority,
        tearStrategy: reachesTear ? t.tearStrategy! : null,
        alarpJustification: reachesTear ? t.alarpJustification ?? null : null,
        complianceTags: t.complianceTags ?? [],
        createdAt: startedAt,
      },
    });
  }

  if (seed.actionPlans?.length) {
    for (const ap of seed.actionPlans) {
      const targetAssetId = ctx.assetByName.get(ap.targetAsset);
      if (!targetAssetId) continue;
      const threat = await prisma.threat.findFirst({
        where: {
          assessmentId: assessment.id,
          targetAssetId,
          actionType: ap.actionType,
        },
      });
      if (!threat) continue;
      await prisma.actionPlan.create({
        data: {
          assessmentId: assessment.id,
          threatId: threat.id,
          riskPriority: threat.riskTreatmentPriority ?? 'MEDIUM',
          actionRequired: ap.actionRequired,
          responsiblePerson: ap.responsiblePerson,
          targetDate: daysFromNow(ap.targetDaysFromNow),
          status: ap.status,
          ...(ap.roiEstimate
            ? { roiEstimate: ap.roiEstimate as Prisma.InputJsonValue }
            : {}),
          complianceTags: ap.complianceTags ?? [],
          createdAt: startedAt,
        },
      });
    }
  }

  if (seed.snapshot) {
    await captureSnapshotInline(
      assessment.id,
      leadId,
      seed.snapshot.reason,
      seed.snapshot.note,
      daysAgo(seed.snapshot.daysAgo),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// SURVEYS — tenant-scoped scopes + responses + AAA scores
//
// Demonstrates the P4 AAA-driven survey flow:
//   1 SurveyTemplate (Nordica-specific PHYSICAL walk-through)
//   4 AssetTypeSurveyDefault rows (tenant defaults)
//   4 ClusterSurveyScope (APPROVED, one per cluster)
//     each with 5–6 ClusterSurveyScopeItem rows wired to real assets
//   4 SurveyResponse rows — DRAFT / SUBMITTED / APPROVED mix
//     submitted ones carry AAA scores + are linked to assessments via
//     AssessmentSurvey so the assessment evidenceBasis reflects MIXED /
//     SURVEY_LINKED
//   1 SurveySchedule — quarterly recurring physical walk-through
//
// Questions are resolved from the global library seeded by
// seed-survey-questions.mjs (system rows, tenantId=null).  If that
// library isn't present yet (very-first-boot edge case), this section
// logs and skips gracefully.
// ═══════════════════════════════════════════════════════════

type SurveyCtx = {
  orgId: string;
  adminId: string;
  leadId: string;
  assessorId: string;
  reviewerId: string;
  assetByName: Map<string, string>;
  clusterByName: Map<string, string>;
};

// Question prompts to pull from the system library (must match exactly).
const Q = {
  locks: 'Are intrusion-resistant locks installed on all external doors of this asset?',
  accessLog: 'Is access to this asset logged and reviewable for the past 90 days?',
  perimeter: 'Is the asset enclosed by a continuous, unbroken physical perimeter?',
  egress: 'Is the asset’s emergency egress route clearly marked and unobstructed?',
  personnelChecks: 'Are personnel handling this asset background-checked and screened?',
  hostileRecce: 'Has hostile reconnaissance or surveillance been observed in the last 6 months?',
  insiderIndicator: 'Has an insider-threat indicator been raised against personnel with access?',
  geoEscalation: 'Are external geopolitical / activist conditions elevating this threat at present?',
  cmInstalled: 'Is there photographic or physical evidence that the countermeasure is installed and operating?',
  cmMaintenance: 'Was the most recent preventive maintenance performed within the last 6 months?',
  cmDamage: 'Is the countermeasure free of visible damage, tampering, or wear that would degrade its function?',
  cmCams: 'Are all cameras streaming live to the VMS with no offline channels?',
  cmAlarm: 'Is the alarm signal monitored by an attended station 24/7?',
  procDocumented: 'Is this procedure documented in the current security operations manual?',
  procRefresher: 'Have all personnel performing this control received refresher training in the last 12 months?',
} as const;

type AnswerValue = 'YES' | 'PARTIAL' | 'NO';

// Map answer to severity bucket (mirrors seed-survey-questions.mjs YN map).
const ANSWER_OK: Record<AnswerValue, number> = { YES: 1, PARTIAL: 0.5, NO: 0 };

function ratingFor(scorePct: number): 'STRONG' | 'BASELINE' | 'BARELY_ADEQUATE' | 'INADEQUATE' {
  if (scorePct >= 85) return 'STRONG';
  if (scorePct >= 60) return 'BASELINE';
  if (scorePct >= 40) return 'BARELY_ADEQUATE';
  return 'INADEQUATE';
}

type ScopeItemSeed = {
  questionKey: keyof typeof Q;
  source:
    | { kind: 'ASSET'; assetName: string }
    | { kind: 'THREAT'; assetName: string; actionType: ThreatSeed['actionType'] }
    | { kind: 'COUNTERMEASURE'; name: string };
  answer?: AnswerValue;
};

type SurveyScopeSeed = {
  clusterName: string;
  scopeName: string;
  description: string;
  evidenceTypes: ('PHYSICAL' | 'DOC_REVIEW' | 'REMOTE_TECH' | 'HYBRID' | 'CUSTOM')[];
  conductedByEmail: 'lead@nordica.demo' | 'assessor@nordica.demo' | 'admin@nordica.demo';
  evidenceSource: string;
  conductedDaysAgo: number;
  responseStatus: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  linkToAssessmentTitle?: string;
  vulnerabilityOverride?: boolean;
  items: ScopeItemSeed[];
};

const SURVEY_SCOPES: SurveyScopeSeed[] = [
  // ── HQ IT Infrastructure — SUBMITTED, mid-spectrum, linked to step-6 ──
  {
    clusterName: 'HQ IT Infrastructure',
    scopeName: 'HQ IT Infrastructure — Physical Walk-Through 2026-Q1',
    description: 'Quarterly physical + doc-review walk-through covering server room access, ACS, CCTV operability, and PII custody. Approved for FY26 evidence baseline.',
    evidenceTypes: ['PHYSICAL', 'DOC_REVIEW'],
    conductedByEmail: 'assessor@nordica.demo',
    evidenceSource: 'Internal audit team — walk-through + repo audit',
    conductedDaysAgo: 8,
    responseStatus: 'SUBMITTED',
    linkToAssessmentTitle: 'HQ IT Infrastructure — Controls Assessment',
    items: [
      { questionKey: 'locks',           source: { kind: 'ASSET', assetName: 'HQ Server Room' },           answer: 'YES' },
      { questionKey: 'accessLog',       source: { kind: 'ASSET', assetName: 'HQ Server Room' },           answer: 'YES' },
      { questionKey: 'perimeter',       source: { kind: 'ASSET', assetName: 'HQ Server Room' },           answer: 'PARTIAL' },
      { questionKey: 'personnelChecks', source: { kind: 'ASSET', assetName: 'Customer Database' },        answer: 'YES' },
      { questionKey: 'cmCams',          source: { kind: 'ASSET', assetName: 'HQ CCTV Array' },            answer: 'YES' },
      { questionKey: 'cmMaintenance',   source: { kind: 'ASSET', assetName: 'HQ Access Control System' }, answer: 'PARTIAL' },
    ],
  },
  // ── Hamburg Perimeter — SUBMITTED, weaker score, linked to step-5 ──
  {
    clusterName: 'Hamburg Perimeter Zone',
    scopeName: 'Hamburg Perimeter — Physical Walk-Through 2026-Q1',
    description: 'Physical walk-through of Hamburg outer-ring perimeter controls — fence integrity, gate ACS, camera coverage, and patrol response.',
    evidenceTypes: ['PHYSICAL'],
    conductedByEmail: 'assessor@nordica.demo',
    evidenceSource: 'Security ops night walk + day-shift inspection',
    conductedDaysAgo: 12,
    responseStatus: 'SUBMITTED',
    linkToAssessmentTitle: 'Hamburg Perimeter — IRV Review',
    items: [
      { questionKey: 'perimeter',     source: { kind: 'ASSET', assetName: 'Hamburg Perimeter' },        answer: 'PARTIAL' },
      { questionKey: 'cmCams',        source: { kind: 'ASSET', assetName: 'Hamburg Perimeter CCTV' },   answer: 'PARTIAL' },
      { questionKey: 'cmInstalled',   source: { kind: 'ASSET', assetName: 'Hamburg Perimeter Fence' },  answer: 'YES' },
      { questionKey: 'cmDamage',      source: { kind: 'ASSET', assetName: 'Hamburg Gate ACS' },         answer: 'PARTIAL' },
      { questionKey: 'cmMaintenance', source: { kind: 'ASSET', assetName: 'Hamburg Gate ACS' },         answer: 'NO' },
      { questionKey: 'procRefresher', source: { kind: 'ASSET', assetName: 'Hamburg Security Patrol' },  answer: 'PARTIAL' },
    ],
  },
  // ── HQ Information Assets — DRAFT (in-progress), no answers committed ──
  {
    clusterName: 'HQ Information Assets',
    scopeName: 'HQ Information Assets — Doc Review 2026-Q2',
    description: 'Doc-review of personnel screening, DLP coverage, and access logs across the HQ intangible information stack. In progress.',
    evidenceTypes: ['DOC_REVIEW'],
    conductedByEmail: 'lead@nordica.demo',
    evidenceSource: 'HR + IT Security joint review',
    conductedDaysAgo: 2,
    responseStatus: 'DRAFT',
    items: [
      { questionKey: 'personnelChecks',   source: { kind: 'ASSET', assetName: 'Customer Database' } },
      { questionKey: 'personnelChecks',   source: { kind: 'ASSET', assetName: 'Vendor Master Data' } },
      { questionKey: 'accessLog',         source: { kind: 'ASSET', assetName: 'Routing Algorithm IP' } },
      { questionKey: 'insiderIndicator',  source: { kind: 'ASSET', assetName: 'Executive Travel Itineraries' } },
      { questionKey: 'procDocumented',    source: { kind: 'ASSET', assetName: 'Vendor Master Data' } },
    ],
  },
  // ── Oslo Continuity Stack — APPROVED, strong score, linked to REVIEW ──
  {
    clusterName: 'Oslo Continuity Stack',
    scopeName: 'Oslo Continuity — Full Audit 2026-Q2',
    description: 'End-to-end audit of the Oslo continuity stack — physical DR room, tape custody, runbook documentation, and cross-border BCP readiness. Approved evidence for the FY26 BCP signoff.',
    evidenceTypes: ['PHYSICAL', 'DOC_REVIEW'],
    conductedByEmail: 'lead@nordica.demo',
    evidenceSource: 'External auditor (BV Group) + internal compliance',
    conductedDaysAgo: 5,
    responseStatus: 'APPROVED',
    linkToAssessmentTitle: 'Oslo DR Continuity Plan Review',
    vulnerabilityOverride: true,
    items: [
      { questionKey: 'locks',           source: { kind: 'ASSET', assetName: 'Oslo DR Server Room' },         answer: 'YES' },
      { questionKey: 'accessLog',       source: { kind: 'ASSET', assetName: 'Oslo DR Server Room' },         answer: 'YES' },
      { questionKey: 'cmAlarm',         source: { kind: 'ASSET', assetName: 'Oslo Office Alarm Panel' },     answer: 'YES' },
      { questionKey: 'cmInstalled',     source: { kind: 'ASSET', assetName: 'Oslo DR Backup Tapes' },        answer: 'YES' },
      { questionKey: 'procDocumented',  source: { kind: 'ASSET', assetName: 'Disaster Recovery Runbook' },   answer: 'YES' },
      { questionKey: 'procRefresher',   source: { kind: 'ASSET', assetName: 'Disaster Recovery Runbook' },   answer: 'PARTIAL' },
    ],
  },
];

async function seedSurveys(ctx: SurveyCtx): Promise<void> {
  // ── Resolve question library (system rows) ─────────────────
  const questionByKey = new Map<string, string>();
  for (const [key, prompt] of Object.entries(Q)) {
    const row = await prisma.surveyQuestion.findFirst({
      where: { prompt, isSystem: true },
      select: { id: true },
    });
    if (row) questionByKey.set(key, row.id);
  }
  if (questionByKey.size === 0) {
    console.log('  • surveys: SKIPPED — system question library not seeded yet (run again after next container boot)');
    return;
  }
  if (questionByKey.size < Object.keys(Q).length) {
    console.log(`  • surveys: warning — only ${questionByKey.size}/${Object.keys(Q).length} questions resolved; some scope items will be skipped`);
  }

  // ── 1 tenant SurveyTemplate (for the schedule + tenant defaults) ──
  const templateName = 'Nordica Standard Physical Walk-Through';
  let template = await prisma.surveyTemplate.findFirst({
    where: { tenantId: ctx.orgId, name: templateName },
  });
  if (!template) {
    template = await prisma.surveyTemplate.create({
      data: {
        tenantId: ctx.orgId,
        name: templateName,
        description: 'Nordica-standard physical walk-through covering locks, access logs, perimeter, and life-safety egress. Used by the quarterly schedule.',
        surveyType: 'PHYSICAL',
        applicableClusterTypes: ['SPATIAL', 'LOGICAL'],
        applicableAssetTypes: ['SITE', 'BUILDING', 'FLOOR', 'ROOM', 'ZONE'],
        requiresPhysical: true,
        isSystem: false,
        isActive: true,
        createdById: ctx.adminId,
        schema: {
          questions: [
            { ref: 'locks',           weight: 4 },
            { ref: 'accessLog',       weight: 3 },
            { ref: 'perimeter',       weight: 5 },
            { ref: 'egress',          weight: 3 },
            { ref: 'personnelChecks', weight: 4 },
          ],
        } as Prisma.InputJsonValue,
        createdAt: daysAgo(60),
      },
    });
  }

  // ── 4 AssetTypeSurveyDefault rows ─────────────────────────
  const defaults: { assetType: AssetTypeSeed; surveyType: 'PHYSICAL' | 'DOC_REVIEW' }[] = [
    { assetType: 'SITE',        surveyType: 'PHYSICAL'   },
    { assetType: 'BUILDING',    surveyType: 'PHYSICAL'   },
    { assetType: 'EQUIPMENT',   surveyType: 'DOC_REVIEW' },
    { assetType: 'INFORMATION', surveyType: 'DOC_REVIEW' },
  ];
  for (const d of defaults) {
    await prisma.assetTypeSurveyDefault.upsert({
      where: { tenantId_assetType_surveyType: { tenantId: ctx.orgId, assetType: d.assetType, surveyType: d.surveyType } },
      update: {},
      create: {
        tenantId: ctx.orgId,
        assetType: d.assetType,
        surveyType: d.surveyType,
        isDefault: true,
        templateId: d.surveyType === 'PHYSICAL' ? template.id : null,
      },
    });
  }

  // ── For each scope: ClusterSurveyScope + items + response (+ optional link) ──
  const emailToUserId: Record<string, string> = {
    'admin@nordica.demo':    ctx.adminId,
    'lead@nordica.demo':     ctx.leadId,
    'assessor@nordica.demo': ctx.assessorId,
  };

  let totalItems = 0;
  let totalResponses = 0;
  let totalLinks = 0;
  let totalScores = 0;

  for (const s of SURVEY_SCOPES) {
    const clusterId = ctx.clusterByName.get(s.clusterName);
    if (!clusterId) {
      console.log(`  • surveys: cluster not found, skipping — ${s.clusterName}`);
      continue;
    }
    const conductedById = emailToUserId[s.conductedByEmail];
    if (!conductedById) continue;

    // Idempotency: skip if scope with this name already exists for cluster
    const existingScope = await prisma.clusterSurveyScope.findFirst({
      where: { tenantId: ctx.orgId, clusterId, name: s.scopeName },
    });
    if (existingScope) continue;

    const scopeCreatedAt = daysAgo(s.conductedDaysAgo + 14); // scope approved before survey ran
    const scope = await prisma.clusterSurveyScope.create({
      data: {
        tenantId: ctx.orgId,
        clusterId,
        name: s.scopeName,
        description: s.description,
        evidenceTypes: s.evidenceTypes,
        aggregationMode: 'AGGREGATE_BY_CM_TEMPLATE',
        status: 'APPROVED',
        version: 1,
        createdById: ctx.adminId,
        approvedById: ctx.leadId,
        approvedAt: daysAgo(s.conductedDaysAgo + 7),
        createdAt: scopeCreatedAt,
      },
    });

    // ── Scope items ─────────────────────────────────────────
    const resolvedItems: Array<{ itemId: string; item: ScopeItemSeed }> = [];
    for (let i = 0; i < s.items.length; i++) {
      const item = s.items[i]!;
      const questionId = questionByKey.get(item.questionKey);
      if (!questionId) continue;

      let sourceAssetId: string | null = null;
      let sourceThreatId: string | null = null;
      let sourceCountermeasureId: string | null = null;

      if (item.source.kind === 'ASSET') {
        sourceAssetId = ctx.assetByName.get(item.source.assetName) ?? null;
        if (!sourceAssetId) continue;
      } else if (item.source.kind === 'THREAT') {
        const targetAssetId = ctx.assetByName.get(item.source.assetName);
        if (!targetAssetId) continue;
        const threat = await prisma.threat.findFirst({
          where: { targetAssetId, actionType: item.source.actionType, assessment: { tenantId: ctx.orgId } },
        });
        sourceThreatId = threat?.id ?? null;
        if (!sourceThreatId) continue;
      } else {
        const cm = await prisma.countermeasure.findFirst({
          where: { tenantId: ctx.orgId, name: item.source.name },
        });
        sourceCountermeasureId = cm?.id ?? null;
        if (!sourceCountermeasureId) continue;
      }

      const created = await prisma.clusterSurveyScopeItem.create({
        data: {
          scopeId: scope.id,
          questionId,
          sourceType: item.source.kind,
          sourceAssetId,
          sourceThreatId,
          sourceCountermeasureId,
          sortOrder: i,
          addedById: ctx.adminId,
          addedAt: scopeCreatedAt,
        },
      });
      resolvedItems.push({ itemId: created.id, item });
      totalItems += 1;
    }
    if (resolvedItems.length === 0) continue;

    // ── SurveyResponse ─────────────────────────────────────
    // Build answers map keyed by scope-item id
    const answers: Record<string, string> = {};
    let okSum = 0;
    let answered = 0;
    for (const { itemId, item } of resolvedItems) {
      if (item.answer) {
        answers[itemId] = item.answer;
        okSum += ANSWER_OK[item.answer];
        answered += 1;
      }
    }
    const scorePct = answered > 0 ? Math.round((okSum / answered) * 100 * 100) / 100 : null;
    const rating = scorePct != null ? ratingFor(scorePct) : null;
    const primaryType = s.evidenceTypes[0]!;
    const requiresPhysical = s.evidenceTypes.includes('PHYSICAL');

    const response = await prisma.surveyResponse.create({
      data: {
        tenantId: ctx.orgId,
        clusterId,
        templateId: null,
        clusterSurveyScopeId: scope.id,
        surveyType: primaryType,
        conductedById,
        conductedAt: daysAgo(s.conductedDaysAgo),
        answers: answers as Prisma.InputJsonValue,
        scorePct: scorePct != null ? new Prisma.Decimal(scorePct) : null,
        rating,
        vulnerabilityScorePct: scorePct != null ? new Prisma.Decimal(scorePct) : null,
        vulnerabilityRating: rating,
        evidenceSource: s.evidenceSource,
        requiresPhysical,
        status: s.responseStatus,
        createdAt: daysAgo(s.conductedDaysAgo),
      },
    });
    totalResponses += 1;

    // ── AAA scores (one row per unique source) — for SUBMITTED/APPROVED ──
    if (s.responseStatus !== 'DRAFT') {
      type Bucket = { sum: number; answered: number; total: number; kind: 'ASSET' | 'THREAT' | 'COUNTERMEASURE'; sourceAssetId: string | null; sourceThreatId: string | null; sourceCountermeasureId: string | null };
      const byKey = new Map<string, Bucket>();
      for (const { itemId, item } of resolvedItems) {
        let key = '';
        let kind: 'ASSET' | 'THREAT' | 'COUNTERMEASURE' = 'ASSET';
        let sourceAssetId: string | null = null;
        let sourceThreatId: string | null = null;
        let sourceCountermeasureId: string | null = null;
        if (item.source.kind === 'ASSET') {
          kind = 'ASSET';
          sourceAssetId = ctx.assetByName.get(item.source.assetName) ?? null;
          key = `ASSET|${sourceAssetId}`;
        } else if (item.source.kind === 'THREAT') {
          kind = 'THREAT';
          const t = await prisma.threat.findFirst({
            where: {
              targetAssetId: ctx.assetByName.get(item.source.assetName) ?? '',
              actionType: item.source.actionType,
              assessment: { tenantId: ctx.orgId },
            },
            select: { id: true },
          });
          sourceThreatId = t?.id ?? null;
          key = `THREAT|${sourceThreatId}`;
        } else {
          kind = 'COUNTERMEASURE';
          const cm = await prisma.countermeasure.findFirst({
            where: { tenantId: ctx.orgId, name: item.source.name },
            select: { id: true },
          });
          sourceCountermeasureId = cm?.id ?? null;
          key = `CM|${sourceCountermeasureId}`;
        }
        if (!byKey.has(key)) byKey.set(key, { sum: 0, answered: 0, total: 0, kind, sourceAssetId, sourceThreatId, sourceCountermeasureId });
        const bucket = byKey.get(key)!;
        bucket.total += 1;
        if (item.answer) {
          bucket.answered += 1;
          bucket.sum += ANSWER_OK[item.answer];
        }
        // silence unused-var lint
        void itemId;
      }
      for (const bucket of byKey.values()) {
        const pct = bucket.answered > 0 ? Math.round((bucket.sum / bucket.answered) * 100 * 100) / 100 : null;
        await prisma.surveyResponseAaaScore.create({
          data: {
            responseId: response.id,
            sourceType: bucket.kind,
            sourceAssetId: bucket.sourceAssetId,
            sourceThreatId: bucket.sourceThreatId,
            sourceCountermeasureId: bucket.sourceCountermeasureId,
            scorePct: pct != null ? new Prisma.Decimal(pct) : null,
            rating: pct != null ? ratingFor(pct) : null,
            answeredCount: bucket.answered,
            totalCount: bucket.total,
          },
        });
        totalScores += 1;
      }
    }

    // ── Link to assessment (and refresh evidenceBasis) ──────
    if (s.linkToAssessmentTitle && s.responseStatus !== 'DRAFT') {
      const assessment = await prisma.assessment.findFirst({
        where: { tenantId: ctx.orgId, title: s.linkToAssessmentTitle },
      });
      if (assessment) {
        await prisma.assessmentSurvey.upsert({
          where: { assessmentId_surveyResponseId: { assessmentId: assessment.id, surveyResponseId: response.id } },
          update: {},
          create: {
            assessmentId: assessment.id,
            surveyResponseId: response.id,
            linkedById: ctx.leadId,
            linkedAt: daysAgo(s.conductedDaysAgo - 1),
            vulnerabilityOverride: s.vulnerabilityOverride ?? false,
          },
        });
        // Reflect linked evidence in the assessment row
        await prisma.assessment.update({
          where: { id: assessment.id },
          data: {
            evidenceBasis: s.responseStatus === 'APPROVED' ? 'SURVEY_LINKED' : 'MIXED',
            surveyPending: false,
            lastSurveyDate: daysAgo(s.conductedDaysAgo),
          },
        });
        totalLinks += 1;
      }
    }
  }

  // ── 1 SurveySchedule (quarterly recurring) ───────────────
  const hqItClusterId = ctx.clusterByName.get('HQ IT Infrastructure');
  if (hqItClusterId) {
    const existingSchedule = await prisma.surveySchedule.findFirst({
      where: { tenantId: ctx.orgId, clusterId: hqItClusterId, templateId: template.id },
    });
    if (!existingSchedule) {
      await prisma.surveySchedule.create({
        data: {
          tenantId: ctx.orgId,
          clusterId: hqItClusterId,
          templateId: template.id,
          cron: '0 9 1 */3 *', // quarter-start at 09:00
          assignedToId: ctx.assessorId,
          status: 'ACTIVE',
          lastRunAt: daysAgo(8),
          nextRunAt: daysFromNow(82),
          createdAt: daysAgo(120),
        },
      });
    }
  }

  console.log(`  • surveys: 1 template, ${defaults.length} type-defaults, ${SURVEY_SCOPES.length} scopes, ${totalItems} scope items, ${totalResponses} responses, ${totalScores} AAA scores, ${totalLinks} assessment links, 1 schedule`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
