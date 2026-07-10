import type { AbstractMesh, Scene } from '@babylonjs/core';
import type { MaterialTier } from '@/config/materialCatalog';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getVolume } from '@/config/materialCatalog';
import type { PieceType } from '@/entities/BuildingPiece';
import type { CameraController } from '@/core/CameraController';
import { prefersReducedMotion } from '@/utils/animations';

export interface PlaceJuiceEvent {
  type: PieceType;
  dimensions: MaterialDimensions;
  tier: MaterialTier;
  cost: number;
  footprintCellCount: number;
  mesh: AbstractMesh;
}

export class JuiceSystem {
  private readonly scene: Scene;
  private readonly camera: CameraController;

  constructor(scene: Scene, camera: CameraController) {
    this.scene = scene;
    this.camera = camera;
  }

  onPlace(event: PlaceJuiceEvent): void {
    this.playPlaceBounce(event.mesh, event.type, event.dimensions, event.footprintCellCount);
    if (event.footprintCellCount >= 4 || event.cost >= 150) {
      this.shakeUi();
    }
  }

  onInvalidPlace(): void {
    this.shakeUi(0.3);
  }

  onSell(refund: number, budgetEl?: HTMLElement): void {
    if (refund > 0 && budgetEl && !prefersReducedMotion()) {
      budgetEl.classList.remove('hud-budget--gain');
      void budgetEl.offsetWidth;
      budgetEl.classList.add('hud-budget--gain');
    }
  }

  onObjectiveComplete(intensity: 'objective' | 'victory' = 'objective'): void {
    this.camera.celebrate(intensity);
  }

  private playPlaceBounce(
    mesh: AbstractMesh,
    type: PieceType,
    dimensions: MaterialDimensions,
    footprintCells: number,
  ): void {
    if (prefersReducedMotion()) {
      return;
    }

    const volume = getVolume(type, dimensions);
    const weight = Math.min(2, 0.8 + volume * 0.15 + footprintCells * 0.08);
    const baseY = mesh.position.y;
    const baseScale = mesh.scaling.clone();
    const start = performance.now();
    const duration = 280 + weight * 80;

    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) {
        mesh.position.y = baseY;
        mesh.scaling.copyFrom(baseScale);
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }

      const bounce = Math.sin(t * Math.PI) * 0.12 * weight * (1 - t);
      const squash = 1 + Math.sin(t * Math.PI) * 0.05 * weight;
      mesh.position.y = baseY + bounce;
      mesh.scaling.set(
        baseScale.x * squash,
        baseScale.y / squash,
        baseScale.z * squash,
      );
    });
  }

  private shakeUi(intensity = 0.5): void {
    if (prefersReducedMotion()) {
      return;
    }
    const layer = document.getElementById('ui-layer');
    if (!layer) {
      return;
    }
    layer.style.setProperty('--shake-intensity', String(intensity));
    layer.classList.remove('ui-shake');
    void layer.offsetWidth;
    layer.classList.add('ui-shake');
    window.setTimeout(() => layer.classList.remove('ui-shake'), 350);
  }
}
