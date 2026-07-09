import { Matrix, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, Scene, Viewport } from '@babylonjs/core';
import type { BuildingPiece } from '@/entities/BuildingPiece';
import type { BuildingSystem } from '@/systems/BuildingSystem';
import { useGameStore } from '@/store/gameStore';
import { pointerPickCoords } from '@/utils/pointerCoords';

interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Raycast exclusivo sobre piezas colocadas (ignora suelo y carretera).
 */
export class PiecePicker {
  private readonly scene: Scene;
  private readonly buildingSystem: BuildingSystem;

  constructor(scene: Scene, buildingSystem: BuildingSystem) {
    this.scene = scene;
    this.buildingSystem = buildingSystem;
  }

  pick(cssX: number, cssY: number): BuildingPiece | null {
    if (useGameStore.getState().pieces.length === 0) {
      return null;
    }

    const byRay = this.pickByMeshRaycast(cssX, cssY);
    if (byRay) {
      return byRay;
    }

    const pickCoords = pointerPickCoords(this.scene, cssX, cssY);
    return this.pickByScreenSpace(pickCoords.x, pickCoords.y);
  }

  pickFromMesh(mesh: AbstractMesh | null | undefined): BuildingPiece | null {
    if (!mesh || !this.buildingSystem.isBuildingMesh(mesh)) {
      return null;
    }
    return this.buildingSystem.getPieceByMesh(mesh);
  }

  private pickByMeshRaycast(screenX: number, screenY: number): BuildingPiece | null {
    const picks = this.scene.multiPick(
      screenX,
      screenY,
      (mesh) => this.buildingSystem.isBuildingMesh(mesh),
    );

    if (!picks || picks.length === 0) {
      return null;
    }

    for (const pick of picks) {
      if (!pick.pickedMesh) {
        continue;
      }
      const piece = this.buildingSystem.getPieceByMesh(pick.pickedMesh);
      if (piece) {
        return piece;
      }
    }

    return null;
  }

  private pickByScreenSpace(screenX: number, screenY: number): BuildingPiece | null {
    const camera = this.scene.activeCamera;
    const engine = this.scene.getEngine();
    if (!camera) {
      return null;
    }

    const viewport = camera.viewport.toGlobal(
      engine.getRenderWidth(),
      engine.getRenderHeight(),
    );
    const transform = this.scene.getTransformMatrix();

    let best: { piece: BuildingPiece; dist: number } | null = null;

    for (const piece of useGameStore.getState().pieces) {
      piece.mesh.computeWorldMatrix(true);

      const center = this.getMeshScreenCenter(piece.mesh, transform, viewport);
      if (!center || center.z < 0 || center.z > 1) {
        continue;
      }

      const radius = this.getMeshScreenRadius(piece.mesh, transform, viewport, center);
      const dist = Math.hypot(center.x - screenX, center.y - screenY);
      if (dist > radius) {
        continue;
      }

      if (!best || dist < best.dist) {
        best = { piece, dist };
      }
    }

    return best?.piece ?? null;
  }

  private getMeshScreenCenter(
    mesh: AbstractMesh,
    transform: Matrix,
    viewport: Viewport,
  ): ScreenPoint & { z: number } | null {
    const worldMatrix = mesh.getWorldMatrix();
    const localCenter = mesh.getBoundingInfo().boundingBox.center;
    const projected = Vector3.Project(
      localCenter,
      worldMatrix,
      transform,
      viewport,
    );

    return { x: projected.x, y: projected.y, z: projected.z };
  }

  private getMeshScreenRadius(
    mesh: AbstractMesh,
    transform: Matrix,
    viewport: Viewport,
    center: ScreenPoint,
  ): number {
    const worldMatrix = mesh.getWorldMatrix();
    const localCenter = mesh.getBoundingInfo().boundingBox.center;
    const extend = mesh.getBoundingInfo().boundingBox.extendSize;
    const localCorner = localCenter.add(extend);
    const projected = Vector3.Project(
      localCorner,
      worldMatrix,
      transform,
      viewport,
    );

    const radius = Math.hypot(projected.x - center.x, projected.y - center.y);
    return Math.max(radius + 10, 24);
  }
}
