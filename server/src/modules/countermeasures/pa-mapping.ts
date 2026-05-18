import type {
  AssetType,
  PpsFunction,
  ProtectionDomain,
  ShapeCategory,
} from '@prisma/client';

// Sensible defaults when auto-promoting a Protective Asset into a
// Countermeasure record for Step 6 ("each linked PA is a control").
// The assessor edits these later — these only seed the row so the
// effectiveness picker has somewhere to live.
//
// Asset.assetType is coarse (EQUIPMENT, VEHICLE, PERSON, etc.) so the
// mapping is necessarily coarse. Concrete subtype hints would live in
// Asset.metadata.customFields, which the assessor can review and refine.
export interface PaCmDefaults {
  shapeCategory: ShapeCategory;
  ppsFunctions: PpsFunction[];
  domain: ProtectionDomain;
}

export function paToCountermeasureDefaults(assetType: AssetType): PaCmDefaults {
  switch (assetType) {
    // Physical security equipment — cameras, KD readers, alarm panels.
    // Default to DETECT; assessor adds DETER / DENY as appropriate.
    case 'EQUIPMENT':
      return {
        shapeCategory: 'EQUIPMENT',
        ppsFunctions: ['DETECT'],
        domain: 'BUILDING',
      };

    // Patrol vehicles, escort cars — mobile equipment with a human element.
    case 'VEHICLE':
      return {
        shapeCategory: 'EQUIPMENT',
        ppsFunctions: ['DETER', 'DETECT'],
        domain: 'PERIMETER',
      };

    // Security personnel, guards — pure human controls.
    case 'PERSON':
      return {
        shapeCategory: 'HUMAN',
        ppsFunctions: ['DETER', 'DETECT'],
        domain: 'PERIMETER',
      };

    // Architectural / spatial assets acting as PROTECTIVE — fences,
    // hardened zones, mantraps. DELAY/DENY are their typical PPS roles.
    case 'SITE':
    case 'BUILDING':
    case 'FLOOR':
    case 'ROOM':
    case 'ZONE':
      return {
        shapeCategory: 'ARCHITECTURAL',
        ppsFunctions: ['DELAY', 'DENY'],
        domain: 'PERIMETER',
      };

    // Abstract / intangible — these are almost never PROTECTIVE in
    // practice, but if they are, surface as procedural defaults. SYSTEM
    // is a domain/functional container and almost never PROTECTIVE either.
    case 'INFORMATION':
    case 'IP':
    case 'PROCESS':
    case 'REPUTATION':
    case 'CONTINUITY':
    case 'SYSTEM':
      return {
        shapeCategory: 'PROCEDURAL',
        ppsFunctions: ['DETECT'],
        domain: 'INFORMATION',
      };
  }
}
