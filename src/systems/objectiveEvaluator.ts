import type { LevelObjective } from '@/config/levels';
import type { BuildingPiece } from '@/entities/BuildingPiece';
import { getVisibleArea } from '@/config/materialCatalog';
import { getFootprintFromPiece } from '@/domain/structures/Footprint';

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

function pieceTouchesRoad(piece: BuildingPiece, isBlockedCell: (gx: number, gz: number) => boolean): boolean {
  const cells = piece.footprintCells ?? getFootprintFromPiece(piece);
  return cells.some((key) => {
    const [gx, gz] = key.split(',').map(Number) as [number, number];
    return isBlockedCell(gx, gz);
  });
}

function totalFloorArea(pieces: BuildingPiece[]): number {
  return pieces
    .filter((p) => p.type === 'floor' || p.type === 'roof')
    .reduce((sum, p) => sum + getVisibleArea(p.type, p.dimensions), 0);
}

function maxBridgeSpan(pieces: BuildingPiece[], isBlockedCell: (gx: number, gz: number) => boolean): number {
  let best = 0;
  for (const piece of pieces) {
    if (piece.type !== 'floor' || piece.gridY < 1) {
      continue;
    }
    const cells = piece.footprintCells ?? getFootprintFromPiece(piece);
    const roadCells = cells.filter((key) => {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      return isBlockedCell(gx, gz);
    });
    if (roadCells.length > 0) {
      best = Math.max(best, roadCells.length);
    }
  }
  return best;
}

function maxEnclosureWalls(pieces: BuildingPiece[]): number {
  const floors = pieces.filter((piece) => piece.type === 'floor');
  let best = 0;

  for (const floor of floors) {
    const footprint = floor.footprintCells ?? getFootprintFromPiece(floor);
    let wallsAround = 0;
    for (const key of footprint) {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      const neighbors = [
        { gx: gx - 1, gz },
        { gx: gx + 1, gz },
        { gx, gz: gz - 1 },
        { gx, gz: gz + 1 },
      ];
      for (const { gx: nx, gz: nz } of neighbors) {
        if (pieces.some(
          (piece) =>
            piece.type === 'wall' &&
            piece.gridY === floor.gridY &&
            (piece.footprintCells?.includes(`${nx},${nz}`)
              || (piece.gridX === nx && piece.gridZ === nz)),
        )) {
          wallsAround += 1;
        }
      }
    }
    best = Math.max(best, Math.min(4, wallsAround));
  }

  return best;
}

export function evaluateObjectives(
  objectives: LevelObjective[],
  pieces: BuildingPiece[],
  budget: number,
  isBlockedCell: (gx: number, gz: number) => boolean = () => false,
  startBudget = 1000,
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
      case 'budgetEfficiency': {
        const minPct = objective.minBudget ?? 20;
        const currentPct = startBudget > 0 ? Math.round((budget / startBudget) * 100) : 0;
        return {
          id: objective.id,
          text: objective.text,
          current: currentPct,
          target: minPct,
          done: currentPct >= minPct,
          progressLabel: `${currentPct}% restante`,
        };
      }
      case 'minArea': {
        const current = Math.floor(totalFloorArea(pieces));
        const target = objective.count ?? 4;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target} m²`,
        };
      }
      case 'minSpan': {
        const current = maxBridgeSpan(pieces, isBlockedCell);
        const target = objective.count ?? 4;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target} celdas`,
        };
      }
      case 'tierCount': {
        const minTier = objective.pieceType === 'pillar' ? 'stone' : 'stone';
        const tiers = { wood: 0, stone: 1, marble: 2 };
        const current = pieces.filter(
          (p) => tiers[p.materialTier] >= tiers[minTier as keyof typeof tiers],
        ).length;
        const target = objective.count ?? 2;
        return {
          id: objective.id,
          text: objective.text,
          current,
          target,
          done: current >= target,
          progressLabel: `${Math.min(current, target)}/${target}`,
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
          (piece) => piece.gridY === 0 && pieceTouchesRoad(piece, isBlockedCell),
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
        const current = maxBridgeSpan(pieces, isBlockedCell);
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
