import {
  Axis,
  Color3,
  HighlightLayer,
  Mesh,
  MeshBuilder,
  Space,
  StandardMaterial,
} from '@babylonjs/core';
import type { AbstractMesh, Scene, ShadowGenerator } from '@babylonjs/core';
import {
  LAYER_STEP,
  PIECE_COSTS,
  PIECE_DIMS,
  CELL_SIZE,
} from '@/config/gameConfig';
import type {
  BuildingPiece,
  PieceRotation,
  PieceType,
} from '@/entities/BuildingPiece';
import { cloneRotation, pieceId, readMeshRotation, applyMeshRotation } from '@/entities/BuildingPiece';
import { ROTATION_STEP, useGameStore } from '@/store/gameStore';
import type { EconomySystem } from '@/systems/EconomySystem';
import type { GridSystem } from '@/systems/GridSystem';
import { createPieceMaterial } from '@/utils/materialFactory';
import {
  ActionHistory,
  positionFromPiece,
  snapshotFromPiece,
  type HistoryAction,
  type PieceSnapshot,
} from '@/systems/ActionHistory';

interface SourceMeshEntry {
  source: Mesh;
  material: StandardMaterial;
}

export class BuildingSystem {
  private readonly sources = new Map<PieceType, SourceMeshEntry>();
  private readonly pieceMap = new Map<string, BuildingPiece>();
  private previewMesh: AbstractMesh | null = null;
  private previewMaterial: StandardMaterial | null = null;
  private readonly highlightLayer: HighlightLayer;
  private readonly highlightedMeshes = new Set<AbstractMesh>();
  private readonly emissiveBackup = new Map<string, Color3>();
  private readonly scene: Scene;
  private readonly gridSystem: GridSystem;
  private readonly economySystem: EconomySystem;
  private readonly shadowGenerator: ShadowGenerator | null;
  private readonly history = new ActionHistory();
  private readonly historyListeners = new Set<() => void>();

  constructor(scene: Scene, gridSystem: GridSystem, economySystem: EconomySystem) {
    this.scene = scene;
    this.gridSystem = gridSystem;
    this.economySystem = economySystem;
    this.shadowGenerator = (scene.metadata?.shadowGenerator as ShadowGenerator | undefined) ?? null;
    this.highlightLayer = new HighlightLayer('highlights', scene, {
      blurHorizontalSize: 1.2,
      blurVerticalSize: 1.2,
    });
    this.highlightLayer.innerGlow = false;
    this.highlightLayer.outerGlow = true;
    this.createSourceMeshes();
    this.createPreviewMesh();
  }

  onHistoryChange(listener: () => void): () => void {
    this.historyListeners.add(listener);
    return () => this.historyListeners.delete(listener);
  }

  private notifyHistoryChange(): void {
    useGameStore.getState().setHistoryAvailability(
      this.history.canUndo(),
      this.history.canRedo(),
    );
    for (const listener of this.historyListeners) {
      listener();
    }
  }

  private recordHistory(action: HistoryAction): void {
    this.history.record(action);
    this.notifyHistoryChange();
  }

  isBuildingMesh(mesh: AbstractMesh): boolean {
    for (const piece of this.pieceMap.values()) {
      if (piece.mesh === mesh) {
        return true;
      }
    }
    return false;
  }

  getPieceByMesh(mesh: AbstractMesh): BuildingPiece | null {
    const metaId = (mesh.metadata as { buildingPieceId?: string } | undefined)?.buildingPieceId;
    if (metaId) {
      const byMeta = this.pieceMap.get(metaId);
      if (byMeta) {
        return byMeta;
      }
    }

    for (const piece of this.pieceMap.values()) {
      if (piece.mesh === mesh) {
        return piece;
      }
    }
    return null;
  }

  getPieceById(id: string): BuildingPiece | null {
    return this.pieceMap.get(id) ?? null;
  }

  /** Selección por proximidad cuando el raycast falla (p. ej. InstancedMesh). */
  getPieceNearWorldPoint(worldX: number, worldZ: number, maxDistance = CELL_SIZE * 0.6): BuildingPiece | null {
    let best: BuildingPiece | null = null;
    let bestDistSq = maxDistance * maxDistance;

    for (const piece of this.pieceMap.values()) {
      const pos = this.getPieceWorldPosition(piece);
      const dx = pos.x - worldX;
      const dz = pos.z - worldZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = piece;
      }
    }

    return best;
  }

  getPieces(): BuildingPiece[] {
    return [...this.pieceMap.values()];
  }

  /** Pieza bajo el puntero: celda exacta, vecindad y proximidad en mundo. */
  getTopPieceAtWorld(worldX: number, worldZ: number): BuildingPiece | null {
    const pieces = useGameStore.getState().pieces;
    if (pieces.length === 0) {
      return null;
    }

    const { gx, gz } = this.gridSystem.worldToGrid(worldX, worldZ);

    let top: BuildingPiece | null = null;
    for (const piece of pieces) {
      if (piece.gridX === gx && piece.gridZ === gz) {
        if (!top || piece.gridY > top.gridY) {
          top = piece;
        }
      }
    }
    if (top) {
      return top;
    }

    for (const piece of pieces) {
      if (Math.abs(piece.gridX - gx) <= 1 && Math.abs(piece.gridZ - gz) <= 1) {
        if (!top || piece.gridY > top.gridY) {
          top = piece;
        }
      }
    }
    if (top) {
      return top;
    }

    return this.getPieceNearWorldPoint(worldX, worldZ, CELL_SIZE * 0.9);
  }

  private createPlacedMesh(type: PieceType, name: string): Mesh {
    const source = this.sources.get(type);
    if (!source) {
      throw new Error(`Missing source mesh for ${type}`);
    }

    const mesh = source.source.clone(name, null)!;
    mesh.isVisible = true;
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    mesh.material = source.material.clone(`${name}Mat`);
    mesh.parent = null;
    mesh.setEnabled(true);
    mesh.refreshBoundingInfo();
    mesh.computeWorldMatrix(true);
    return mesh;
  }

  private addHighlight(mesh: AbstractMesh, color: Color3): void {
    this.highlightLayer.addMesh(mesh as Mesh, color);
    this.highlightedMeshes.add(mesh);
  }

  updateHighlights(
    hoverId: string | null,
    selectedId: string | null,
    hoverColor = Color3.FromHexString('#5BC8FF'),
  ): void {
    for (const mesh of this.highlightedMeshes) {
      this.highlightLayer.removeMesh(mesh as Mesh);
    }
    this.highlightedMeshes.clear();

    for (const [pieceId, color] of this.emissiveBackup) {
      const piece = this.pieceMap.get(pieceId);
      const mat = piece?.mesh.material as StandardMaterial | null;
      if (mat) {
        mat.emissiveColor = color;
      }
    }
    this.emissiveBackup.clear();

    const applyEmissive = (pieceId: string, boost: Color3): void => {
      const piece = this.pieceMap.get(pieceId);
      if (!piece) {
        return;
      }
      const mat = piece.mesh.material as StandardMaterial | null;
      if (!mat) {
        return;
      }
      if (!this.emissiveBackup.has(pieceId)) {
        this.emissiveBackup.set(pieceId, mat.emissiveColor.clone());
      }
      mat.emissiveColor = Color3.Lerp(mat.emissiveColor, boost, 0.85);
    };

    if (hoverId && hoverId !== selectedId) {
      const hoverPiece = this.pieceMap.get(hoverId);
      if (hoverPiece) {
        this.addHighlight(hoverPiece.mesh, hoverColor);
        applyEmissive(hoverId, hoverColor);
      }
    }

    if (selectedId) {
      const selectedPiece = this.pieceMap.get(selectedId);
      if (selectedPiece) {
        const selectColor = Color3.FromHexString('#FFD54F');
        this.addHighlight(selectedPiece.mesh, selectColor);
        applyEmissive(selectedId, selectColor);
      }
    }
  }

  canPlace(
    type: PieceType,
    gx: number,
    gz: number,
    gridY: number,
    excludeId?: string,
  ): boolean {
    if (!this.gridSystem.isInBounds(gx, gz)) {
      return false;
    }
    if (this.gridSystem.isBlockedForBuilding(gx, gz, gridY)) {
      return false;
    }
    if (!this.gridSystem.canStackLayer(gridY)) {
      return false;
    }
    if (this.gridSystem.isOccupied(gx, gz, gridY, excludeId)) {
      return false;
    }
    if (!this.gridSystem.hasSupport(gx, gz, gridY, excludeId)) {
      return false;
    }
    if (!excludeId && !this.economySystem.canAfford(PIECE_COSTS[type])) {
      return false;
    }
    return true;
  }

  getPlaceFailureReason(
    type: PieceType,
    gx: number,
    gz: number,
    gridY: number,
    excludeId?: string,
  ): string | null {
    if (!this.gridSystem.isInBounds(gx, gz)) {
      return 'Fuera del terreno de construcción.';
    }
    if (this.gridSystem.isBlockedForBuilding(gx, gz, gridY)) {
      return 'No puedes construir sobre la carretera a nivel del suelo.';
    }
    if (!this.gridSystem.canStackLayer(gridY)) {
      return 'Has alcanzado el límite de altura.';
    }
    if (this.gridSystem.isOccupied(gx, gz, gridY, excludeId)) {
      return 'Esa celda ya está ocupada.';
    }
    if (!this.gridSystem.hasSupport(gx, gz, gridY, excludeId)) {
      return this.gridSystem.isRoad(gx, gz) && gridY >= 1
        ? 'El puente necesita apoyo desde los lados o desde abajo.'
        : 'La pieza necesita soporte debajo.';
    }
    if (!excludeId && !this.economySystem.canAfford(PIECE_COSTS[type])) {
      return 'No tienes presupuesto suficiente.';
    }
    return null;
  }

  movePiece(id: string, deltaX: number, deltaZ: number): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    const current = this.gridSystem.pieceWorldPosition(
      piece.gridX,
      piece.gridZ,
      piece.offsetX,
      piece.offsetZ,
    );
    return this.movePieceToWorld(id, current.x + deltaX, current.z + deltaZ);
  }

  getPieceWorldPosition(piece: BuildingPiece): { x: number; z: number } {
    return this.gridSystem.pieceWorldPosition(
      piece.gridX,
      piece.gridZ,
      piece.offsetX,
      piece.offsetZ,
    );
  }

  realignPiece(id: string): void {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return;
    }
    this.applyTransform(
      piece.type,
      piece.mesh,
      piece.gridX,
      piece.gridZ,
      piece.gridY,
      piece.rotation,
      piece.offsetX,
      piece.offsetZ,
    );
  }

  movePieceToWorld(id: string, worldX: number, worldZ: number, skipHistory = false): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    const roundedX = Math.round(worldX * 1000) / 1000;
    const roundedZ = Math.round(worldZ * 1000) / 1000;

    if (!this.gridSystem.isWorldInBounds(roundedX, roundedZ)) {
      return false;
    }

    const current = this.getPieceWorldPosition(piece);
    if (current.x === roundedX && current.z === roundedZ) {
      return false;
    }

    const anchor = this.gridSystem.worldToPieceAnchor(roundedX, roundedZ);
    if (this.gridSystem.isBlockedForBuilding(anchor.gridX, anchor.gridZ, piece.gridY)) {
      return false;
    }

    const before = positionFromPiece(piece);
    piece.gridX = anchor.gridX;
    piece.gridZ = anchor.gridZ;
    piece.offsetX = anchor.offsetX;
    piece.offsetZ = anchor.offsetZ;

    this.applyTransform(
      piece.type,
      piece.mesh,
      piece.gridX,
      piece.gridZ,
      piece.gridY,
      piece.rotation,
      piece.offsetX,
      piece.offsetZ,
    );

    useGameStore.getState().updatePiece(id, {
      gridX: piece.gridX,
      gridZ: piece.gridZ,
      offsetX: piece.offsetX,
      offsetZ: piece.offsetZ,
    });

    if (!skipHistory) {
      this.recordHistory({
        kind: 'move',
        pieceId: id,
        before,
        after: positionFromPiece(piece),
      });
    }
    return true;
  }

  previewPieceWorldPosition(id: string, worldX: number, worldZ: number): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    const roundedX = Math.round(worldX * 1000) / 1000;
    const roundedZ = Math.round(worldZ * 1000) / 1000;
    if (!this.gridSystem.isWorldInBounds(roundedX, roundedZ)) {
      return false;
    }

    const anchor = this.gridSystem.worldToPieceAnchor(roundedX, roundedZ);
    this.applyTransform(
      piece.type,
      piece.mesh,
      anchor.gridX,
      anchor.gridZ,
      piece.gridY,
      piece.rotation,
      anchor.offsetX,
      anchor.offsetZ,
    );
    return true;
  }

  placePiece(type: PieceType, gx: number, gz: number, gridY: number): boolean {
    if (!this.canPlace(type, gx, gz, gridY)) {
      return false;
    }

    const source = this.sources.get(type);
    if (!source) {
      return false;
    }

    const rotation = cloneRotation(useGameStore.getState().previewRotation);
    const mesh = this.createPlacedMesh(type, `${type}-${gx}-${gz}-${gridY}`);

    this.applyTransform(type, mesh, gx, gz, gridY, rotation);
    this.registerShadowCaster(mesh);

    if (!this.economySystem.spend(PIECE_COSTS[type])) {
      mesh.dispose();
      return false;
    }

    const id = pieceId(gx, gz, gridY);
    const piece: BuildingPiece = {
      id,
      type,
      gridX: gx,
      gridZ: gz,
      gridY,
      offsetX: 0,
      offsetZ: 0,
      rotation,
      mesh,
    };

    this.tagMesh(mesh, id);
    this.pieceMap.set(id, piece);
    this.recordHistory({ kind: 'place', pieceId: id });
    useGameStore.getState().addPiece(piece);
    this.playPlaceBounce(mesh);
    return true;
  }

  duplicatePiece(id: string): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    const offsets = [
      { dgx: 1, dgz: 0 },
      { dgx: -1, dgz: 0 },
      { dgx: 0, dgz: 1 },
      { dgx: 0, dgz: -1 },
    ];

    for (const { dgx, dgz } of offsets) {
      const gx = piece.gridX + dgx;
      const gz = piece.gridZ + dgz;
      if (!this.canPlace(piece.type, gx, gz, piece.gridY)) {
        continue;
      }

      useGameStore.getState().setPreviewRotation(cloneRotation(piece.rotation));
      if (this.placePiece(piece.type, gx, gz, piece.gridY)) {
        return true;
      }
    }

    return false;
  }

  sellPiece(id: string): boolean {
    return this.removePieceById(id);
  }

  undoLastAction(): boolean {
    const action = this.history.popUndo();
    if (!action) {
      return false;
    }

    const ok = this.applyUndo(action);
    if (!ok) {
      this.history.pushUndo(action);
      return false;
    }

    this.notifyHistoryChange();
    return true;
  }

  redoLastAction(): boolean {
    const action = this.history.popRedo();
    if (!action) {
      return false;
    }

    const ok = this.applyRedo(action);
    if (!ok) {
      this.history.pushRedo(action);
      return false;
    }

    this.notifyHistoryChange();
    return true;
  }

  private applyUndo(action: HistoryAction): boolean {
    switch (action.kind) {
      case 'place': {
        const piece = this.pieceMap.get(action.pieceId);
        if (!piece) {
          return false;
        }
        const snapshot = snapshotFromPiece(piece);
        if (!this.removePieceById(action.pieceId, true)) {
          return false;
        }
        this.history.pushRedo({ kind: 'restore', snapshot });
        return true;
      }
      case 'delete': {
        if (!this.restoreFromSnapshot(action.snapshot, true)) {
          return false;
        }
        this.history.pushRedo({ kind: 'delete', snapshot: action.snapshot });
        return true;
      }
      case 'move': {
        const piece = this.pieceMap.get(action.pieceId);
        if (!piece) {
          return false;
        }
        const world = this.gridSystem.pieceWorldPosition(
          action.before.gridX,
          action.before.gridZ,
          action.before.offsetX,
          action.before.offsetZ,
        );
        if (!this.movePieceToWorld(action.pieceId, world.x, world.z, true)) {
          return false;
        }
        this.history.pushRedo({
          kind: 'move',
          pieceId: action.pieceId,
          before: action.before,
          after: action.after,
        });
        return true;
      }
      default:
        return false;
    }
  }

  private applyRedo(action: HistoryAction): boolean {
    switch (action.kind) {
      case 'restore': {
        if (!this.restoreFromSnapshot(action.snapshot, true)) {
          return false;
        }
        this.history.pushUndo({ kind: 'place', pieceId: action.snapshot.id });
        return true;
      }
      case 'delete': {
        if (!this.removePieceById(action.snapshot.id, true)) {
          return false;
        }
        this.history.pushUndo({ kind: 'delete', snapshot: action.snapshot });
        return true;
      }
      case 'move': {
        const piece = this.pieceMap.get(action.pieceId);
        if (!piece) {
          return false;
        }
        const world = this.gridSystem.pieceWorldPosition(
          action.after.gridX,
          action.after.gridZ,
          action.after.offsetX,
          action.after.offsetZ,
        );
        if (!this.movePieceToWorld(action.pieceId, world.x, world.z, true)) {
          return false;
        }
        this.history.pushUndo({
          kind: 'move',
          pieceId: action.pieceId,
          before: action.before,
          after: action.after,
        });
        return true;
      }
      default:
        return false;
    }
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  private restoreFromSnapshot(snapshot: PieceSnapshot, skipHistory = false): boolean {
    if (!this.canPlace(snapshot.type, snapshot.gridX, snapshot.gridZ, snapshot.gridY)) {
      return false;
    }

    const source = this.sources.get(snapshot.type);
    if (!source) {
      return false;
    }

    if (!this.economySystem.spend(PIECE_COSTS[snapshot.type])) {
      return false;
    }

    const mesh = this.createPlacedMesh(snapshot.type, snapshot.id);
    this.applyTransform(
      snapshot.type,
      mesh,
      snapshot.gridX,
      snapshot.gridZ,
      snapshot.gridY,
      snapshot.rotation,
      snapshot.offsetX,
      snapshot.offsetZ,
    );
    this.registerShadowCaster(mesh);
    this.tagMesh(mesh, snapshot.id);

    const piece: BuildingPiece = {
      id: snapshot.id,
      type: snapshot.type,
      gridX: snapshot.gridX,
      gridZ: snapshot.gridZ,
      gridY: snapshot.gridY,
      offsetX: snapshot.offsetX,
      offsetZ: snapshot.offsetZ,
      rotation: cloneRotation(snapshot.rotation),
      mesh,
    };

    this.pieceMap.set(snapshot.id, piece);
    useGameStore.getState().addPiece(piece);
    if (!skipHistory) {
      this.recordHistory({ kind: 'place', pieceId: snapshot.id });
    }
    return true;
  }

  private tagMesh(mesh: AbstractMesh, pieceIdValue: string): void {
    mesh.metadata = { buildingPieceId: pieceIdValue };
  }

  clearAllPieces(): void {
    for (const piece of this.pieceMap.values()) {
      this.highlightLayer.removeMesh(piece.mesh as Mesh);
      piece.customMaterial?.dispose();
      piece.mesh.dispose();
    }
    this.pieceMap.clear();
    this.highlightedMeshes.clear();
    this.emissiveBackup.clear();
    this.history.clear();
    this.hidePreview();
    this.notifyHistoryChange();
  }

  private playPlaceBounce(mesh: AbstractMesh): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const baseY = mesh.position.y;
    const start = performance.now();
    const duration = 380;

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) {
        mesh.position.y = baseY;
        mesh.scaling.setAll(1);
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }

      const bounce = Math.sin(t * Math.PI) * 0.14 * (1 - t);
      const squash = 1 + Math.sin(t * Math.PI) * 0.06;
      mesh.position.y = baseY + bounce;
      mesh.scaling.set(squash, 1 / squash, squash);
    });
  }

  rotatePiece(id: string, axis: keyof PieceRotation, direction: 1 | -1 = 1): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    const step = ROTATION_STEP * direction;
    const mesh = piece.mesh;

    switch (axis) {
      case 'x':
        mesh.rotate(Axis.X, step, Space.LOCAL);
        break;
      case 'y':
        mesh.rotate(Axis.Y, step, Space.LOCAL);
        break;
      case 'z':
        mesh.rotate(Axis.Z, step, Space.LOCAL);
        break;
    }

    const rotation: PieceRotation = readMeshRotation(mesh);

    piece.rotation = rotation;
    useGameStore.getState().updatePiece(id, { rotation });
    return true;
  }

  replacePieceType(id: string, newType: PieceType): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece || piece.type === newType) {
      return false;
    }

    const source = this.sources.get(newType);
    if (!source) {
      return false;
    }

    const oldMesh = piece.mesh;
    const position = oldMesh.position.clone();
    const rotation = readMeshRotation(oldMesh);
    const customColor = piece.customColor;

    piece.customMaterial?.dispose();
    oldMesh.dispose();

    if (customColor) {
      const cloned = source.source.clone(`typed-${id}`)!;
      cloned.isVisible = true;
      cloned.isPickable = true;
      cloned.position = position;
      applyMeshRotation(cloned, rotation);

      const material = new StandardMaterial(`typeMat-${id}`, this.scene);
      material.diffuseColor = new Color3(customColor.r, customColor.g, customColor.b);
      material.specularColor = new Color3(0.08, 0.08, 0.08);
      material.emissiveColor = new Color3(
        customColor.r * 0.06,
        customColor.g * 0.06,
        customColor.b * 0.06,
      );
      cloned.material = material;
      this.registerShadowCaster(cloned);

      piece.mesh = cloned;
      piece.customMaterial = material;
    } else {
      const mesh = this.createPlacedMesh(newType, `inst-${id}`);
      mesh.position = position;
      applyMeshRotation(mesh, rotation);
      this.registerShadowCaster(mesh);
      piece.mesh = mesh;
      piece.customMaterial = undefined;
    }

    piece.type = newType;
    this.tagMesh(piece.mesh, id);
    useGameStore.getState().updatePiece(id, {
      type: newType,
      mesh: piece.mesh,
      customMaterial: piece.customMaterial,
    });

    return true;
  }

  removePieceById(id: string, skipHistory = false): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    if (!skipHistory) {
      this.recordHistory({ kind: 'delete', snapshot: snapshotFromPiece(piece) });
    }

    this.highlightLayer.removeMesh(piece.mesh as Mesh);
    this.highlightedMeshes.delete(piece.mesh);

    this.economySystem.refund(PIECE_COSTS[piece.type]);
    piece.customMaterial?.dispose();
    piece.mesh.dispose();
    this.pieceMap.delete(id);
    useGameStore.getState().removePiece(id);
    return true;
  }

  updatePreview(type: PieceType, gx: number, gz: number, gridY: number): void {
    if (!this.previewMesh) {
      return;
    }

    if (!this.gridSystem.isInBounds(gx, gz)) {
      this.previewMesh.setEnabled(false);
      return;
    }

    const canPlace = this.canPlace(type, gx, gz, gridY);
    const rotation = useGameStore.getState().previewRotation;

    this.previewMesh.setEnabled(true);
    this.applyPreviewTransform(type, this.previewMesh, gx, gz, gridY, rotation);

    if (this.previewMaterial) {
      this.previewMaterial.diffuseColor = canPlace
        ? new Color3(0.45, 0.9, 0.55)
        : new Color3(0.95, 0.35, 0.35);
    }
  }

  hidePreview(): void {
    this.previewMesh?.setEnabled(false);
  }

  dispose(): void {
    for (const mesh of this.highlightedMeshes) {
      this.highlightLayer.removeMesh(mesh as Mesh);
    }
    this.highlightedMeshes.clear();
    this.highlightLayer.dispose();

    for (const piece of this.pieceMap.values()) {
      piece.customMaterial?.dispose();
      piece.mesh.dispose();
    }
    this.pieceMap.clear();

    for (const entry of this.sources.values()) {
      entry.material.dispose();
      entry.source.dispose();
    }
    this.sources.clear();

    this.previewMaterial?.dispose();
    this.previewMesh?.dispose();
    this.previewMesh = null;
    this.previewMaterial = null;
  }

  private getStackBaseY(gx: number, gz: number, gridY: number): number {
    if (gridY === 0) {
      return 0;
    }

    const below = useGameStore.getState().pieces.find(
      (piece) => piece.gridX === gx && piece.gridZ === gz && piece.gridY === gridY - 1,
    );

    if (!below) {
      return gridY * LAYER_STEP;
    }

    const belowCenter = this.getWorldY(below.type, below.gridY, gx, gz);
    return belowCenter + PIECE_DIMS[below.type].height / 2;
  }

  private getWorldY(type: PieceType, gridY: number, gx: number, gz: number): number {
    return this.getStackBaseY(gx, gz, gridY) + PIECE_DIMS[type].height / 2;
  }

  private applyTransform(
    type: PieceType,
    mesh: AbstractMesh,
    gx: number,
    gz: number,
    gridY: number,
    rotation: PieceRotation,
    offsetX = 0,
    offsetZ = 0,
  ): void {
    mesh.scaling.setAll(1);
    const base = this.gridSystem.gridToWorld(gx, gz);
    const y = this.getWorldY(type, gridY, gx, gz);
    mesh.position.set(base.x + offsetX, y, base.z + offsetZ);
    applyMeshRotation(mesh, rotation);
    mesh.computeWorldMatrix(true);
  }

  private createSourceMeshes(): void {
    const wallDims = PIECE_DIMS.wall;
    const floorDims = PIECE_DIMS.floor;
    const pillarDims = PIECE_DIMS.pillar;

    this.sources.set('wall', this.buildSource('wallSource', 'wall', () =>
      MeshBuilder.CreateBox('wallSource', {
        width: wallDims.width,
        height: wallDims.height,
        depth: wallDims.depth,
      }, this.scene),
    ));

    this.sources.set('floor', this.buildSource('floorSource', 'floor', () =>
      MeshBuilder.CreateBox('floorSource', {
        width: floorDims.width,
        height: floorDims.height,
        depth: floorDims.depth,
      }, this.scene),
    ));

    this.sources.set('pillar', this.buildSource('pillarSource', 'pillar', () =>
      MeshBuilder.CreateCylinder('pillarSource', {
        height: pillarDims.height,
        diameter: pillarDims.diameter,
        tessellation: 32,
        cap: Mesh.CAP_ALL,
      }, this.scene),
    ));
  }

  private registerShadowCaster(mesh: AbstractMesh): void {
    if (!this.shadowGenerator) return;
    mesh.receiveShadows = true;
    this.shadowGenerator.addShadowCaster(mesh);
  }

  private buildSource(
    name: string,
    type: PieceType,
    factory: () => Mesh,
  ): SourceMeshEntry {
    const source = factory();
    source.isVisible = false;
    source.isPickable = false;

    const material = createPieceMaterial(this.scene, type, `${name}Mat`);
    source.material = material;

    return { source, material };
  }

  private createPreviewMesh(): void {
    this.previewMesh = MeshBuilder.CreateBox('preview', { size: 1 }, this.scene);
    this.previewMaterial = new StandardMaterial('previewMat', this.scene);
    this.previewMaterial.alpha = 0.5;
    this.previewMaterial.specularColor = new Color3(0, 0, 0);
    this.previewMesh.material = this.previewMaterial;
    this.previewMesh.isPickable = false;
    this.previewMesh.setEnabled(false);
  }

  private applyPreviewTransform(
    type: PieceType,
    mesh: AbstractMesh,
    gx: number,
    gz: number,
    gridY: number,
    rotation: PieceRotation,
  ): void {
    applyMeshRotation(mesh, rotation);
    mesh.scaling.setAll(1);

    const base = this.gridSystem.gridToWorld(gx, gz);
    const y = this.getWorldY(type, gridY, gx, gz);

    switch (type) {
      case 'wall': {
        const dims = PIECE_DIMS.wall;
        mesh.scaling.set(dims.width, dims.height, dims.depth);
        mesh.position.set(base.x, y, base.z);
        break;
      }
      case 'floor': {
        const dims = PIECE_DIMS.floor;
        mesh.scaling.set(dims.width, dims.height, dims.depth);
        mesh.position.set(base.x, y, base.z);
        break;
      }
      case 'pillar': {
        const dims = PIECE_DIMS.pillar;
        mesh.scaling.set(dims.diameter, dims.height, dims.diameter);
        mesh.position.set(base.x, y, base.z);
        break;
      }
    }
  }
}
