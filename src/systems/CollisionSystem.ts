import { cellKey, type CellKey } from '@/config/worldLayout';
import type { MaterialTier } from '@/config/materialCatalog';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getOccupiedCells, type FootprintInput } from '@/domain/structures/Footprint';
import type { PieceType } from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import type { GridSystem } from '@/systems/GridSystem';

export interface PlacementCandidate {
  type: PieceType;
  dimensions: MaterialDimensions;
  materialTier: MaterialTier;
  gridX: number;
  gridZ: number;
  gridY: number;
  rotationY: number;
  offsetX?: number;
  offsetZ?: number;
  cost: number;
}

export class CollisionSystem {
  private readonly grid: GridSystem;

  constructor(grid: GridSystem) {
    this.grid = grid;
  }

  getFootprintCells(input: FootprintInput): CellKey[] {
    return getOccupiedCells(input);
  }

  footprintOverlaps(
    cells: CellKey[],
    gridY: number,
    excludeId?: string,
  ): boolean {
    const pieces = useGameStore.getState().pieces;
    for (const piece of pieces) {
      if (piece.id === excludeId || piece.gridY !== gridY) {
        continue;
      }
      const footprint = piece.footprintCells ?? [];
      for (const cell of cells) {
        if (footprint.includes(cell)) {
          return true;
        }
      }
    }
    return false;
  }

  allCellsInBounds(cells: CellKey[]): boolean {
    for (const key of cells) {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      if (!this.grid.isInBounds(gx, gz)) {
        return false;
      }
    }
    return cells.length > 0;
  }

  anyCellBlockedOnGround(cells: CellKey[], gridY: number): boolean {
    if (gridY !== 0) {
      return false;
    }
    for (const key of cells) {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      if (this.grid.isBlockedForBuilding(gx, gz, 0)) {
        return true;
      }
    }
    return false;
  }

  hasSupportForFootprint(cells: CellKey[], gridY: number, excludeId?: string): boolean {
    if (gridY === 0) {
      return !this.anyCellBlockedOnGround(cells, 0);
    }

    for (const key of cells) {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      if (!this.grid.hasSupport(gx, gz, gridY, excludeId)) {
        return false;
      }
    }
    return true;
  }

  canMove(candidate: PlacementCandidate, excludeId?: string): boolean {
    const cells = this.getFootprintCells({
      gridX: candidate.gridX,
      gridZ: candidate.gridZ,
      gridY: candidate.gridY,
      type: candidate.type,
      dimensions: candidate.dimensions,
      rotationY: candidate.rotationY,
      offsetX: candidate.offsetX,
      offsetZ: candidate.offsetZ,
    });

    if (!this.allCellsInBounds(cells)) {
      return false;
    }
    if (this.anyCellBlockedOnGround(cells, candidate.gridY)) {
      return false;
    }
    if (this.footprintOverlaps(cells, candidate.gridY, excludeId)) {
      return false;
    }
    return true;
  }

  canPlace(candidate: PlacementCandidate, excludeId?: string): boolean {
    const cells = this.getFootprintCells({
      gridX: candidate.gridX,
      gridZ: candidate.gridZ,
      gridY: candidate.gridY,
      type: candidate.type,
      dimensions: candidate.dimensions,
      rotationY: candidate.rotationY,
      offsetX: candidate.offsetX,
      offsetZ: candidate.offsetZ,
    });

    if (!this.allCellsInBounds(cells)) {
      return false;
    }
    if (!this.grid.canStackLayer(candidate.gridY)) {
      return false;
    }
    if (this.anyCellBlockedOnGround(cells, candidate.gridY)) {
      return false;
    }
    if (this.footprintOverlaps(cells, candidate.gridY, excludeId)) {
      return false;
    }
    if (!this.hasSupportForFootprint(cells, candidate.gridY, excludeId)) {
      return false;
    }
    return true;
  }

  getPlaceFailureReason(candidate: PlacementCandidate, excludeId?: string): string | null {
    const cells = this.getFootprintCells({
      gridX: candidate.gridX,
      gridZ: candidate.gridZ,
      gridY: candidate.gridY,
      type: candidate.type,
      dimensions: candidate.dimensions,
      rotationY: candidate.rotationY,
      offsetX: candidate.offsetX,
      offsetZ: candidate.offsetZ,
    });

    if (!this.allCellsInBounds(cells)) {
      return 'Fuera del terreno de construcción.';
    }
    if (!this.grid.canStackLayer(candidate.gridY)) {
      return 'Has alcanzado el límite de altura.';
    }
    if (this.anyCellBlockedOnGround(cells, candidate.gridY)) {
      return 'No puedes construir sobre la carretera a nivel del suelo.';
    }
    if (this.footprintOverlaps(cells, candidate.gridY, excludeId)) {
      return 'El área ya está ocupada por otra estructura.';
    }
    if (!this.hasSupportForFootprint(cells, candidate.gridY, excludeId)) {
      const [gx, gz] = (cells[0]?.split(',').map(Number) as [number, number]) ?? [0, 0];
      return this.grid.isRoad(gx, gz) && candidate.gridY >= 1
        ? 'El puente necesita apoyo desde los lados o desde abajo.'
        : 'La estructura necesita soporte debajo.';
    }
    return null;
  }

  getTopLayerAt(gx: number, gz: number): number {
    const key = cellKey(gx, gz);
    const pieces = useGameStore.getState().pieces;
    let top = -1;
    for (const piece of pieces) {
      const footprint = piece.footprintCells ?? [];
      if (footprint.includes(key) && piece.gridY > top) {
        top = piece.gridY;
      }
    }
    return top;
  }

  findPieceAtCell(gx: number, gz: number, gridY?: number): string | null {
    const key = cellKey(gx, gz);
    const pieces = useGameStore.getState().pieces;
    let best: { id: string; gridY: number } | null = null;
    for (const piece of pieces) {
      const footprint = piece.footprintCells ?? [];
      if (!footprint.includes(key)) {
        continue;
      }
      if (gridY !== undefined && piece.gridY !== gridY) {
        continue;
      }
      if (!best || piece.gridY > best.gridY) {
        best = { id: piece.id, gridY: piece.gridY };
      }
    }
    return best?.id ?? null;
  }
}
