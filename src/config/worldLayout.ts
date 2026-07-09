import { GRID_SIZE } from '@/config/gameConfig';

export type CellKey = `${number},${number}`;

export function cellKey(gx: number, gz: number): CellKey {
  return `${gx},${gz}`;
}

/** Carreteras y zonas bloqueadas por nivel. */
export function getBlockedCellsForLevel(levelId: number): Set<CellKey> {
  const blocked = new Set<CellKey>();

  switch (levelId) {
    case 1: {
      // Carretera de acceso en el borde sur
      for (let gx = 4; gx <= 15; gx += 1) {
        blocked.add(cellKey(gx, 2));
        blocked.add(cellKey(gx, 3));
      }
      break;
    }
    case 2: {
      // Avenida central este-oeste + ramal norte
      for (let gx = 0; gx < GRID_SIZE; gx += 1) {
        blocked.add(cellKey(gx, 9));
        blocked.add(cellKey(gx, 10));
      }
      for (let gz = 10; gz < GRID_SIZE; gz += 1) {
        blocked.add(cellKey(10, gz));
      }
      break;
    }
    case 3: {
      // Anillo vial alrededor del centro + cruce
      for (let gx = 6; gx <= 13; gx += 1) {
        blocked.add(cellKey(gx, 6));
        blocked.add(cellKey(gx, 13));
      }
      for (let gz = 7; gz <= 12; gz += 1) {
        blocked.add(cellKey(6, gz));
        blocked.add(cellKey(13, gz));
      }
      for (let gx = 0; gx < GRID_SIZE; gx += 1) {
        blocked.add(cellKey(gx, 9));
      }
      break;
    }
    default:
      break;
  }

  return blocked;
}

export function isRoadCell(levelId: number, gx: number, gz: number): boolean {
  return getBlockedCellsForLevel(levelId).has(cellKey(gx, gz));
}
