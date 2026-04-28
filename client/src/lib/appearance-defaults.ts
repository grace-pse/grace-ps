import {
  Activity,
  AlertTriangle,
  Box,
  Boxes,
  Briefcase,
  Building2,
  Camera,
  Car,
  Cpu,
  Database,
  Eye,
  FileText,
  Folder,
  Globe,
  Hash,
  Hexagon,
  Key,
  Layers,
  Lock,
  MapPin,
  Network,
  Repeat,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  ShieldOff,
  Star,
  Truck,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AssetType, AssetRole, RelationshipType } from './csmp-types';

export type RiskLevel = 'Negligible' | 'Low' | 'Moderate' | 'High' | 'Extreme';

export interface AssetRoleStyle {
  borderColor: string;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  iconName: string;
  chipBg: string;
  chipInk: string;
  nodeBg: string;
}

export interface AssetTypeStyle {
  color: string;
  bg: string;
  ink: string;
  iconName: string;
  abbr: string;
}

export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  dashArray: string | null;
  showLabel: boolean;
}

export interface RiskColor {
  bg: string;
  ink: string;
}

export interface AppearanceSettings {
  v: 1;
  assetRoleStyles: Record<AssetRole, AssetRoleStyle>;
  assetTypeStyles: Record<AssetType, AssetTypeStyle>;
  edgeStyles: Record<RelationshipType, EdgeStyle>;
  riskColors: Record<RiskLevel, RiskColor>;
}

// ─── defaults ───────────────────────────────────────────────
// Hex values mirror tailwind.config.ts:25-67 so the static defaults
// match what the rest of the UI renders today.

export const DEFAULT_ASSET_ROLE_STYLES: Record<AssetRole, AssetRoleStyle> = {
  PROTECTED: {
    borderColor: '#9a9a96', borderWidth: 2, borderStyle: 'solid',
    iconName: 'Shield', chipBg: '#f0f0ef', chipInk: '#373735',
    nodeBg: '#ffffff',
  },
  PROTECTIVE: {
    borderColor: '#4f56e5', borderWidth: 2, borderStyle: 'solid',
    iconName: 'ShieldCheck', chipBg: '#eef1ff', chipInk: '#3436a4',
    nodeBg: '#ffffff',
  },
  DUAL: {
    borderColor: '#4f56e5', borderWidth: 2, borderStyle: 'dashed',
    iconName: 'ShieldHalf', chipBg: '#eef1ff', chipInk: '#3436a4',
    nodeBg: '#ffffff',
  },
};

export const DEFAULT_ASSET_TYPE_STYLES: Record<AssetType, AssetTypeStyle> = {
  SITE:        { color: '#525250', bg: '#f0f0ef', ink: '#242423', iconName: 'MapPin',    abbr: 'SITE' },
  BUILDING:    { color: '#8b6f47', bg: '#eaddc7', ink: '#5a4a30', iconName: 'Building2', abbr: 'BLDG' },
  FLOOR:       { color: '#5a637a', bg: '#e7e9ef', ink: '#2d3344', iconName: 'Layers',    abbr: 'FL'   },
  ROOM:        { color: '#3a6680', bg: '#ddeaf2', ink: '#1f3b50', iconName: 'Box',       abbr: 'ROOM' },
  ZONE:        { color: '#6f4d8b', bg: '#e8def0', ink: '#422c5a', iconName: 'Hexagon',   abbr: 'ZONE' },
  EQUIPMENT:   { color: '#4f56e5', bg: '#dfe3ff', ink: '#2b2d83', iconName: 'Cpu',       abbr: 'EQ'   },
  VEHICLE:     { color: '#b56b1c', bg: '#fce4ce', ink: '#6e3f0a', iconName: 'Truck',     abbr: 'VEH'  },
  PERSON:      { color: '#a13d63', bg: '#f9d9e2', ink: '#6e2440', iconName: 'User',      abbr: 'PER'  },
  INFORMATION: { color: '#2d7a82', bg: '#d9eef0', ink: '#16464b', iconName: 'FileText',  abbr: 'INFO' },
  IP:          { color: '#2d7a5a', bg: '#d3ece1', ink: '#155234', iconName: 'Globe',     abbr: 'IP'   },
  PROCESS:     { color: '#3d6a33', bg: '#d4e3cf', ink: '#214519', iconName: 'Activity',  abbr: 'PROC' },
  REPUTATION:  { color: '#7a5a0e', bg: '#f5e4a7', ink: '#4a3608', iconName: 'Star',      abbr: 'REP'  },
  CONTINUITY:  { color: '#8a4a14', bg: '#f4c59a', ink: '#4a280a', iconName: 'Repeat',    abbr: 'CONT' },
};

export const DEFAULT_EDGE_STYLES: Record<RelationshipType, EdgeStyle> = {
  DEPENDS_ON:        { stroke: '#72726e', strokeWidth: 1.5, dashArray: null, showLabel: true },
  PROTECTS:          { stroke: '#4f56e5', strokeWidth: 1.5, dashArray: null, showLabel: true },
  SERVES:            { stroke: '#72726e', strokeWidth: 1.5, dashArray: null, showLabel: true },
  CONTAINS:          { stroke: '#72726e', strokeWidth: 1.5, dashArray: null, showLabel: true },
  COMMUNICATES_WITH: { stroke: '#72726e', strokeWidth: 1.5, dashArray: null, showLabel: true },
  ADJACENT_TO:       { stroke: '#72726e', strokeWidth: 1.5, dashArray: null, showLabel: true },
  SUPPLIES:          { stroke: '#72726e', strokeWidth: 1.5, dashArray: null, showLabel: true },
  MONITORS:          { stroke: '#4f56e5', strokeWidth: 1.5, dashArray: null, showLabel: true },
};

export const DEFAULT_RISK_COLORS: Record<RiskLevel, RiskColor> = {
  Negligible: { bg: '#e5e5e2', ink: '#525250' },
  Low:        { bg: '#d4e3cf', ink: '#3d6a33' },
  Moderate:   { bg: '#f5e4a7', ink: '#7a5a0e' },
  High:       { bg: '#f4c59a', ink: '#8a4a14' },
  Extreme:    { bg: '#eea494', ink: '#8a2f1d' },
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  v: 1,
  assetRoleStyles: DEFAULT_ASSET_ROLE_STYLES,
  assetTypeStyles: DEFAULT_ASSET_TYPE_STYLES,
  edgeStyles: DEFAULT_EDGE_STYLES,
  riskColors: DEFAULT_RISK_COLORS,
};

// ─── Lucide icon whitelist ───────────────────────────────────
// Icon names users can pick from in IconPicker. resolveIcon also accepts
// any other Lucide name via the free-text fallback, but unknown names
// fall back to Box. Keep this list curated and predictable.

export const LUCIDE_ICON_WHITELIST: { name: string; component: LucideIcon }[] = [
  { name: 'Shield', component: Shield },
  { name: 'ShieldCheck', component: ShieldCheck },
  { name: 'ShieldHalf', component: ShieldHalf },
  { name: 'ShieldAlert', component: ShieldAlert },
  { name: 'ShieldOff', component: ShieldOff },
  { name: 'Building2', component: Building2 },
  { name: 'MapPin', component: MapPin },
  { name: 'Network', component: Network },
  { name: 'Server', component: Server },
  { name: 'Cpu', component: Cpu },
  { name: 'Camera', component: Camera },
  { name: 'Lock', component: Lock },
  { name: 'Key', component: Key },
  { name: 'User', component: User },
  { name: 'Users', component: Users },
  { name: 'FileText', component: FileText },
  { name: 'Database', component: Database },
  { name: 'Layers', component: Layers },
  { name: 'Box', component: Box },
  { name: 'Boxes', component: Boxes },
  { name: 'Truck', component: Truck },
  { name: 'Car', component: Car },
  { name: 'Globe', component: Globe },
  { name: 'Activity', component: Activity },
  { name: 'AlertTriangle', component: AlertTriangle },
  { name: 'Briefcase', component: Briefcase },
  { name: 'Folder', component: Folder },
  { name: 'Hash', component: Hash },
  { name: 'Hexagon', component: Hexagon },
  { name: 'Zap', component: Zap },
  { name: 'Star', component: Star },
  { name: 'Repeat', component: Repeat },
  { name: 'Eye', component: Eye },
];

const ICON_BY_NAME = new Map<string, LucideIcon>(
  LUCIDE_ICON_WHITELIST.map((e) => [e.name, e.component]),
);

export function resolveIcon(name: string | undefined | null): LucideIcon {
  if (!name) return Box;
  return ICON_BY_NAME.get(name) ?? Box;
}

export function isKnownIcon(name: string): boolean {
  return ICON_BY_NAME.has(name);
}
