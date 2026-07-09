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
            this.dragging = true;
            this.originWorldX = this.targetWorldX;
            this.originWorldZ = this.targetWorldZ;
          }
          break;
        case PointerEventTypes.POINTERMOVE:
          if (this.dragging) {
            this.updateTargetFromPointer();
          }
          break;
        case PointerEventTypes.POINTERUP:
          if (this.dragging) {
            this.dragging = false;
            this.commitMove();
          }
          break;
        default:
          break;
      }
    });

    this.unsubscribe = useGameStore.subscribe(() => this.syncFromStore());
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
      const world = this.buildingSystem.getPieceWorldPosition(piece);
      this.targetWorldX = world.x;
      this.targetWorldZ = world.z;
      this.buildingSystem.realignPiece(selectedPieceId);
    }

    this.refreshVisuals();
  }

  private deactivate(): void {
    if (this.activePieceId) {
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

    const piece = this.buildingSystem.getPieceById(this.activePieceId);
    if (!piece) {
      return false;
    }

    const roundedX = roundPosition(worldX);
    const roundedZ = roundPosition(worldZ);
    const anchor = this.gridSystem.worldToPieceAnchor(roundedX, roundedZ);
    const onRoad = this.gridSystem.isBlockedForBuilding(
      anchor.gridX,
      anchor.gridZ,
      piece.gridY,
    );
    const inBounds = this.gridSystem.isWorldInBounds(roundedX, roundedZ);
    const valid = inBounds && !onRoad;

    if (!valid && commit) {
      this.targetWorldX = this.originWorldX;
      this.targetWorldZ = this.originWorldZ;
      this.buildingSystem.realignPiece(this.activePieceId);
      if (onRoad) {
        GameplayToast.show('No puedes mover piezas a la carretera');
      }
      this.refreshVisuals();
      return false;
    }

    if (!valid) {
      this.refreshVisualsAt(roundedX, roundedZ, false);
      return false;
    }

    this.targetWorldX = roundedX;
    this.targetWorldZ = roundedZ;

    if (!commit) {
      this.buildingSystem.previewPieceWorldPosition(
        this.activePieceId,
        roundedX,
        roundedZ,
      );
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
    }

    this.refreshVisuals();
    return moved;
  }

  private commitMove(): void {
    const piece = this.activePieceId
      ? this.buildingSystem.getPieceById(this.activePieceId)
      : null;
    const roundedX = roundPosition(this.targetWorldX);
    const roundedZ = roundPosition(this.targetWorldZ);
    const anchor = this.gridSystem.worldToPieceAnchor(roundedX, roundedZ);
    const onRoad = piece
      ? this.gridSystem.isBlockedForBuilding(anchor.gridX, anchor.gridZ, piece.gridY)
      : this.gridSystem.isBlockedForBuilding(anchor.gridX, anchor.gridZ, 0);
    const valid = this.gridSystem.isWorldInBounds(roundedX, roundedZ) && !onRoad;

    if (!valid) {
      this.targetWorldX = this.originWorldX;
      this.targetWorldZ = this.originWorldZ;
      if (this.activePieceId) {
        this.buildingSystem.realignPiece(this.activePieceId);
      }
      if (onRoad) {
        GameplayToast.show('No puedes mover piezas a la carretera');
      }
      this.refreshVisuals();
      return;
    }

    this.setTarget(this.targetWorldX, this.targetWorldZ, true);
  }

  private updateTargetFromPointer(): void {
    const pick = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => mesh.name === 'terrain' || mesh.name === 'cellHighlight',
    );

    if (!pick.hit || !pick.pickedPoint) {
      return;
    }

    this.setTarget(pick.pickedPoint.x, pick.pickedPoint.z, false);
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
      this.targetWorldX !== current.x || this.targetWorldZ !== current.z;
    const valid = this.gridSystem.isWorldInBounds(this.targetWorldX, this.targetWorldZ);

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
