import type { MaterialTier } from '@/config/materialCatalog';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import type { BuildingPiece, PieceRotation, PieceType } from '@/entities/BuildingPiece';
import { cloneRotation } from '@/entities/BuildingPiece';
import { cloneDimensions } from '@/domain/materials/MaterialDimensions';

export type HistoryAction =
  | {
      kind: 'place';
      pieceId: string;
    }
  | {
      kind: 'delete';
      snapshot: PieceSnapshot;
    }
  | {
      kind: 'restore';
      snapshot: PieceSnapshot;
    }
  | {
      kind: 'move';
      pieceId: string;
      before: PiecePosition;
      after: PiecePosition;
    };

export interface PiecePosition {
  gridX: number;
  gridZ: number;
  gridY: number;
  offsetX: number;
  offsetZ: number;
}

export interface PieceSnapshot {
  id: string;
  type: PieceType;
  dimensions: MaterialDimensions;
  materialTier: MaterialTier;
  costPaid: number;
  gridX: number;
  gridZ: number;
  gridY: number;
  offsetX: number;
  offsetZ: number;
  rotation: PieceRotation;
  footprintCells?: string[];
}

export class ActionHistory {
  private readonly undoStack: HistoryAction[] = [];
  private readonly redoStack: HistoryAction[] = [];
  private readonly maxSize = 50;

  record(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  pushUndo(action: HistoryAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  pushRedo(action: HistoryAction): void {
    this.redoStack.push(action);
  }

  popUndo(): HistoryAction | null {
    return this.undoStack.pop() ?? null;
  }

  popRedo(): HistoryAction | null {
    return this.redoStack.pop() ?? null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

export function snapshotFromPiece(piece: BuildingPiece): PieceSnapshot {
  return {
    id: piece.id,
    type: piece.type,
    dimensions: cloneDimensions(piece.dimensions),
    materialTier: piece.materialTier,
    costPaid: piece.costPaid,
    gridX: piece.gridX,
    gridZ: piece.gridZ,
    gridY: piece.gridY,
    offsetX: piece.offsetX ?? 0,
    offsetZ: piece.offsetZ ?? 0,
    rotation: cloneRotation(piece.rotation),
    footprintCells: piece.footprintCells ? [...piece.footprintCells] : undefined,
  };
}

export function positionFromPiece(piece: BuildingPiece): PiecePosition {
  return {
    gridX: piece.gridX,
    gridZ: piece.gridZ,
    gridY: piece.gridY,
    offsetX: piece.offsetX ?? 0,
    offsetZ: piece.offsetZ ?? 0,
  };
}
