import type { PieceType } from '@/entities/BuildingPiece';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getDefaultDimensions } from '@/domain/materials/MaterialDimensions';

export type MaterialTier = 'wood' | 'stone' | 'marble';

export const TIER_MULTIPLIERS: Record<MaterialTier, number> = {
  wood: 1,
  stone: 1.4,
  marble: 2,
};

export const TIER_LABELS: Record<MaterialTier, string> = {
  wood: 'Madera',
  stone: 'Piedra',
  marble: 'Mármol',
};

/** Costo base por m² de área visible. */
export const AREA_RATE: Record<PieceType, number> = {
  wall: 60,
  floor: 35,
  pillar: 45,
  roof: 40,
  ramp: 38,
};

/** Recargo por m³ de volumen. */
export const VOLUME_RATE: Record<PieceType, number> = {
  wall: 25,
  floor: 15,
  pillar: 30,
  roof: 20,
  ramp: 22,
};

/** Área de referencia (dimensiones default) para comparar costos. */
export function getReferenceArea(type: PieceType): number {
  const dims = getDefaultDimensions(type);
  switch (type) {
    case 'wall': {
      const d = dims as { width: number; height: number };
      return d.width * d.height;
    }
    case 'pillar': {
      const d = dims as { diameter: number; height: number };
      return d.diameter * d.height;
    }
    default: {
      const box = dims as { width: number; depth: number };
      return box.width * box.depth;
    }
  }
}

export function getVisibleArea(type: PieceType, dimensions: MaterialDimensions): number {
  switch (type) {
    case 'wall': {
      const d = dimensions as { width: number; height: number };
      return d.width * d.height;
    }
    case 'pillar': {
      const d = dimensions as { diameter: number; height: number };
      return d.diameter * d.height;
    }
    default: {
      const d = dimensions as { width: number; depth: number };
      return d.width * d.depth;
    }
  }
}

export function getVolume(type: PieceType, dimensions: MaterialDimensions): number {
  switch (type) {
    case 'wall': {
      const d = dimensions as { width: number; height: number; depth: number };
      return d.width * d.height * d.depth;
    }
    case 'pillar': {
      const d = dimensions as { diameter: number; height: number };
      const r = d.diameter / 2;
      return Math.PI * r * r * d.height;
    }
    default: {
      const d = dimensions as { width: number; height: number; depth: number };
      return d.width * d.height * d.depth;
    }
  }
}
