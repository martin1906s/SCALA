import { CELL_SIZE, WORLD_HALF } from '@/config/gameConfig';
import { cellKey, type CellKey } from '@/config/worldLayout';
import type { BuildingPiece, PieceType } from '@/entities/BuildingPiece';
import {
  getHorizontalExtents,
  type MaterialDimensions,
} from '@/domain/materials/MaterialDimensions';

export interface FootprintInput {
  gridX: number;
  gridZ: number;
  gridY: number;
  type: PieceType;
  dimensions: MaterialDimensions;
  rotationY: number;
  offsetX?: number;
  offsetZ?: number;
}

function worldCenterFromAnchor(
  gridX: number,
  gridZ: number,
  offsetX: number,
  offsetZ: number,
): { x: number; z: number } {
  return {
    x: (gridX + 0.5) * CELL_SIZE - WORLD_HALF + offsetX,
    z: (gridZ + 0.5) * CELL_SIZE - WORLD_HALF + offsetZ,
  };
}

function cellCenter(gx: number, gz: number): { x: number; z: number } {
  return {
    x: (gx + 0.5) * CELL_SIZE - WORLD_HALF,
    z: (gz + 0.5) * CELL_SIZE - WORLD_HALF,
  };
}

function pointInRotatedRect(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  cosR: number,
  sinR: number,
): boolean {
  const dx = px - cx;
  const dz = pz - cz;
  const localX = dx * cosR + dz * sinR;
  const localZ = -dx * sinR + dz * cosR;
  return Math.abs(localX) <= halfW + 0.001 && Math.abs(localZ) <= halfD + 0.001;
}

export function getOccupiedCells(input: FootprintInput): CellKey[] {
  const { widthX, depthZ } = getHorizontalExtents(
    input.type,
    input.dimensions,
    input.rotationY,
  );
  const halfW = widthX / 2;
  const halfD = depthZ / 2;
  const cosR = Math.cos(input.rotationY);
  const sinR = Math.sin(input.rotationY);

  const center = worldCenterFromAnchor(
    input.gridX,
    input.gridZ,
    input.offsetX ?? 0,
    input.offsetZ ?? 0,
  );

  const margin = CELL_SIZE;
  const minGx = Math.floor((center.x - halfW - margin + WORLD_HALF) / CELL_SIZE);
  const maxGx = Math.floor((center.x + halfW + margin + WORLD_HALF) / CELL_SIZE);
  const minGz = Math.floor((center.z - halfD - margin + WORLD_HALF) / CELL_SIZE);
  const maxGz = Math.floor((center.z + halfD + margin + WORLD_HALF) / CELL_SIZE);

  const cells: CellKey[] = [];
  for (let gx = minGx; gx <= maxGx; gx += 1) {
    for (let gz = minGz; gz <= maxGz; gz += 1) {
      const cc = cellCenter(gx, gz);
      if (pointInRotatedRect(cc.x, cc.z, center.x, center.z, halfW, halfD, cosR, sinR)) {
        cells.push(cellKey(gx, gz));
      }
    }
  }
  return cells;
}

export function getFootprintFromPiece(piece: BuildingPiece): CellKey[] {
  return getOccupiedCells({
    gridX: piece.gridX,
    gridZ: piece.gridZ,
    gridY: piece.gridY,
    type: piece.type,
    dimensions: piece.dimensions,
    rotationY: piece.rotation.y,
    offsetX: piece.offsetX,
    offsetZ: piece.offsetZ,
  });
}

export function pieceContainsCell(piece: BuildingPiece, gx: number, gz: number): boolean {
  const cells = getFootprintFromPiece(piece);
  const key = cellKey(gx, gz);
  return cells.includes(key);
}

export function getFootprintCellCount(input: FootprintInput): number {
  return getOccupiedCells(input).length;
}
