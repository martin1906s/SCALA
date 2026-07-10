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
import { CELL_SIZE } from '@/config/gameConfig';
import type { MaterialTier } from '@/config/materialCatalog';
import { cloneDimensions } from '@/domain/materials/MaterialDimensions';
import { getFootprintFromPiece } from '@/domain/structures/Footprint';
import type {
  BuildingPiece,
  PieceRotation,
  PieceType,
} from '@/entities/BuildingPiece';
import {
  applyMeshRotation,
  cloneRotation,
  generatePieceId,
  readMeshRotation,
} from '@/entities/BuildingPiece';
import { ROTATION_STEP, useGameStore } from '@/store/gameStore';
import {
  ActionHistory,
  positionFromPiece,
  snapshotFromPiece,
  type HistoryAction,
  type PieceSnapshot,
} from '@/systems/ActionHistory';
import type { CollisionSystem, PlacementCandidate } from '@/systems/CollisionSystem';
import type { EconomySystem } from '@/systems/EconomySystem';
import type { GridSystem } from '@/systems/GridSystem';
import type { JuiceSystem } from '@/systems/JuiceSystem';
import type { MeshFactory } from '@/systems/MeshFactory';
import type { StructuralIntegritySystem } from '@/systems/StructuralIntegritySystem';

export class BuildingSystem {
  private readonly pieceMap = new Map<string, BuildingPiece>();
  private previewMesh: AbstractMesh | null = null;
  private previewMaterial: StandardMaterial | null = null;
  private readonly highlightLayer: HighlightLayer;
  private readonly highlightedMeshes = new Set<AbstractMesh>();
  private readonly emissiveBackup = new Map<string, Color3>();
  private readonly scene: Scene;
  private readonly gridSystem: GridSystem;
  private readonly economySystem: EconomySystem;
  private readonly collisionSystem: CollisionSystem;
  private readonly meshFactory: MeshFactory;
  private readonly juiceSystem: JuiceSystem | null;
  private readonly integritySystem: StructuralIntegritySystem | null;
  private readonly shadowGenerator: ShadowGenerator | null;
  private readonly history = new ActionHistory();
  private readonly historyListeners = new Set<() => void>();
  private footprintHighlights: Mesh[] = [];

  constructor(
    scene: Scene,
    gridSystem: GridSystem,
    economySystem: EconomySystem,
    collisionSystem: CollisionSystem,
    meshFactory: MeshFactory,
    juiceSystem: JuiceSystem | null = null,
    integritySystem: StructuralIntegritySystem | null = null,
  ) {
    this.scene = scene;
    this.gridSystem = gridSystem;
    this.economySystem = economySystem;
    this.collisionSystem = collisionSystem;
    this.meshFactory = meshFactory;
    this.juiceSystem = juiceSystem;
    this.integritySystem = integritySystem;
    this.shadowGenerator = (scene.metadata?.shadowGenerator as ShadowGenerator | undefined) ?? null;
    this.highlightLayer = new HighlightLayer('highlights', scene, {
      blurHorizontalSize: 1.2,
      blurVerticalSize: 1.2,
    });
    this.highlightLayer.innerGlow = false;
    this.highlightLayer.outerGlow = true;
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

  private buildCandidate(
    type: PieceType,
    gx: number,
    gz: number,
    gridY: number,
    dimensions = useGameStore.getState().getDraftForTool(type),
    tier: MaterialTier = useGameStore.getState().draftMaterialTier,
    rotationY = useGameStore.getState().previewRotation.y,
    offsetX = 0,
    offsetZ = 0,
  ): PlacementCandidate {
    return {
      type,
      dimensions: cloneDimensions(dimensions),
      materialTier: tier,
      gridX: gx,
      gridZ: gz,
      gridY,
      rotationY,
      offsetX,
      offsetZ,
      cost: this.economySystem.computeCost(type, dimensions, tier),
    };
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
      return this.pieceMap.get(metaId) ?? null;
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

  getPieceNearWorldPoint(worldX: number, worldZ: number, maxDistance = CELL_SIZE * 0.9): BuildingPiece | null {
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

  getTopPieceAtWorld(worldX: number, worldZ: number): BuildingPiece | null {
    const { gx, gz } = this.gridSystem.worldToGrid(worldX, worldZ);
    const pieces = useGameStore.getState().pieces;
    let top: BuildingPiece | null = null;

    for (const piece of pieces) {
      const footprint = piece.footprintCells ?? [];
      const key = `${gx},${gz}`;
      const contains = footprint.includes(key)
        || (piece.gridX === gx && piece.gridZ === gz);
      if (contains && (!top || piece.gridY > top.gridY)) {
        top = piece;
      }
    }

    if (top) {
      return top;
    }

    return this.getPieceNearWorldPoint(worldX, worldZ, CELL_SIZE * 1.2);
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

    for (const [id, color] of this.emissiveBackup) {
      const piece = this.pieceMap.get(id);
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
    const candidate = this.buildCandidate(type, gx, gz, gridY);
    if (!this.collisionSystem.canPlace(candidate, excludeId)) {
      return false;
    }
    if (!excludeId && !this.economySystem.canAfford(candidate.cost)) {
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
    const candidate = this.buildCandidate(type, gx, gz, gridY);
    const collisionReason = this.collisionSystem.getPlaceFailureReason(candidate, excludeId);
    if (collisionReason) {
      return collisionReason;
    }
    if (!excludeId && !this.economySystem.canAfford(candidate.cost)) {
      return 'No tienes presupuesto suficiente.';
    }
    return null;
  }

  getStructuralWarning(
    type: PieceType,
    gx: number,
    gz: number,
    gridY: number,
  ): string | null {
    if (!this.integritySystem) {
      return null;
    }
    const candidate = this.buildCandidate(type, gx, gz, gridY);
    return this.integritySystem.checkPlacement(candidate)?.message ?? null;
  }

  movePiece(id: string, deltaX: number, deltaZ: number): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }
    const current = this.getPieceWorldPosition(piece);
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
    this.meshFactory.applyPieceTransform(
      piece.type,
      piece.dimensions,
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

    const anchor = this.gridSystem.worldToPieceAnchor(roundedX, roundedZ);
    const candidate = this.buildCandidate(
      piece.type,
      anchor.gridX,
      anchor.gridZ,
      piece.gridY,
      piece.dimensions,
      piece.materialTier,
      piece.rotation.y,
      anchor.offsetX,
      anchor.offsetZ,
    );

    if (!this.collisionSystem.canPlace(candidate, id)) {
      return false;
    }

    const before = positionFromPiece(piece);
    piece.gridX = anchor.gridX;
    piece.gridZ = anchor.gridZ;
    piece.offsetX = anchor.offsetX;
    piece.offsetZ = anchor.offsetZ;
    piece.footprintCells = getFootprintFromPiece(piece);

    this.meshFactory.applyPieceTransform(
      piece.type,
      piece.dimensions,
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
      footprintCells: piece.footprintCells,
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
    this.meshFactory.applyPieceTransform(
      piece.type,
      piece.dimensions,
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
    const candidate = this.buildCandidate(type, gx, gz, gridY);
    if (!this.canPlace(type, gx, gz, gridY)) {
      this.juiceSystem?.onInvalidPlace();
      return false;
    }

    const rotation = cloneRotation(useGameStore.getState().previewRotation);
    const id = generatePieceId();
    const mesh = this.meshFactory.createMesh(
      type,
      candidate.dimensions,
      candidate.materialTier,
      `${type}-${id}`,
    );

    this.meshFactory.applyPieceTransform(
      type,
      candidate.dimensions,
      mesh,
      gx,
      gz,
      gridY,
      rotation,
    );
    this.registerShadowCaster(mesh);

    if (!this.economySystem.spend(candidate.cost)) {
      mesh.dispose();
      return false;
    }

    const footprintCells = this.collisionSystem.getFootprintCells({
      gridX: gx,
      gridZ: gz,
      gridY,
      type,
      dimensions: candidate.dimensions,
      rotationY: rotation.y,
    });

    const piece: BuildingPiece = {
      id,
      type,
      dimensions: candidate.dimensions,
      materialTier: candidate.materialTier,
      costPaid: candidate.cost,
      gridX: gx,
      gridZ: gz,
      gridY,
      offsetX: 0,
      offsetZ: 0,
      rotation,
      mesh,
      footprintCells,
    };

    this.tagMesh(mesh, id);
    this.pieceMap.set(id, piece);
    this.recordHistory({ kind: 'place', pieceId: id });
    useGameStore.getState().addPiece(piece);

    this.juiceSystem?.onPlace({
      type,
      dimensions: candidate.dimensions,
      tier: candidate.materialTier,
      cost: candidate.cost,
      footprintCellCount: footprintCells.length,
      mesh,
    });

    return true;
  }

  duplicatePiece(id: string): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece) {
      return false;
    }

    useGameStore.getState().setDraftDimensions(piece.type, piece.dimensions);
    useGameStore.getState().setDraftMaterialTier(piece.materialTier);
    useGameStore.getState().setPreviewRotation(cloneRotation(piece.rotation));

    const offsets = [
      { dgx: 1, dgz: 0 },
      { dgx: -1, dgz: 0 },
      { dgx: 0, dgz: 1 },
      { dgx: 0, dgz: -1 },
    ];

    for (const { dgx, dgz } of offsets) {
      if (this.placePiece(piece.type, piece.gridX + dgx, piece.gridZ + dgz, piece.gridY)) {
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
    const candidate = this.buildCandidate(
      snapshot.type,
      snapshot.gridX,
      snapshot.gridZ,
      snapshot.gridY,
      snapshot.dimensions,
      snapshot.materialTier,
      snapshot.rotation.y,
      snapshot.offsetX,
      snapshot.offsetZ,
    );
    candidate.cost = snapshot.costPaid;

    if (!this.collisionSystem.canPlace(candidate)) {
      return false;
    }
    if (!this.economySystem.spend(snapshot.costPaid)) {
      return false;
    }

    const mesh = this.meshFactory.createMesh(
      snapshot.type,
      snapshot.dimensions,
      snapshot.materialTier,
      snapshot.id,
    );
    this.meshFactory.applyPieceTransform(
      snapshot.type,
      snapshot.dimensions,
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

    const footprintCells = snapshot.footprintCells
      ?? this.collisionSystem.getFootprintCells({
        gridX: snapshot.gridX,
        gridZ: snapshot.gridZ,
        gridY: snapshot.gridY,
        type: snapshot.type,
        dimensions: snapshot.dimensions,
        rotationY: snapshot.rotation.y,
        offsetX: snapshot.offsetX,
        offsetZ: snapshot.offsetZ,
      });

    const piece: BuildingPiece = {
      id: snapshot.id,
      type: snapshot.type,
      dimensions: cloneDimensions(snapshot.dimensions),
      materialTier: snapshot.materialTier,
      costPaid: snapshot.costPaid,
      gridX: snapshot.gridX,
      gridZ: snapshot.gridZ,
      gridY: snapshot.gridY,
      offsetX: snapshot.offsetX,
      offsetZ: snapshot.offsetZ,
      rotation: cloneRotation(snapshot.rotation),
      mesh,
      footprintCells,
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
    this.clearFootprintHighlights();
    this.history.clear();
    this.hidePreview();
    this.notifyHistoryChange();
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

    piece.rotation = readMeshRotation(mesh);
    piece.footprintCells = getFootprintFromPiece(piece);
    useGameStore.getState().updatePiece(id, {
      rotation: piece.rotation,
      footprintCells: piece.footprintCells,
    });
    return true;
  }

  replacePieceType(id: string, newType: PieceType): boolean {
    const piece = this.pieceMap.get(id);
    if (!piece || piece.type === newType) {
      return false;
    }

    const oldMesh = piece.mesh;
    const position = oldMesh.position.clone();
    const rotation = readMeshRotation(oldMesh);

    piece.customMaterial?.dispose();
    oldMesh.dispose();

    const dimensions = useGameStore.getState().getDraftForTool(newType);
    const mesh = this.meshFactory.createMesh(
      newType,
      dimensions,
      piece.materialTier,
      `inst-${id}`,
    );
    mesh.position = position;
    applyMeshRotation(mesh, rotation);
    this.registerShadowCaster(mesh);

    piece.mesh = mesh;
    piece.type = newType;
    piece.dimensions = cloneDimensions(dimensions);
    piece.footprintCells = getFootprintFromPiece(piece);
    this.tagMesh(mesh, id);
    useGameStore.getState().updatePiece(id, {
      type: newType,
      mesh,
      dimensions: piece.dimensions,
      footprintCells: piece.footprintCells,
      customMaterial: undefined,
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

    const refund = this.economySystem.refund(piece.costPaid);
    this.juiceSystem?.onSell(refund);

    piece.customMaterial?.dispose();
    piece.mesh.dispose();
    this.pieceMap.delete(id);
    useGameStore.getState().removePiece(id);
    return true;
  }

  updatePreview(type: PieceType, gx: number, gz: number, gridY: number): void {
    if (!this.previewMesh || !this.previewMaterial) {
      return;
    }

    if (!this.gridSystem.isInBounds(gx, gz)) {
      this.previewMesh.setEnabled(false);
      this.clearFootprintHighlights();
      return;
    }

    const candidate = this.buildCandidate(type, gx, gz, gridY);
    const canPlace = this.canPlace(type, gx, gz, gridY);
    const warning = this.getStructuralWarning(type, gx, gz, gridY);
    const rotation = useGameStore.getState().previewRotation;

    this.previewMesh.setEnabled(true);
    this.meshFactory.applyPieceTransform(
      type,
      candidate.dimensions,
      this.previewMesh,
      gx,
      gz,
      gridY,
      rotation,
    );

    if (canPlace && !warning) {
      this.previewMaterial.diffuseColor = new Color3(0.45, 0.9, 0.55);
    } else if (canPlace && warning) {
      this.previewMaterial.diffuseColor = new Color3(0.95, 0.85, 0.35);
    } else {
      this.previewMaterial.diffuseColor = new Color3(0.95, 0.35, 0.35);
    }

    this.showFootprintHighlights(candidate, canPlace, Boolean(warning));
  }

  private showFootprintHighlights(
    candidate: PlacementCandidate,
    canPlace: boolean,
    hasWarning: boolean,
  ): void {
    this.clearFootprintHighlights();
    const cells = this.collisionSystem.getFootprintCells({
      gridX: candidate.gridX,
      gridZ: candidate.gridZ,
      gridY: candidate.gridY,
      type: candidate.type,
      dimensions: candidate.dimensions,
      rotationY: candidate.rotationY,
    });

    const color = !canPlace
      ? new Color3(0.9, 0.35, 0.35)
      : hasWarning
        ? new Color3(0.95, 0.85, 0.35)
        : new Color3(0.35, 0.85, 0.45);

    for (const key of cells) {
      const [gx, gz] = key.split(',').map(Number) as [number, number];
      const center = this.gridSystem.gridToWorld(gx, gz);
      const pad = MeshBuilder.CreateBox(`fp-${key}`, {
        width: CELL_SIZE * 0.92,
        height: 0.015,
        depth: CELL_SIZE * 0.92,
      }, this.scene);
      pad.position.set(center.x, 0.04, center.z);
      const mat = new StandardMaterial(`fpMat-${key}`, this.scene);
      mat.diffuseColor = color;
      mat.emissiveColor = color.scale(0.3);
      mat.alpha = 0.45;
      mat.specularColor = Color3.Black();
      pad.material = mat;
      pad.isPickable = false;
      this.footprintHighlights.push(pad);
    }
  }

  private clearFootprintHighlights(): void {
    for (const mesh of this.footprintHighlights) {
      mesh.material?.dispose();
      mesh.dispose();
    }
    this.footprintHighlights = [];
  }

  hidePreview(): void {
    this.previewMesh?.setEnabled(false);
    this.clearFootprintHighlights();
  }

  dispose(): void {
    this.clearFootprintHighlights();
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

    this.previewMaterial?.dispose();
    this.previewMesh?.dispose();
    this.previewMesh = null;
    this.previewMaterial = null;
  }

  private createPreviewMesh(): void {
    this.previewMesh = this.meshFactory.createPreviewMesh();
    this.previewMaterial = this.meshFactory.createPreviewMaterial();
    this.previewMesh.material = this.previewMaterial;
    this.previewMesh.isPickable = false;
    this.previewMesh.setEnabled(false);
  }

  private registerShadowCaster(mesh: AbstractMesh): void {
    if (!this.shadowGenerator) {
      return;
    }
    mesh.receiveShadows = true;
    this.shadowGenerator.addShadowCaster(mesh);
  }
}
