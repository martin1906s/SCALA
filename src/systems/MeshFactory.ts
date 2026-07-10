import {
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
} from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
import type { MaterialTier } from '@/config/materialCatalog';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getPieceHeight } from '@/domain/materials/MaterialDimensions';
import type { BuildingPiece, PieceRotation, PieceType } from '@/entities/BuildingPiece';
import { applyMeshRotation } from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import type { GridSystem } from '@/systems/GridSystem';
import { createPieceMaterial } from '@/utils/materialFactory';

export class MeshFactory {
  private readonly scene: Scene;
  private readonly grid: GridSystem;

  constructor(scene: Scene, grid: GridSystem) {
    this.scene = scene;
    this.grid = grid;
  }

  createMesh(
    type: PieceType,
    dimensions: MaterialDimensions,
    tier: MaterialTier,
    name: string,
  ): Mesh {
    const mesh = this.buildGeometry(type, dimensions, name);
    mesh.material = createPieceMaterial(this.scene, type, `${name}Mat`, tier, dimensions);
    mesh.isVisible = true;
    mesh.isPickable = true;
    mesh.checkCollisions = false;
    mesh.parent = null;
    mesh.setEnabled(true);
    mesh.refreshBoundingInfo();
    mesh.computeWorldMatrix(true);
    return mesh;
  }

  applyPieceTransform(
    type: PieceType,
    dimensions: MaterialDimensions,
    mesh: AbstractMesh,
    gridX: number,
    gridZ: number,
    gridY: number,
    rotation: PieceRotation,
    offsetX = 0,
    offsetZ = 0,
  ): void {
    const base = this.grid.gridToWorld(gridX, gridZ);
    const y = this.computeWorldY(gridX, gridZ, gridY, type, dimensions);
    mesh.position.set(base.x + offsetX, y, base.z + offsetZ);
    applyMeshRotation(mesh, rotation);
    this.applyDimensionScaling(type, dimensions, mesh);
    mesh.computeWorldMatrix(true);
  }

  applyPreviewScaling(
    type: PieceType,
    dimensions: MaterialDimensions,
    mesh: AbstractMesh,
  ): void {
    this.applyDimensionScaling(type, dimensions, mesh);
  }

  computeWorldY(
    gridX: number,
    gridZ: number,
    gridY: number,
    type: PieceType,
    dimensions: MaterialDimensions,
  ): number {
    const baseY = this.getStackBaseY(gridX, gridZ, gridY);
    return baseY + getPieceHeight(type, dimensions) / 2;
  }

  private getStackBaseY(gridX: number, gridZ: number, gridY: number): number {
    if (gridY === 0) {
      return 0;
    }

    const pieces = useGameStore.getState().pieces;
    let below: BuildingPiece | null = null;
    for (const piece of pieces) {
      if (piece.gridY !== gridY - 1) {
        continue;
      }
      const footprint = piece.footprintCells ?? [];
      const key = `${gridX},${gridZ}`;
      if (footprint.includes(key) || (piece.gridX === gridX && piece.gridZ === gridZ)) {
        if (!below || piece.gridY > below.gridY) {
          below = piece;
        }
      }
    }

    if (!below) {
      return gridY;
    }

    const belowCenterY = this.computeWorldY(
      below.gridX,
      below.gridZ,
      below.gridY,
      below.type,
      below.dimensions,
    );
    return belowCenterY + getPieceHeight(below.type, below.dimensions) / 2;
  }

  private buildGeometry(
    type: PieceType,
    dimensions: MaterialDimensions,
    name: string,
  ): Mesh {
    switch (type) {
      case 'wall': {
        const d = dimensions as { width: number; height: number; depth: number };
        return MeshBuilder.CreateBox(name, {
          width: d.width,
          height: d.height,
          depth: d.depth,
        }, this.scene);
      }
      case 'floor':
      case 'roof': {
        const d = dimensions as { width: number; height: number; depth: number };
        return MeshBuilder.CreateBox(name, {
          width: d.width,
          height: d.height,
          depth: d.depth,
        }, this.scene);
      }
      case 'ramp': {
        const d = dimensions as { width: number; height: number; depth: number };
        const ramp = MeshBuilder.CreateBox(name, {
          width: d.width,
          height: d.height,
          depth: d.depth,
        }, this.scene);
        ramp.rotation.x = -Math.atan2(d.height, d.depth);
        return ramp;
      }
      case 'pillar': {
        const d = dimensions as { diameter: number; height: number };
        return MeshBuilder.CreateCylinder(name, {
          height: d.height,
          diameter: d.diameter,
          tessellation: 32,
          cap: Mesh.CAP_ALL,
        }, this.scene);
      }
      default:
        return MeshBuilder.CreateBox(name, { size: 1 }, this.scene);
    }
  }

  private applyDimensionScaling(
    type: PieceType,
    _dimensions: MaterialDimensions,
    mesh: AbstractMesh,
  ): void {
    if (type === 'ramp') {
      return;
    }
    mesh.scaling.setAll(1);
  }

  createPreviewMaterial(): StandardMaterial {
    const mat = new StandardMaterial('previewMat', this.scene);
    mat.alpha = 0.5;
    mat.specularColor = new Color3(0, 0, 0);
    return mat;
  }

  createPreviewMesh(): Mesh {
    return MeshBuilder.CreateBox('preview', { size: 1 }, this.scene);
  }
}
