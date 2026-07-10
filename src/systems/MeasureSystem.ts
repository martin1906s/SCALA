import {
  Color3,
  CreateLineSystem,
  MeshBuilder,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { LinesMesh, Mesh, Scene } from '@babylonjs/core';
import { prefersReducedMotion } from '@/utils/animations';

export class MeasureSystem {
  private readonly scene: Scene;
  private lineMesh: LinesMesh | null = null;
  private markerA: Mesh | null = null;
  private markerB: Mesh | null = null;
  private markerMat: StandardMaterial | null = null;
  private pointA: { x: number; z: number } | null = null;
  private clearTimer: number | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.createVisuals();
  }

  dispose(): void {
    this.cancelClearTimer();
    this.lineMesh?.dispose();
    this.markerA?.dispose();
    this.markerB?.dispose();
    this.markerMat?.dispose();
    this.lineMesh = null;
    this.markerA = null;
    this.markerB = null;
    this.markerMat = null;
  }

  clear(): void {
    this.cancelClearTimer();
    this.pointA = null;
    this.lineMesh?.setEnabled(false);
    this.markerA?.setEnabled(false);
    this.markerB?.setEnabled(false);
  }

  setPointA(x: number, z: number): void {
    this.cancelClearTimer();
    this.pointA = { x, z };
    this.markerA?.position.set(x, 0.1, z);
    this.markerA?.setEnabled(true);
    this.markerB?.setEnabled(false);
    this.updateLine(x, z, x, z);
  }

  updateCursor(x: number, z: number): void {
    if (!this.pointA) {
      return;
    }
    this.updateLine(this.pointA.x, this.pointA.z, x, z);
  }

  complete(x: number, z: number): void {
    if (!this.pointA) {
      return;
    }
    this.markerB?.position.set(x, 0.1, z);
    this.markerB?.setEnabled(true);
    this.updateLine(this.pointA.x, this.pointA.z, x, z);
    this.pulseMarkers();

    this.cancelClearTimer();
    this.clearTimer = window.setTimeout(() => this.clear(), 6000);
  }

  private createVisuals(): void {
    this.markerMat = new StandardMaterial('measureMarkerMat', this.scene);
    this.markerMat.diffuseColor = new Color3(1, 0.85, 0.2);
    this.markerMat.emissiveColor = new Color3(0.45, 0.32, 0.05);
    this.markerMat.specularColor = Color3.Black();

    this.markerA = MeshBuilder.CreateSphere('measureA', { diameter: 0.18 }, this.scene);
    this.markerA.material = this.markerMat;
    this.markerA.isPickable = false;
    this.markerA.setEnabled(false);

    this.markerB = MeshBuilder.CreateSphere('measureB', { diameter: 0.18 }, this.scene);
    this.markerB.material = this.markerMat;
    this.markerB.isPickable = false;
    this.markerB.setEnabled(false);

    this.lineMesh = CreateLineSystem('measureLine', { lines: [] }, this.scene) as LinesMesh;
    this.lineMesh.color = new Color3(1, 0.82, 0.25);
    this.lineMesh.alpha = 0.95;
    this.lineMesh.isPickable = false;
    this.lineMesh.setEnabled(false);
  }

  private updateLine(ax: number, az: number, bx: number, bz: number): void {
    if (!this.lineMesh) {
      return;
    }

    this.lineMesh.dispose();
    this.lineMesh = CreateLineSystem('measureLine', {
      lines: [[
        new Vector3(ax, 0.12, az),
        new Vector3(bx, 0.12, bz),
      ]],
    }, this.scene) as LinesMesh;
    this.lineMesh.color = new Color3(1, 0.82, 0.25);
    this.lineMesh.alpha = 0.95;
    this.lineMesh.isPickable = false;
    this.lineMesh.setEnabled(true);
  }

  private pulseMarkers(): void {
    const markerA = this.markerA;
    const markerB = this.markerB;
    if (prefersReducedMotion() || !markerA || !markerB) {
      return;
    }

    const start = performance.now();
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - start) / 400;
      if (t >= 1) {
        markerA.scaling.setAll(1);
        markerB.scaling.setAll(1);
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }
      const scale = 1 + Math.sin(t * Math.PI) * 0.35;
      markerA.scaling.setAll(scale);
      markerB.scaling.setAll(scale);
    });
  }

  private cancelClearTimer(): void {
    if (this.clearTimer !== null) {
      window.clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }
}
