import { Color3, CreateLineSystem, MeshBuilder, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { LinesMesh, Mesh, Scene } from '@babylonjs/core';
import { CELL_SIZE, GRID_SIZE, MAX_STACK_LAYERS, POSITION_PRECISION, WORLD_HALF } from '@/config/gameConfig';
import { cellKey, getBlockedCellsForLevel, type CellKey } from '@/config/worldLayout';
import { useGameStore } from '@/store/gameStore';

export type CellHighlightState = 'hidden' | 'valid' | 'invalid';

export function roundPosition(value: number): number {
  const scale = 1 / POSITION_PRECISION;
  return Math.round(value * scale) / scale;
}

export class GridSystem {
  private gridLines: LinesMesh | null = null;
  private focusLines: LinesMesh | null = null;
  private cellHighlight: Mesh | null = null;
  private cellHighlightMat: StandardMaterial | null = null;
  private readonly roadMeshes: Mesh[] = [];
  private blockedCells = new Set<CellKey>();
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    this.createGridHelper();
    this.createBorder();
    this.createCellHighlight();
  }

  worldToGrid(x: number, z: number): { gx: number; gz: number } {
    return {
      gx: Math.floor((x + WORLD_HALF) / CELL_SIZE),
      gz: Math.floor((z + WORLD_HALF) / CELL_SIZE),
    };
  }

  gridToWorld(gx: number, gz: number): Vector3 {
    return new Vector3(
      (gx + 0.5) * CELL_SIZE - WORLD_HALF,
      0,
      (gz + 0.5) * CELL_SIZE - WORLD_HALF,
    );
  }

  pieceWorldPosition(
    gridX: number,
    gridZ: number,
    offsetX: number,
    offsetZ: number,
  ): { x: number; z: number } {
    const base = this.gridToWorld(gridX, gridZ);
    return {
      x: roundPosition(base.x + offsetX),
      z: roundPosition(base.z + offsetZ),
    };
  }

  worldToPieceAnchor(worldX: number, worldZ: number): {
    gridX: number;
    gridZ: number;
    offsetX: number;
    offsetZ: number;
  } {
    const gx = Math.floor((worldX + WORLD_HALF) / CELL_SIZE);
    const gz = Math.floor((worldZ + WORLD_HALF) / CELL_SIZE);
    const base = this.gridToWorld(gx, gz);
    return {
      gridX: gx,
      gridZ: gz,
      offsetX: roundPosition(worldX - base.x),
      offsetZ: roundPosition(worldZ - base.z),
    };
  }

  isWorldInBounds(worldX: number, worldZ: number): boolean {
    const half = (GRID_SIZE * CELL_SIZE) / 2;
    const margin = CELL_SIZE * 0.05;
    return (
      worldX >= -half + margin &&
      worldX <= half - margin &&
      worldZ >= -half + margin &&
      worldZ <= half - margin
    );
  }

  showPositionMarker(worldX: number, worldZ: number, state: CellHighlightState): void {
    if (!this.cellHighlight || !this.cellHighlightMat) {
      return;
    }

    if (state === 'hidden' || !this.isWorldInBounds(worldX, worldZ)) {
      this.cellHighlight.setEnabled(false);
      this.focusLines?.setEnabled(false);
      return;
    }

    this.cellHighlight.position.set(worldX, 0.045, worldZ);
    this.cellHighlight.scaling.set(0.22, 1, 0.22);
    this.cellHighlight.setEnabled(true);

    if (state === 'valid') {
      this.cellHighlightMat.diffuseColor = new Color3(0.35, 0.85, 0.45);
      this.cellHighlightMat.emissiveColor = new Color3(0.12, 0.35, 0.18);
      this.cellHighlightMat.alpha = 0.55;
    } else {
      this.cellHighlightMat.diffuseColor = new Color3(0.9, 0.35, 0.35);
      this.cellHighlightMat.emissiveColor = new Color3(0.35, 0.08, 0.08);
      this.cellHighlightMat.alpha = 0.5;
    }

    this.focusLines?.setEnabled(false);
  }

  isInBounds(gx: number, gz: number): boolean {
    return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
  }

  applyLevelLayout(levelId: number): void {
    this.clearRoadMeshes();
    this.blockedCells = getBlockedCellsForLevel(levelId);
    this.createRoadMeshes();
  }

  isBlockedForBuilding(gx: number, gz: number, gridY = 0): boolean {
    if (!this.blockedCells.has(cellKey(gx, gz))) {
      return false;
    }
    // Sobre carretera solo se puede construir elevado (puente).
    return gridY === 0;
  }

  isRoad(gx: number, gz: number): boolean {
    return this.blockedCells.has(cellKey(gx, gz));
  }

  getBlockedReason(gx: number, gz: number, gridY = 0): string | null {
    if (this.isBlockedForBuilding(gx, gz, gridY)) {
      return gridY === 0 ? 'carretera' : null;
    }
    return null;
  }

  isOccupied(gx: number, gz: number, gridY: number, excludeId?: string): boolean {
    const key = cellKey(gx, gz);
    return useGameStore.getState().pieces.some(
      (piece) => {
        if (piece.id === excludeId || piece.gridY !== gridY) {
          return false;
        }
        if (piece.footprintCells?.includes(key)) {
          return true;
        }
        return piece.gridX === gx && piece.gridZ === gz;
      },
    );
  }

  getTopLayer(gx: number, gz: number): number {
    const key = cellKey(gx, gz);
    const layers = useGameStore.getState().pieces
      .filter((piece) => {
        if (piece.footprintCells?.includes(key)) {
          return true;
        }
        return piece.gridX === gx && piece.gridZ === gz;
      })
      .map((piece) => piece.gridY);

    return layers.length === 0 ? -1 : Math.max(...layers);
  }

  hasSupport(gx: number, gz: number, gridY: number, excludeId?: string): boolean {
    if (gridY === 0) {
      return !this.isBlockedForBuilding(gx, gz, 0);
    }

    if (this.isOccupied(gx, gz, gridY - 1, excludeId)) {
      return true;
    }

    const neighbors: [number, number][] = [
      [gx - 1, gz],
      [gx + 1, gz],
      [gx, gz - 1],
      [gx, gz + 1],
    ];

    for (const [nx, nz] of neighbors) {
      if (!this.isInBounds(nx, nz)) {
        continue;
      }
      if (this.isOccupied(nx, nz, gridY, excludeId)) {
        return true;
      }
      if (
        this.isRoad(nx, nz) !== this.isRoad(gx, gz) &&
        this.isOccupied(nx, nz, gridY - 1, excludeId)
      ) {
        return true;
      }
    }

    return false;
  }

  canStackLayer(gridY: number): boolean {
    return gridY < MAX_STACK_LAYERS;
  }

  showCellHighlight(gx: number, gz: number, state: CellHighlightState): void {
    if (!this.cellHighlight || !this.cellHighlightMat) {
      return;
    }

    if (state === 'hidden' || !this.isInBounds(gx, gz)) {
      this.cellHighlight.setEnabled(false);
      this.focusLines?.setEnabled(false);
      return;
    }

    const center = this.gridToWorld(gx, gz);
    this.cellHighlight.position.set(center.x, 0.045, center.z);
    this.cellHighlight.scaling.set(1, 1, 1);
    this.cellHighlight.setEnabled(true);

    if (state === 'valid') {
      this.cellHighlightMat.diffuseColor = new Color3(0.35, 0.85, 0.45);
      this.cellHighlightMat.emissiveColor = new Color3(0.12, 0.35, 0.18);
      this.cellHighlightMat.alpha = 0.55;
    } else {
      this.cellHighlightMat.diffuseColor = new Color3(0.9, 0.35, 0.35);
      this.cellHighlightMat.emissiveColor = new Color3(0.35, 0.08, 0.08);
      this.cellHighlightMat.alpha = 0.5;
    }

    this.updateFocusGrid(gx, gz);
  }

  dispose(): void {
    this.clearRoadMeshes();
    this.gridLines?.dispose();
    this.gridLines = null;
    this.focusLines?.dispose();
    this.focusLines = null;
    this.cellHighlight?.dispose();
    this.cellHighlight = null;
    this.cellHighlightMat?.dispose();
    this.cellHighlightMat = null;
  }

  private createCellHighlight(): void {
    const pad = CELL_SIZE * 0.94;
    this.cellHighlight = MeshBuilder.CreateBox('cellHighlight', {
      width: pad,
      height: 0.02,
      depth: pad,
    }, this.scene);
    this.cellHighlight.isPickable = false;
    this.cellHighlight.setEnabled(false);

    this.cellHighlightMat = new StandardMaterial('cellHighlightMat', this.scene);
    this.cellHighlightMat.specularColor = Color3.Black();
    this.cellHighlightMat.alpha = 0.55;
    this.cellHighlight.material = this.cellHighlightMat;

    this.focusLines = CreateLineSystem('focusGrid', { lines: [] }, this.scene) as LinesMesh;
    this.focusLines.color = new Color3(0.45, 0.95, 0.55);
    this.focusLines.alpha = 0.95;
    this.focusLines.isPickable = false;
    this.focusLines.setEnabled(false);
  }

  private updateFocusGrid(gx: number, gz: number): void {
    if (!this.focusLines) {
      return;
    }

    const half = CELL_SIZE / 2;
    const center = this.gridToWorld(gx, gz);
    const y = 0.055;
    const x0 = center.x - half;
    const x1 = center.x + half;
    const z0 = center.z - half;
    const z1 = center.z + half;

    const lines: Vector3[][] = [
      [new Vector3(x0, y, z0), new Vector3(x1, y, z0)],
      [new Vector3(x1, y, z0), new Vector3(x1, y, z1)],
      [new Vector3(x1, y, z1), new Vector3(x0, y, z1)],
      [new Vector3(x0, y, z1), new Vector3(x0, y, z0)],
      [new Vector3(center.x, y, z0), new Vector3(center.x, y, z1)],
      [new Vector3(x0, y, center.z), new Vector3(x1, y, center.z)],
    ];

    this.focusLines.dispose();
    this.focusLines = CreateLineSystem('focusGrid', { lines }, this.scene) as LinesMesh;
    this.focusLines.color = new Color3(0.45, 0.95, 0.55);
    this.focusLines.alpha = 0.95;
    this.focusLines.isPickable = false;
    this.focusLines.setEnabled(true);
  }

  private createGridHelper(): void {
    const worldSize = GRID_SIZE * CELL_SIZE;
    const half = worldSize / 2;
    const y = 0.04;
    const lines: Vector3[][] = [];

    for (let i = 0; i <= GRID_SIZE; i += 1) {
      const offset = i * CELL_SIZE - half;
      lines.push(
        [new Vector3(offset, y, -half), new Vector3(offset, y, half)],
        [new Vector3(-half, y, offset), new Vector3(half, y, offset)],
      );
    }

    this.gridLines = CreateLineSystem('grid', { lines }, this.scene) as LinesMesh;
    this.gridLines.color = new Color3(0.22, 0.32, 0.2);
    this.gridLines.alpha = 0.45;
    this.gridLines.isPickable = false;
  }

  private createBorder(): void {
    const worldSize = GRID_SIZE * CELL_SIZE;
    const half = worldSize / 2;
    const edge = 0.12;
    const h = 0.03;

    const edges = [
      { w: worldSize, d: edge, x: 0, z: half - edge / 2 },
      { w: worldSize, d: edge, x: 0, z: -half + edge / 2 },
      { w: edge, d: worldSize, x: half - edge / 2, z: 0 },
      { w: edge, d: worldSize, x: -half + edge / 2, z: 0 },
    ];

    const borderMat = new StandardMaterial('borderMat', this.scene);
    borderMat.diffuseColor = new Color3(0.38, 0.55, 0.32);
    borderMat.specularColor = new Color3(0.05, 0.06, 0.04);

    for (const [index, spec] of edges.entries()) {
      const strip = MeshBuilder.CreateBox(`gridEdge-${index}`, {
        width: spec.w,
        height: h,
        depth: spec.d,
      }, this.scene);
      strip.position.set(spec.x, h / 2, spec.z);
      strip.material = borderMat;
      strip.isPickable = false;
      strip.receiveShadows = true;
    }
  }

  private clearRoadMeshes(): void {
    for (const mesh of this.roadMeshes) {
      mesh.dispose();
    }
    this.roadMeshes.length = 0;
    this.blockedCells.clear();
  }

  private createRoadMeshes(): void {
    const asphalt = new StandardMaterial('roadMat', this.scene);
    asphalt.diffuseColor = new Color3(0.28, 0.3, 0.34);
    asphalt.specularColor = new Color3(0.08, 0.08, 0.1);
    asphalt.emissiveColor = new Color3(0.03, 0.03, 0.04);

    const lineMat = new StandardMaterial('roadLineMat', this.scene);
    lineMat.diffuseColor = new Color3(0.92, 0.78, 0.2);
    lineMat.emissiveColor = new Color3(0.15, 0.12, 0.02);

    for (const key of this.blockedCells) {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      const center = this.gridToWorld(gx, gz);

      const slab = MeshBuilder.CreateBox(`road-${key}`, {
        width: CELL_SIZE * 0.96,
        height: 0.06,
        depth: CELL_SIZE * 0.96,
      }, this.scene);
      slab.position.set(center.x, 0.055, center.z);
      slab.material = asphalt;
      slab.isPickable = false;
      slab.receiveShadows = true;
      this.roadMeshes.push(slab);

      const stripe = MeshBuilder.CreateBox(`roadLine-${key}`, {
        width: CELL_SIZE * 0.12,
        height: 0.065,
        depth: CELL_SIZE * 0.55,
      }, this.scene);
      stripe.position.set(center.x, 0.062, center.z);
      stripe.material = lineMat;
      stripe.isPickable = false;
      this.roadMeshes.push(stripe);
    }
  }
}
