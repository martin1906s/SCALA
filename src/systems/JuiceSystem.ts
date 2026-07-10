import { Color3 } from '@babylonjs/core';
import type { AbstractMesh, Scene } from '@babylonjs/core';
import type { MaterialTier } from '@/config/materialCatalog';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getVolume } from '@/config/materialCatalog';
import type { PieceType } from '@/entities/BuildingPiece';
import type { CameraController } from '@/core/CameraController';
import { SoundManager } from '@/audio/SoundManager';
import { useGameStore } from '@/store/gameStore';
import { GameplayToast } from '@/ui/GameplayToast';
import { prefersReducedMotion } from '@/utils/animations';

export interface PlaceJuiceEvent {
  type: PieceType;
  dimensions: MaterialDimensions;
  tier: MaterialTier;
  cost: number;
  footprintCellCount: number;
  mesh: AbstractMesh;
}

const COMBO_WINDOW_MS = 2800;
const COMBO_TOAST_AT = [3, 5, 8, 12];

export class JuiceSystem {
  private readonly scene: Scene;
  private readonly camera: CameraController;
  private readonly sound = new SoundManager();
  private budgetEl: HTMLElement | null = null;
  private lastPlaceAt = 0;

  constructor(scene: Scene, camera: CameraController) {
    this.scene = scene;
    this.camera = camera;
  }

  setBudgetElement(el: HTMLElement): void {
    this.budgetEl = el;
  }

  ensureAudio(): void {
    this.sound.ensureReady();
  }

  dispose(): void {
    this.sound.dispose();
  }

  onPlace(event: PlaceJuiceEvent): void {
    this.sound.ensureReady();
    const heavy = event.footprintCellCount >= 4 || event.cost >= 150;
    this.sound.play(heavy ? 'placeHeavy' : 'place');

    this.playPlaceBounce(event.mesh, event.type, event.dimensions, event.footprintCellCount);
    this.playPlaceFlash(event.mesh, event.tier);

    const now = performance.now();
    let streak: number;
    if (now - this.lastPlaceAt < COMBO_WINDOW_MS) {
      streak = useGameStore.getState().bumpPlacementStreak();
    } else {
      useGameStore.getState().resetPlacementStreak();
      streak = useGameStore.getState().bumpPlacementStreak();
    }
    this.lastPlaceAt = now;

    if (COMBO_TOAST_AT.includes(streak)) {
      this.sound.play('combo');
      GameplayToast.show(`¡Combo x${streak}! Ritmo de maestro`);
    }

    if (heavy) {
      this.shakeUi();
    }
  }

  onInvalidPlace(): void {
    this.sound.ensureReady();
    this.sound.play('invalid');
    useGameStore.getState().resetPlacementStreak();
    this.shakeUi(0.3);
  }

  onSell(refund: number, budgetEl?: HTMLElement): void {
    if (refund <= 0) {
      return;
    }
    this.sound.ensureReady();
    this.sound.play('sell');

    const el = budgetEl ?? this.budgetEl;
    if (el && !prefersReducedMotion()) {
      el.classList.remove('hud-budget--gain');
      void el.offsetWidth;
      el.classList.add('hud-budget--gain');
    }
  }

  onObjectiveComplete(intensity: 'objective' | 'victory' = 'objective'): void {
    this.sound.ensureReady();
    this.sound.play(intensity === 'victory' ? 'victory' : 'objective');
    this.camera.celebrate(intensity);
  }

  onMeasure(): void {
    this.sound.ensureReady();
    this.sound.play('measure');
  }

  private playPlaceFlash(mesh: AbstractMesh, tier: MaterialTier): void {
    if (prefersReducedMotion()) {
      return;
    }

    const material = mesh.material as { emissiveColor?: Color3 } | null;
    if (!material?.emissiveColor) {
      return;
    }

    const base = material.emissiveColor.clone();
    const flash = tier === 'marble'
      ? new Color3(0.55, 0.5, 0.7)
      : tier === 'stone'
        ? new Color3(0.35, 0.4, 0.45)
        : new Color3(0.45, 0.28, 0.08);

    const start = performance.now();
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - start) / 220;
      if (t >= 1) {
        material.emissiveColor!.copyFrom(base);
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }
      Color3.LerpToRef(base, flash, Math.sin(t * Math.PI), material.emissiveColor!);
    });
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

      const ease = 1 - Math.pow(1 - t, 2);
      const bounce = Math.sin(ease * Math.PI) * 0.12 * weight * (1 - ease);
      const squash = 1 + Math.sin(ease * Math.PI) * 0.05 * weight;
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
