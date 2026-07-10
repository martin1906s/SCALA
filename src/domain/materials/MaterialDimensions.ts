import type { PieceType } from '@/entities/BuildingPiece';
import { PIECE_DIMS } from '@/config/gameConfig';

export const DIMENSION_STEP = 0.25;

export interface WallDims {
  width: number;
  height: number;
  depth: number;
}

export interface FloorDims {
  width: number;
  height: number;
  depth: number;
}

export interface PillarDims {
  diameter: number;
  height: number;
}

export interface RoofDims {
  width: number;
  height: number;
  depth: number;
}

export interface RampDims {
  width: number;
  height: number;
  depth: number;
}

export type MaterialDimensions =
  | WallDims
  | FloorDims
  | PillarDims
  | RoofDims
  | RampDims;

export interface DimensionLimits {
  min: number;
  max: number;
}

export const DIMENSION_LIMITS: Record<PieceType, Record<string, DimensionLimits>> = {
  wall: {
    width: { min: 0.5, max: 4 },
    height: { min: 0.5, max: 3 },
    depth: { min: 0.1, max: 0.5 },
  },
  floor: {
    width: { min: 0.5, max: 6 },
    height: { min: 0.05, max: 0.3 },
    depth: { min: 0.5, max: 6 },
  },
  pillar: {
    diameter: { min: 0.3, max: 1.5 },
    height: { min: 0.5, max: 4 },
  },
  roof: {
    width: { min: 0.5, max: 6 },
    height: { min: 0.1, max: 1.5 },
    depth: { min: 0.5, max: 6 },
  },
  ramp: {
    width: { min: 0.5, max: 4 },
    height: { min: 0.1, max: 2 },
    depth: { min: 0.5, max: 6 },
  },
};

export function snapDimension(value: number): number {
  return Math.round(value / DIMENSION_STEP) * DIMENSION_STEP;
}

export function clampDimension(value: number, limits: DimensionLimits): number {
  return snapDimension(Math.min(limits.max, Math.max(limits.min, value)));
}

export function getDefaultDimensions(type: PieceType): MaterialDimensions {
  switch (type) {
    case 'wall':
      return { ...PIECE_DIMS.wall };
    case 'floor':
      return { ...PIECE_DIMS.floor };
    case 'pillar':
      return { ...PIECE_DIMS.pillar };
    case 'roof':
      return { width: 2, height: 0.4, depth: 2 };
    case 'ramp':
      return { width: 1, height: 0.5, depth: 2 };
    default:
      return { ...PIECE_DIMS.wall };
  }
}

export function getPieceHeight(type: PieceType, dimensions: MaterialDimensions): number {
  if (type === 'pillar') {
    return (dimensions as PillarDims).height;
  }
  return (dimensions as WallDims).height;
}

export function getHorizontalExtents(
  type: PieceType,
  dimensions: MaterialDimensions,
  rotationY: number,
): { widthX: number; depthZ: number } {
  let width: number;
  let depth: number;

  if (type === 'pillar') {
    const d = (dimensions as PillarDims).diameter;
    width = d;
    depth = d;
  } else {
    const box = dimensions as WallDims;
    width = box.width;
    depth = box.depth;
  }

  const swap = Math.abs(Math.sin(rotationY)) > Math.abs(Math.cos(rotationY));
  return swap
    ? { widthX: depth, depthZ: width }
    : { widthX: width, depthZ: depth };
}

export function validateDimensions(type: PieceType, dimensions: MaterialDimensions): MaterialDimensions {
  const limits = DIMENSION_LIMITS[type];
  switch (type) {
    case 'wall': {
      const d = dimensions as WallDims;
      return {
        width: clampDimension(d.width, limits.width!),
        height: clampDimension(d.height, limits.height!),
        depth: clampDimension(d.depth, limits.depth!),
      };
    }
    case 'floor':
    case 'roof':
    case 'ramp': {
      const d = dimensions as FloorDims;
      return {
        width: clampDimension(d.width, limits.width!),
        height: clampDimension(d.height, limits.height!),
        depth: clampDimension(d.depth, limits.depth!),
      };
    }
    case 'pillar': {
      const d = dimensions as PillarDims;
      return {
        diameter: clampDimension(d.diameter, limits.diameter!),
        height: clampDimension(d.height, limits.height!),
      };
    }
    default:
      return dimensions;
  }
}

export function cloneDimensions(dimensions: MaterialDimensions): MaterialDimensions {
  return { ...dimensions };
}
