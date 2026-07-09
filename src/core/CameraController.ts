import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { CAMERA } from '@/config/gameConfig';

export class CameraController {
  readonly camera: ArcRotateCamera;
  private celebrationObserver: { remove: () => void } | null = null;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    const target = Vector3.Zero();

    this.camera = new ArcRotateCamera(
      'camera',
      CAMERA.alpha,
      CAMERA.beta,
      CAMERA.radius,
      target,
      scene,
    );

    this.camera.lowerRadiusLimit = CAMERA.minRadius;
    this.camera.upperRadiusLimit = CAMERA.maxRadius;
    this.camera.lowerBetaLimit = CAMERA.lowerBeta;
    this.camera.upperBetaLimit = CAMERA.upperBeta;
    this.camera.panningSensibility = 0;
    this.camera.wheelPrecision = 20;

    this.camera.attachControl(canvas, true);
    scene.activeCamera = this.camera;
  }

  celebrate(intensity: 'objective' | 'victory' = 'objective'): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.celebrationObserver?.remove();
    const baseRadius = this.camera.radius;
    const baseBeta = this.camera.beta;
    const start = performance.now();
    const duration = intensity === 'victory' ? 1400 : 700;
    const radiusBoost = intensity === 'victory' ? 2.8 : 1.2;
    const betaShift = intensity === 'victory' ? -0.08 : -0.04;

    const scene = this.camera.getScene();
    this.celebrationObserver = scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) {
        this.camera.radius = baseRadius;
        this.camera.beta = baseBeta;
        this.celebrationObserver?.remove();
        this.celebrationObserver = null;
        return;
      }

      const wave = Math.sin(t * Math.PI);
      this.camera.radius = baseRadius + wave * radiusBoost;
      this.camera.beta = baseBeta + wave * betaShift;
    });
  }

  dispose(): void {
    this.celebrationObserver?.remove();
    this.celebrationObserver = null;
    this.camera.dispose();
  }
}
