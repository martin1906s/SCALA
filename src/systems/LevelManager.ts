import { LEVELS } from '@/config/levels';
import type { LevelDefinition } from '@/config/levels';
import type { BuildingPiece } from '@/entities/BuildingPiece';
import type { CameraController } from '@/core/CameraController';
import type { BuildingSystem } from '@/systems/BuildingSystem';
import type { GridSystem } from '@/systems/GridSystem';
import { computeStars, evaluateObjectives } from '@/systems/objectiveEvaluator';
import { useGameStore } from '@/store/gameStore';
import type { DialogueBox } from '@/ui/DialogueBox';
import { Confetti } from '@/ui/Confetti';
import { ObjectiveToast } from '@/ui/ObjectiveToast';

interface LevelManagerDeps {
  camera: CameraController;
  building: BuildingSystem;
  grid: GridSystem;
}

export class LevelManager {
  private readonly dialogue: DialogueBox;
  private readonly camera: CameraController;
  private readonly building: BuildingSystem;
  private readonly grid: GridSystem;
  private levelIndex = 0;
  private level: LevelDefinition;
  private unsubscribe: (() => void) | null = null;
  private completed = false;
  private started = false;
  private completedObjectiveIds = new Set<string>();

  constructor(dialogue: DialogueBox, deps: LevelManagerDeps) {
    this.dialogue = dialogue;
    this.camera = deps.camera;
    this.building = deps.building;
    this.grid = deps.grid;
    this.level = LEVELS[0]!;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.completedObjectiveIds.clear();
    this.grid.applyLevelLayout(this.level.id);

    const store = useGameStore.getState();
    store.setBudget(this.level.budget);
    store.setMission({
      title: this.level.name,
      tagline: this.level.tagline,
      done: 0,
      total: this.level.objectives.length,
    });

    await this.dialogue.playLines('intro', this.level.name, this.level.intro, this.level.tagline);

    this.dialogue.showObjectives(this.level.name, this.level.tagline, this.computeProgress([]));
    this.unsubscribe = useGameStore.subscribe((state) => {
      this.onGameStateChanged(state.pieces, state.budget);
    });
    this.onGameStateChanged(store.pieces, store.budget);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.dialogue.hide();
    this.started = false;
    this.completed = false;
    this.completedObjectiveIds.clear();
    useGameStore.getState().setMission(null);
  }

  private onGameStateChanged(pieces: BuildingPiece[], budget: number): void {
    if (this.completed) return;

    const progress = this.computeProgress(pieces, budget);
    this.dialogue.updateObjectives(progress);
    this.syncMission(progress);

    for (const objective of progress) {
      if (objective.done && !this.completedObjectiveIds.has(objective.id)) {
        this.completedObjectiveIds.add(objective.id);
        ObjectiveToast.show(`¡Reto cumplido! ${objective.text}`);
        Confetti.burst('normal');
        this.camera.celebrate('objective');
      }
    }

    if (progress.every((obj) => obj.done)) {
      void this.completeLevel(budget);
    }
  }

  private syncMission(progress: ReturnType<typeof this.computeProgress>): void {
    const done = progress.filter((obj) => obj.done).length;
    useGameStore.getState().setMission({
      title: this.level.name,
      tagline: this.level.tagline,
      done,
      total: progress.length,
    });
  }

  private computeProgress(pieces: BuildingPiece[], budget = useGameStore.getState().budget) {
    return evaluateObjectives(
      this.level.objectives,
      pieces,
      budget,
      (gx, gz) => this.grid.isBlockedForBuilding(gx, gz),
    ).map((result) => ({
      id: result.id,
      text: result.text,
      current: result.current,
      target: result.target,
      done: result.done,
      progressLabel: result.progressLabel,
    }));
  }

  private async completeLevel(budget: number): Promise<void> {
    this.completed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;

    const stars = computeStars(true, budget, this.level.budget);
    Confetti.burst('epic');
    this.camera.celebrate('victory');

    await this.dialogue.playLines(
      'victory',
      '¡Nivel completado!',
      this.level.victory,
      this.level.tagline,
    );

    const hasNext = this.levelIndex < LEVELS.length - 1;
    const action = await this.dialogue.showVictoryScreen({
      levelName: this.level.name,
      stars,
      hasNext,
      isFinal: !hasNext,
    });

    if (action === 'next' && hasNext) {
      await this.loadNextLevel();
      return;
    }

    if (action === 'replay') {
      await this.restartLevel();
      return;
    }

    this.dialogue.showObjectives(
      this.level.name,
      this.level.tagline,
      this.computeProgress(useGameStore.getState().pieces),
    );
  }

  private async loadNextLevel(): Promise<void> {
    this.levelIndex += 1;
    this.level = LEVELS[this.levelIndex]!;
    await this.restartLevel();
  }

  private async restartLevel(): Promise<void> {
    this.dialogue.hide();
    this.building.clearAllPieces();
    useGameStore.getState().reset();
    this.completed = false;
    this.started = false;
    this.completedObjectiveIds.clear();
    await this.start();
  }
}
