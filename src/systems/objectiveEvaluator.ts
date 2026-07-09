import type { LevelObjective } from '@/config/levels';
import type { BuildingPiece } from '@/entities/BuildingPiece';

export interface ObjectiveResult {
  id: string;
  text: string;
  current: number;
  target: number;
  done: boolean;
  progressLabel: string;
}

function countPieces(pieces: BuildingPiece[], type?: BuildingPiece['type']): number {
  if (!type) {
    return pieces.length;
  }
  return pieces.filter((piece) => piece.type === type).length;
}

function maxStackHeight(pieces: BuildingPiece[]): number {
  if (pieces.length === 0) {
    return 0;
  }
  return Math.max(...pieces.map((piece) => piece.gridY)) + 1;
}

function maxEnclosureWalls(pieces: BuildingPiece[]): number {
  const floors = pieces.filter((piece) => piece.type === 'floor');
  let best = 0;

  for (const floor of floors) {
    const neighbors = [
      { gx: floor.gridX - 1, gz: floor.gridZ },
      { gx: floor.gridX + 1, gz: floor.gridZ },
      { gx: floor.gridX, gz: floor.gridZ - 1 },
      { gx: floor.gridX, gz: floor.gridZ + 1 },
    ];

    const wallsAround = neighbors.filter(({ gx, gz }) =>
      pieces.some(
        (piece) =>
          piece.type === 'wall' &&
          piece.gridX === gx &&
          piece.gridZ === gz &&
          piece.gridY === floor.gridY,
      ),
    ).length;

    best = Math.max(best, wallsAround);
  }

  return best;
}

export function evaluateObjectives(
  objectives: LevelObjective[],
  pieces: BuildingPiece[],
  budget: number,
  isBlockedCell: (gx: number, gz: number) => boolean = () => false,
): ObjectiveResult[] {
  return objectives.map((objective) => {
    switch (objective.kind) {
      case 'count': {
        const current = countPieces(pieces, objective.pieceType);
        const target = objective.count ?? 1;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target}`,
        };
      }
      case 'totalPieces': {
        const current = countPieces(pieces);
        const target = objective.count ?? 1;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target}`,
        };
      }
      case 'minHeight': {
        const current = maxStackHeight(pieces);
        const target = objective.minHeight ?? 2;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target} pisos`,
        };
      }
      case 'budgetMin': {
        const target = objective.minBudget ?? 0;
        return {
          id: objective.id,
          text: objective.text,
          current: budget,
          target,
          done: budget >= target,
          progressLabel: `${budget}/${target} 💰`,
        };
      }
      case 'enclosure': {
        const current = maxEnclosureWalls(pieces);
        const target = objective.count ?? 4;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target} muros`,
        };
      }
      case 'roadClear': {
        const violations = pieces.filter(
          (piece) => isBlockedCell(piece.gridX, piece.gridZ) && piece.gridY === 0,
        ).length;
        return {
          id: objective.id,
          text: objective.text,
          current: violations === 0 ? 1 : 0,
          target: 1,
          done: violations === 0,
          progressLabel: violations === 0 ? 'Libre' : `${violations} bloqueos`,
        };
      }
      case 'bridge': {
        const current = pieces.filter(
          (piece) =>
            piece.type === 'floor' &&
            piece.gridY >= 1 &&
            isBlockedCell(piece.gridX, piece.gridZ),
        ).length;
        const target = objective.count ?? 4;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target} tramos`,
        };
      }
      default:
        return {
          id: objective.id,
          text: objective.text,
          current: 0,
          target: 1,
          done: false,
          progressLabel: '0/1',
        };
    }
  });
}

export function computeStars(
  objectivesDone: boolean,
  budget: number,
  startBudget: number,
): number {
  if (!objectivesDone) {
    return 0;
  }
  if (budget >= startBudget * 0.45) {
    return 3;
  }
  if (budget >= startBudget * 0.2) {
    return 2;
  }
  return 1;
}
