import { Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

/**
 * Coordenadas del puntero en píxeles CSS relativos al canvas.
 * Babylon 9 InputManager hace exactamente esto (scene.inputManager.js):
 *   pointerX = evt.clientX - canvasRect.left
 * createPickingRay aplica hardwareScalingLevel internamente (x * levelInv).
 */
export function pointerCssCoords(
  scene: Scene,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = scene.getEngine().getInputElementClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/** Espacio de picking interno (para comparar con Vector3.Project). */
export function pointerPickCoords(
  scene: Scene,
  cssX: number,
  cssY: number,
): { x: number; y: number } {
  const levelInv = 1 / scene.getEngine().getHardwareScalingLevel();
  return { x: cssX * levelInv, y: cssY * levelInv };
}

/** Punto en el plano del suelo (y=0) bajo el cursor. */
export function pickGroundPlane(
  scene: Scene,
  cssX: number,
  cssY: number,
  planeY = 0,
): Vector3 | null {
  const camera = scene.activeCamera;
  if (!camera) {
    return null;
  }

  const ray = scene.createPickingRay(cssX, cssY, null, camera, false);
  const dirY = ray.direction.y;
  if (Math.abs(dirY) < 1e-8) {
    return null;
  }

  const t = (planeY - ray.origin.y) / dirY;
  if (t < 0) {
    return null;
  }

  return ray.origin.add(ray.direction.scale(t));
}
