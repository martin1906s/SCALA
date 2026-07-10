import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getFootprintCellCount } from '@/domain/structures/Footprint';
import type { PieceType } from '@/entities/BuildingPiece';
import type { CollisionSystem, PlacementCandidate } from '@/systems/CollisionSystem';

export interface StructuralWarning {
  message: string;
  severity: 'warning';
}

export class StructuralIntegritySystem {
  constructor(_collision: CollisionSystem) {
  }

  checkPlacement(candidate: PlacementCandidate): StructuralWarning | null {
    if (candidate.type !== 'floor' && candidate.type !== 'roof') {
      if (candidate.type === 'wall') {
        const height = (candidate.dimensions as { height: number }).height;
        if (height >= 2.5) {
          return {
            message: 'Muro alto: considera refuerzos laterales.',
            severity: 'warning',
          };
        }
      }
      return null;
    }

    const span = getFootprintCellCount({
      gridX: candidate.gridX,
      gridZ: candidate.gridZ,
      gridY: candidate.gridY,
      type: candidate.type,
      dimensions: candidate.dimensions,
      rotationY: candidate.rotationY,
      offsetX: candidate.offsetX,
      offsetZ: candidate.offsetZ,
    });

    if (span > 4 && candidate.gridY >= 1) {
      return {
        message: 'Gran vano elevado: añade columnas de soporte.',
        severity: 'warning',
      };
    }

    if (span > 6) {
      return {
        message: 'Plataforma extensa: refuerza con columnas.',
        severity: 'warning',
      };
    }

    return null;
  }

  countWarnings(pieces: Array<{
    type: PieceType;
    dimensions: MaterialDimensions;
    gridX: number;
    gridZ: number;
    gridY: number;
    rotation: { y: number };
    offsetX: number;
    offsetZ: number;
  }>): number {
    let count = 0;
    for (const piece of pieces) {
      const warning = this.checkPlacement({
        type: piece.type,
        dimensions: piece.dimensions,
        materialTier: 'wood',
        gridX: piece.gridX,
        gridZ: piece.gridZ,
        gridY: piece.gridY,
        rotationY: piece.rotation.y,
        offsetX: piece.offsetX,
        offsetZ: piece.offsetZ,
        cost: 0,
      });
      if (warning) {
        count += 1;
      }
    }
    return count;
  }
}
