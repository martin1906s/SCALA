import type { PieceType } from '@/entities/BuildingPiece';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import type { MaterialTier } from '@/config/materialCatalog';

export interface Blueprint {
  id: string;
  name: string;
  type: PieceType;
  dimensions: MaterialDimensions;
  tier: MaterialTier;
  unlockLevel: number;
}

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'wall-long',
    name: 'Muro largo 3×2',
    type: 'wall',
    dimensions: { width: 3, height: 2, depth: 0.2 },
    tier: 'wood',
    unlockLevel: 1,
  },
  {
    id: 'platform-4x4',
    name: 'Plataforma 4×4',
    type: 'floor',
    dimensions: { width: 4, height: 0.12, depth: 4 },
    tier: 'wood',
    unlockLevel: 1,
  },
  {
    id: 'pillar-tall',
    name: 'Columna alta',
    type: 'pillar',
    dimensions: { diameter: 0.6, height: 3 },
    tier: 'stone',
    unlockLevel: 2,
  },
  {
    id: 'bridge-basic',
    name: 'Puente básico',
    type: 'floor',
    dimensions: { width: 4, height: 0.12, depth: 1 },
    tier: 'wood',
    unlockLevel: 2,
  },
  {
    id: 'fortress-wall',
    name: 'Muro fortaleza',
    type: 'wall',
    dimensions: { width: 2, height: 2.5, depth: 0.3 },
    tier: 'stone',
    unlockLevel: 3,
  },
];

export function getUnlockedBlueprints(completedLevel: number, sandbox = false): Blueprint[] {
  if (sandbox) {
    return BLUEPRINTS;
  }
  return BLUEPRINTS.filter((bp) => bp.unlockLevel <= completedLevel + 1);
}
