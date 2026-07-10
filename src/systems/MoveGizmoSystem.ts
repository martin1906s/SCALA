import {
  Color3,
  MeshBuilder,
  PointerEventTypes,
  StandardMaterial,
} from '@babylonjs/core';
import type { AbstractMesh, Mesh, Scene } from '@babylonjs/core';
import { CELL_SIZE } from '@/config/gameConfig';
import type { BuildingSystem } from '@/systems/BuildingSystem';
import type { GridSystem } from '@/systems/GridSystem';
import { roundPosition } from '@/systems/GridSystem';
import { useGameStore } from '@/store/gameStore';
import { GameplayToast } from '@/ui/GameplayToast';
import { pickGroundPlane } from '@/utils/pointerCoords';

export class MoveGizmoSystem {
  private readonly scene: Scene;
  private readonly gridSystem: GridSystem;
  private readonly buildingSystem: BuildingSystem;
  private readonly gizmoMesh: Mesh;
  private readonly gizmoMat: StandardMaterial;
  private unsubscribe: (() => void) | null = null;
  private activePieceId: string | null = null;
  private targetWorldX = 0;
  private targetWorldZ = 0;
  private originWorldX = 0;
  private originWorldZ = 0;
  private dragOffsetX = 0;
  private dragOffsetZ = 0;
  private dragging = false;
  private pointerObserver: { remove: () => void } | null = null;

  constructor(scene: Scene, gridSystem: GridSystem, buildingSystem: BuildingSystem) {
    this.scene = scene;
    this.gridSystem = gridSystem;
    this.buildingSystem = buildingSystem;

    this.gizmoMesh = MeshBuilder.CreateBox('moveGizmo', {
      width: CELL_SIZE * 0.72,
      height: CELL_SIZE * 0.72,
      depth: CELL_SIZE * 0.72,
    }, scene);
    this.gizmoMesh.isPickable = true;
    this.gizmoMesh.setEnabled(false);
    this.gizmoMesh.renderingGroupId = 2;

    this.gizmoMat = new StandardMaterial('moveGizmoMat', scene);
    this.gizmoMat.diffuseColor = new Color3(1, 0.72, 0.2);
    this.gizmoMat.emissiveColor = new Color3(0.45, 0.28, 0.02);
    this.gizmoMat.alpha = 0.82;
    this.gizmoMat.specularColor = new Color3(0.2, 0.15, 0.05);
    this.gizmoMesh.material = this.gizmoMat;

    this.pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
      if (useGameStore.getState().dialogueBlocking) {
        return;
      }

      const state = useGameStore.getState();
      if (state.selectedTool !== 'select' || !this.activePieceId) {
        return;
      }

      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          if (pointerInfo.pickInfo?.pickedMesh === this.gizmoMesh) {
            this.beginDrag(this.targetWorldX, this.targetWorldZ);
          }
          break;
        case PointerEventTypes.POINTERMOVE:
          if (this.dragging) {
            this.updateDragFromPointer();
          }
          break;
        case PointerEventTypes.POINTERUP:
          if (this.dragging) {
            this.endDrag();
          }
          break;
        default:
          break;
      }
    });

    this.unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (
        state.selectedPieceId === prevState.selectedPieceId &&
        state.selectedTool === prevState.selectedTool
      ) {
        return;
      }
      this.syncFromStore();
    });
    this.syncFromStore();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pointerObserver?.remove();
    this.pointerObserver = null;
    this.gizmoMat.dispose();
    this.gizmoMesh.dispose();
    this.gridSystem.showPositionMarker(0, 0, 'hidden');
  }

  isGizmoMesh(mesh: AbstractMesh): boolean {
    return mesh === this.gizmoMesh;
  }

  isDragging(): boolean {
    return this.dragging;
  }

  moveBy(deltaX: number, deltaZ: number): boolean {
    if (!this.activePieceId) {
      return false;
    }
    return this.setTarget(
      this.targetWorldX + deltaX,
      this.targetWorldZ + deltaZ,
      true,
    );
  }

  /** Arrastrar la pieza desde un clic sobre su mesh. */
  startPieceDrag(pieceId: string, groundX: number, groundZ: number): void {
    const piece = this.buildingSystem.getPieceById(pieceId);
    if (!piece) {
      return;
    }

    this.activePieceId = pieceId;
    this.gizmoMesh.setEnabled(true);

    const world = this.buildingSystem.getPieceWorldPosition(piece);
    this.targetWorldX = world.x;
    this.targetWorldZ = world.z;
    this.dragOffsetX = world.x - groundX;
    this.dragOffsetZ = world.z - groundZ;
    this.beginDrag(world.x, world.z);
    this.previewAt(this.targetWorldX, this.targetWorldZ);
    this.refreshVisuals();
  }

  updatePieceDrag(groundX: number, groundZ: number): void {
    if (!this.dragging || !this.activePieceId) {
      return;
    }
    this.setTarget(groundX + this.dragOffsetX, groundZ + this.dragOffsetZ, false);
  }

  endPieceDrag(): boolean {
    if (!this.dragging) {
      return false;
    }
    return this.endDrag();
  }

  private beginDrag(originX: number, originZ: number): void {
    this.dragging = true;
    this.originWorldX = originX;
    this.originWorldZ = originZ;
  }

  private endDrag(): boolean {
    this.dragging = false;
    const committed = this.setTarget(this.targetWorldX, this.targetWorldZ, true);
    if (!committed && this.activePieceId) {
      this.buildingSystem.realignPiece(this.activePieceId);
      this.syncTargetFromPiece();
      this.refreshVisuals();
    }
    return committed;
  }

  private syncFromStore(): void {
    const { selectedPieceId, selectedTool } = useGameStore.getState();

    if (selectedTool !== 'select' || !selectedPieceId) {
      this.deactivate();
      return;
    }

    const piece = this.buildingSystem.getPieceById(selectedPieceId);
    if (!piece) {
      this.deactivate();
      return;
    }

    if (this.activePieceId !== selectedPieceId) {
      this.activePieceId = selectedPieceId;
      this.gizmoMesh.setEnabled(true);
    }

    if (!this.dragging) {
      this.syncTargetFromPiece();
      this.buildingSystem.realignPiece(selectedPieceId);
    }

    this.refreshVisuals();
  }

  private syncTargetFromPiece(): void {
    if (!this.activePieceId) {
      return;
    }
    const piece = this.buildingSystem.getPieceById(this.activePieceId);
    if (!piece) {
      return;
    }
    const world = this.buildingSystem.getPieceWorldPosition(piece);
    this.targetWorldX = world.x;
    this.targetWorldZ = world.z;
  }

  private deactivate(): void {
    if (this.activePieceId && !this.dragging) {
      this.buildingSystem.realignPiece(this.activePieceId);
    }
    this.activePieceId = null;
    this.dragging = false;
    this.gizmoMesh.setEnabled(false);
    this.gridSystem.showPositionMarker(0, 0, 'hidden');
  }

  private setTarget(worldX: number, worldZ: number, commit: boolean): boolean {
    if (!this.activePieceId) {
      return false;
    }

    const roundedX = roundPosition(worldX);
    const roundedZ = roundPosition(worldZ);
    const canMove = this.buildingSystem.canMovePieceToWorld(
      this.activePieceId,
      roundedX,
      roundedZ,
    );

    if (!canMove && commit) {
      this.targetWorldX = this.originWorldX;
      this.targetWorldZ = this.originWorldZ;
      this.buildingSystem.realignPiece(this.activePieceId);
      GameplayToast.show('No se puede mover ahí');
      this.refreshVisuals();
      return false;
    }

    if (!canMove) {
      this.previewAt(roundedX, roundedZ);
      this.refreshVisualsAt(roundedX, roundedZ, false);
      return false;
    }

    this.targetWorldX = roundedX;
    this.targetWorldZ = roundedZ;

    if (!commit) {
      this.previewAt(roundedX, roundedZ);
      this.refreshVisuals();
      return true;
    }

    const moved = this.buildingSystem.movePieceToWorld(
      this.activePieceId,
      roundedX,
      roundedZ,
    );

    if (moved) {
      this.originWorldX = roundedX;
      this.originWorldZ = roundedZ;
      const next = useGameStore.getState();
      this.buildingSystem.updateHighlights(next.hoveredPieceId, next.selectedPieceId);
    } else {
      this.buildingSystem.realignPiece(this.activePieceId);
      GameplayToast.show('No se puede mover ahí');
    }

    this.refreshVisuals();
    return moved;
  }

  private previewAt(worldX: number, worldZ: number): void {
    if (!this.activePieceId) {
      return;
    }
    this.buildingSystem.previewPieceWorldPosition(this.activePieceId, worldX, worldZ);
  }

  private updateDragFromPointer(): void {
    const ground = pickGroundPlane(this.scene, this.scene.pointerX, this.scene.pointerY);
    if (!ground) {
      return;
    }
    this.setTarget(
      ground.x + this.dragOffsetX,
      ground.z + this.dragOffsetZ,
      false,
    );
  }

  private refreshVisualsAt(worldX: number, worldZ: number, valid: boolean): void {
    if (!this.activePieceId) {
      return;
    }

    const piece = this.buildingSystem.getPieceById(this.activePieceId);
    if (!piece) {
      return;
    }

    const y = piece.mesh.position.y + 0.55;
    this.gizmoMesh.position.set(worldX, y, worldZ);
    this.gridSystem.showPositionMarker(worldX, worldZ, valid ? 'valid' : 'invalid');

    if (valid) {
      this.gizmoMat.diffuseColor = new Color3(1, 0.72, 0.2);
      this.gizmoMat.emissiveColor = new Color3(0.5, 0.32, 0.05);
    } else {
      this.gizmoMat.diffuseColor = new Color3(0.95, 0.35, 0.3);
      this.gizmoMat.emissiveColor = new Color3(0.35, 0.08, 0.05);
    }
  }

  private refreshVisuals(): void {
    if (!this.activePieceId) {
      return;
    }

    const piece = this.buildingSystem.getPieceById(this.activePieceId);
    if (!piece) {
      return;
    }

    const current = this.buildingSystem.getPieceWorldPosition(piece);
    const moved =
      Math.abs(this.targetWorldX - current.x) > 0.0005
      || Math.abs(this.targetWorldZ - current.z) > 0.0005;
    const valid = this.buildingSystem.canMovePieceToWorld(
      this.activePieceId,
      this.targetWorldX,
      this.targetWorldZ,
    );

    const y = piece.mesh.position.y + 0.55;
    this.gizmoMesh.position.set(this.targetWorldX, y, this.targetWorldZ);

    if (valid) {
      this.gridSystem.showPositionMarker(
        this.targetWorldX,
        this.targetWorldZ,
        moved ? 'valid' : 'hidden',
      );
    } else {
      this.gridSystem.showPositionMarker(this.targetWorldX, this.targetWorldZ, 'invalid');
    }

    if (moved && valid) {
      this.gizmoMat.diffuseColor = new Color3(1, 0.72, 0.2);
      this.gizmoMat.emissiveColor = new Color3(0.5, 0.32, 0.05);
    } else if (!valid) {
      this.gizmoMat.diffuseColor = new Color3(0.95, 0.35, 0.3);
      this.gizmoMat.emissiveColor = new Color3(0.35, 0.08, 0.05);
    } else {
      this.gizmoMat.diffuseColor = new Color3(0.55, 0.85, 1);
      this.gizmoMat.emissiveColor = new Color3(0.15, 0.35, 0.55);
    }
  }
}
