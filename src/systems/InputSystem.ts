import { Color3 } from '@babylonjs/core';
import type { AbstractMesh, PickingInfo, Scene, Vector3 } from '@babylonjs/core';
import type { PieceType, ToolMode } from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import type { BuildingSystem } from '@/systems/BuildingSystem';
import type { GridSystem } from '@/systems/GridSystem';
import type { MoveGizmoSystem } from '@/systems/MoveGizmoSystem';
import { PiecePicker } from '@/systems/PiecePicker';
import { GameplayToast } from '@/ui/GameplayToast';
import { pointerCssCoords, pickGroundPlane } from '@/utils/pointerCoords';

const TOOL_SHORTCUTS: Record<string, ToolMode> = {
  '1': 'wall',
  '2': 'floor',
  '3': 'pillar',
  '4': 'delete',
  '5': 'select',
  '6': 'roof',
  '7': 'ramp',
};

const BUILD_TOOLS: PieceType[] = ['wall', 'floor', 'pillar', 'roof', 'ramp'];

const HOVER_COLORS = {
  default: Color3.FromHexString('#5BC8FF'),
  delete: Color3.FromHexString('#FF6B6B'),
} as const;

interface PlacementTarget {
  gx: number;
  gz: number;
  gridY: number;
}

export class InputSystem {
  private disposed = false;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly groundMesh: AbstractMesh;
  private readonly gridSystem: GridSystem;
  private readonly buildingSystem: BuildingSystem;
  private readonly moveGizmo: MoveGizmoSystem;
  private readonly piecePicker: PiecePicker;
  private lastPointerCoords: { x: number; y: number } | null = null;
  private measureStart: { x: number; z: number } | null = null;

  constructor(
    scene: Scene,
    canvas: HTMLCanvasElement,
    groundMesh: AbstractMesh,
    gridSystem: GridSystem,
    buildingSystem: BuildingSystem,
    moveGizmo: MoveGizmoSystem,
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.groundMesh = groundMesh;
    this.gridSystem = gridSystem;
    this.buildingSystem = buildingSystem;
    this.moveGizmo = moveGizmo;
    this.piecePicker = new PiecePicker(scene, buildingSystem);

    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.addEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.addEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('keydown', this.handleKeyDown, true);
  }

  syncAfterHistory(): void {
    const state = useGameStore.getState();
    if (
      state.selectedPieceId &&
      !this.buildingSystem.getPieceById(state.selectedPieceId)
    ) {
      state.setSelectedPiece(null);
    }
    this.syncHighlights();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.buildingSystem.hidePreview();
    useGameStore.getState().setHoveredPiece(null);
    this.buildingSystem.updateHighlights(null, useGameStore.getState().selectedPieceId);
  }

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private onCanvasPointerDown = (event: PointerEvent): void => {
    if (useGameStore.getState().dialogueBlocking) {
      return;
    }

    const pickInfo = this.pickScene(event);
    this.handlePointerDown(event, pickInfo);
  };

  private onCanvasPointerMove = (event: PointerEvent): void => {
    if (useGameStore.getState().dialogueBlocking) {
      return;
    }

    const pickInfo = this.pickScene(event);
    this.handlePointerMove(event, pickInfo);
  };

  private pointerCoords(event?: PointerEvent): { x: number; y: number } {
    if (event) {
      const coords = pointerCssCoords(this.scene, event.clientX, event.clientY);
      this.lastPointerCoords = coords;
      return coords;
    }
    if (this.lastPointerCoords) {
      return this.lastPointerCoords;
    }
    return {
      x: this.scene.pointerX,
      y: this.scene.pointerY,
    };
  }

  /** Celda de la cuadrícula bajo el cursor (plano y=0, alineado con el rayo de la cámara). */
  private getGroundPointUnderCursor(event?: PointerEvent): Vector3 | null {
    const { x, y } = this.pointerCoords(event);
    return pickGroundPlane(this.scene, x, y);
  }

  private pickScene(event?: PointerEvent): PickingInfo {
    const { x, y } = this.pointerCoords(event);
    return this.scene.pick(
      x,
      y,
      (mesh) => mesh === this.groundMesh || this.buildingSystem.isBuildingMesh(mesh),
    );
  }

  /** Selección: raycast sobre piezas → cuadrícula bajo cursor → pantalla. */
  private pickBuildingPiece(event?: PointerEvent, pickInfo?: PickingInfo | null) {
    const { x, y } = this.pointerCoords(event);

    const fromMesh = this.piecePicker.pickFromMesh(pickInfo?.pickedMesh);
    if (fromMesh) {
      return fromMesh;
    }

    const buildingPicks = this.scene.multiPick(
      x,
      y,
      (mesh) => this.buildingSystem.isBuildingMesh(mesh),
    );
    if (buildingPicks?.length) {
      for (const pick of buildingPicks) {
        const piece = this.piecePicker.pickFromMesh(pick.pickedMesh);
        if (piece) {
          return piece;
        }
      }
    }

    const world = this.getGroundPointUnderCursor(event);
    if (world) {
      const fromGrid = this.buildingSystem.getTopPieceAtWorld(world.x, world.z);
      if (fromGrid) {
        return fromGrid;
      }
    }

    return this.piecePicker.pick(x, y);
  }

  private selectPiece(pieceId: string): void {
    const state = useGameStore.getState();
    state.setTool('select');
    state.setSelectedPiece(pieceId);
    this.buildingSystem.realignPiece(pieceId);
    this.syncHighlights();
  }

  private updateHover(pieceId: string | null): void {
    const state = useGameStore.getState();
    if (state.hoveredPieceId === pieceId) {
      return;
    }
    state.setHoveredPiece(pieceId);
    this.syncHighlights();
  }

  private handlePointerDown(event: PointerEvent, pickInfo?: PickingInfo | null): void {
    const state = useGameStore.getState();

    if (event.button === 2) {
      const piece = this.pickBuildingPiece(event, pickInfo);
      if (piece) {
        this.selectPiece(piece.id);
      }
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (useGameStore.getState().measurementActive) {
      this.handleMeasureClick(event);
      return;
    }

    const { selectedTool } = state;

    if (selectedTool === 'select') {
      const clickedPiece = this.pickBuildingPiece(event, pickInfo);
      if (clickedPiece) {
        this.selectPiece(clickedPiece.id);
        return;
      }

      const { x, y } = this.pointerCoords(event);
      const gizmoPick = this.scene.pick(
        x,
        y,
        (mesh) => this.moveGizmo.isGizmoMesh(mesh),
      );
      if (gizmoPick.hit) {
        return;
      }

      state.setSelectedPiece(null);
      this.syncHighlights();
      return;
    }

    if (selectedTool === 'delete') {
      const clickedPiece = this.pickBuildingPiece(event, pickInfo);
      if (clickedPiece) {
        this.buildingSystem.removePieceById(clickedPiece.id);
        this.syncHighlights();
      }
      return;
    }

    const target = this.pickPlacementTarget(event, pickInfo);
    if (!target) {
      return;
    }

    const placed = this.buildingSystem.placePiece(
      selectedTool,
      target.gx,
      target.gz,
      target.gridY,
    );

    if (!placed) {
      const reason = this.buildingSystem.getPlaceFailureReason(
        selectedTool as PieceType,
        target.gx,
        target.gz,
        target.gridY,
      );
      if (reason) {
        GameplayToast.show(reason);
      }
    }
  }

  private handleMeasureClick(event: PointerEvent): void {
    const ground = this.getGroundPointUnderCursor(event);
    if (!ground) {
      return;
    }

    if (!this.measureStart) {
      this.measureStart = { x: ground.x, z: ground.z };
      GameplayToast.show('Punto A marcado. Clic en B para medir.');
      return;
    }

    const dx = ground.x - this.measureStart.x;
    const dz = ground.z - this.measureStart.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const area = Math.abs(dx * dz);
    GameplayToast.show(`Distancia: ${dist.toFixed(2)} m · Área aprox: ${area.toFixed(2)} m²`);
    this.measureStart = null;
  }

  private handlePointerMove(event: PointerEvent, pickInfo?: PickingInfo | null): void {
    const state = useGameStore.getState();
    const { selectedTool } = state;
    const hovered = this.pickBuildingPiece(event, pickInfo);
    this.updateHover(hovered?.id ?? null);

    if (selectedTool === 'select' || selectedTool === 'delete') {
      this.buildingSystem.hidePreview();
      return;
    }

    if (!BUILD_TOOLS.includes(selectedTool as PieceType)) {
      return;
    }

    const target = this.pickPlacementTarget(event, pickInfo);
    if (!target) {
      this.buildingSystem.hidePreview();
      return;
    }

    this.buildingSystem.updatePreview(
      selectedTool as PieceType,
      target.gx,
      target.gz,
      target.gridY,
    );

    const warning = this.buildingSystem.getStructuralWarning(
      selectedTool as PieceType,
      target.gx,
      target.gz,
      target.gridY,
    );
    void warning;
  }

  private handlePointerLeave = (): void => {
    this.buildingSystem.hidePreview();
    this.updateHover(null);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (useGameStore.getState().dialogueBlocking) {
      return;
    }

    const store = useGameStore.getState();

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        if (this.buildingSystem.redoLastAction()) {
          this.syncAfterHistory();
          GameplayToast.show('Acción rehecha');
        } else {
          GameplayToast.show('Nada que rehacer');
        }
      } else if (this.buildingSystem.undoLastAction()) {
        this.syncAfterHistory();
        GameplayToast.show('Acción deshecha');
      } else {
        GameplayToast.show('Nada que deshacer');
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      if (this.buildingSystem.redoLastAction()) {
        this.syncAfterHistory();
        GameplayToast.show('Acción rehecha');
      } else {
        GameplayToast.show('Nada que rehacer');
      }
      return;
    }

    const tool = TOOL_SHORTCUTS[event.key];
    if (tool) {
      event.preventDefault();
      store.setTool(tool);
      return;
    }

    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      const next = !store.measurementActive;
      store.setMeasurementActive(next);
      this.measureStart = null;
      GameplayToast.show(next ? 'Modo medición: clic A y B' : 'Modo medición desactivado');
      return;
    }

    if (store.selectedPieceId) {
      switch (event.key.toLowerCase()) {
        case 'd':
          event.preventDefault();
          if (this.buildingSystem.duplicatePiece(store.selectedPieceId)) {
            GameplayToast.show('Pieza duplicada');
          } else {
            GameplayToast.show('No hay espacio para duplicar');
          }
          return;
        case 'v':
          event.preventDefault();
          if (this.buildingSystem.sellPiece(store.selectedPieceId)) {
            store.setSelectedPiece(null);
            GameplayToast.show('Pieza vendida (80% reembolso)');
            this.syncHighlights();
          }
          return;
        case 'c': {
          event.preventDefault();
          const piece = this.buildingSystem.getPieceById(store.selectedPieceId);
          if (piece) {
            store.setTool(piece.type);
            store.setDraftDimensions(piece.type, piece.dimensions);
            store.setDraftMaterialTier(piece.materialTier);
            store.setPreviewRotation(piece.rotation);
            GameplayToast.show('Tipo y dimensiones copiados');
          }
          return;
        }
        default:
          break;
      }
    }

    if (store.selectedTool === 'select') {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'r':
        store.rotatePreview('y');
        this.refreshPreviewIfBuilding();
        break;
      case 'e':
        store.rotatePreview('x');
        this.refreshPreviewIfBuilding();
        break;
      case 't':
        store.rotatePreview('z');
        this.refreshPreviewIfBuilding();
        break;
      default:
        break;
    }
  };

  private syncHighlights(): void {
    const { hoveredPieceId, selectedPieceId, selectedTool } = useGameStore.getState();
    const hoverColor = selectedTool === 'delete'
      ? HOVER_COLORS.delete
      : HOVER_COLORS.default;
    this.buildingSystem.updateHighlights(hoveredPieceId, selectedPieceId, hoverColor);
  }

  refreshPreviewIfBuilding(): void {
    const { selectedTool } = useGameStore.getState();
    if (!BUILD_TOOLS.includes(selectedTool as PieceType)) {
      return;
    }

    const target = this.pickPlacementTarget();
    if (target) {
      this.buildingSystem.updatePreview(
        selectedTool as PieceType,
        target.gx,
        target.gz,
        target.gridY,
      );
    }
  }

  private pickPlacementTarget(
    event?: PointerEvent,
    pickInfo?: PickingInfo | null,
  ): PlacementTarget | null {
    if (pickInfo?.pickedMesh && this.buildingSystem.isBuildingMesh(pickInfo.pickedMesh)) {
      const piece = this.buildingSystem.getPieceByMesh(pickInfo.pickedMesh);
      if (piece) {
        return {
          gx: piece.gridX,
          gz: piece.gridZ,
          gridY: piece.gridY + 1,
        };
      }
    }

    const ground = this.getGroundPointUnderCursor(event);
    if (!ground) {
      return null;
    }

    return this.placementFromWorld(ground.x, ground.z);
  }

  private placementFromWorld(worldX: number, worldZ: number): PlacementTarget | null {
    const { gx, gz } = this.gridSystem.worldToGrid(worldX, worldZ);
    if (!this.gridSystem.isInBounds(gx, gz)) {
      return null;
    }
    const topLayer = this.gridSystem.getTopLayer(gx, gz);
    return { gx, gz, gridY: topLayer + 1 };
  }
}
