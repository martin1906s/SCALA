import { LEVELS } from '@/config/levels';
import type { LevelDefinition } from '@/config/levels';
import type { BuildingPiece } from '@/entities/BuildingPiece';
import type { CameraController } from '@/core/CameraController';
import type { BuildingSystem } from '@/systems/BuildingSystem';
import type { GridSystem } from '@/systems/GridSystem';
import type { JuiceSystem } from '@/systems/JuiceSystem';
import type { GameMode } from '@/store/gameStore';
import { computeStars, evaluateObjectives } from '@/systems/objectiveEvaluator';
import { useGameStore } from '@/store/gameStore';
import type { DialogueBox } from '@/ui/DialogueBox';
import { Confetti } from '@/ui/Confetti';
import { ObjectiveToast } from '@/ui/ObjectiveToast';
import { persistLevelStars, persistMaxCompleted } from '@/utils/progressStorage';

interface LevelManagerDeps {
  camera: CameraController;
  building: BuildingSystem;
  grid: GridSystem;
  juice: JuiceSystem;
  gameMode: GameMode;
  startLevelIndex?: number;
}

export class LevelManager {
  private readonly dialogue: DialogueBox;
  private readonly building: BuildingSystem;
  private readonly grid: GridSystem;
  private readonly juice: JuiceSystem;
  private readonly gameMode: GameMode;
  private levelIndex = 0;
  private level: LevelDefinition;
  private unsubscribe: (() => void) | null = null;
  private completed = false;
  private started = false;
  /** Estado previo de cada objetivo para detectar transiciones (evita toast al cargar). */
  private objectiveDoneSnapshot = new Map<string, boolean>();

  constructor(dialogue: DialogueBox, deps: LevelManagerDeps) {
    this.dialogue = dialogue;
    this.building = deps.building;
    this.grid = deps.grid;
    this.juice = deps.juice;
    this.gameMode = deps.gameMode;
    this.levelIndex = deps.startLevelIndex ?? 0;
    this.level = LEVELS[this.levelIndex] ?? LEVELS[0]!;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (this.gameMode === 'sandbox') {
      this.grid.applyLevelLayout(1);
      useGameStore.getState().setBudget(999_999);
      useGameStore.getState().setMission(null);
      await this.dialogue.playLines(
        'intro',
        'Modo libre',
        [
          'Bienvenido al taller sin límites del gremio SCALA.',
          'Ajusta dimensiones, elige materiales y construye a tu gusto.',
          'Teclas 1–7 herramientas · M para medir · plantillas en el panel derecho.',
        ],
        'Sandbox · Sin restricciones',
      );
      return;
    }

    this.objectiveDoneSnapshot.clear();
    this.grid.applyLevelLayout(this.level.id);

    const store = useGameStore.getState();
    store.setBudget(this.level.budget);
    store.setMission({
      title: this.level.name,
      tagline: this.level.tagline,
      done: 0,
      total: this.level.objectives.length,
      objectives: this.computeProgress([]),
    });

    await this.dialogue.playLines('intro', this.level.name, this.level.intro, this.level.tagline);

    this.dialogue.showObjectives(this.level.name, this.level.tagline, this.computeProgress([]));

    this.seedObjectiveSnapshot(store.pieces, store.budget);

    this.unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (state.pieces === prevState.pieces && state.budget === prevState.budget) {
        return;
      }
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
    this.objectiveDoneSnapshot.clear();
    useGameStore.getState().setMission(null);
  }

  private onGameStateChanged(pieces: BuildingPiece[], budget: number): void {
    if (this.completed || this.gameMode === 'sandbox') return;

    const progress = this.computeProgress(pieces, budget);
    this.dialogue.updateObjectives(progress);
    this.syncMission(progress);

    for (const objective of progress) {
      const wasDone = this.objectiveDoneSnapshot.get(objective.id) ?? false;
      if (objective.done && !wasDone) {
        ObjectiveToast.show(`¡Reto cumplido! ${objective.text}`);
        Confetti.burst('normal');
        this.juice.onObjectiveComplete('objective');
      }
      this.objectiveDoneSnapshot.set(objective.id, objective.done);
    }

    if (progress.every((obj) => obj.done)) {
      void this.completeLevel(budget);
    }
  }

  private syncMission(progress: ReturnType<typeof this.computeProgress>): void {
    const done = progress.filter((obj) => obj.done).length;
    const total = progress.length;
    const current = useGameStore.getState().mission;
    const sameObjectives = current?.objectives.length === progress.length
      && current.objectives.every((obj, i) => {
        const next = progress[i];
        return next
          && obj.id === next.id
          && obj.done === next.done
          && obj.progressLabel === next.progressLabel;
      });

    if (
      current &&
      current.done === done &&
      current.total === total &&
      current.title === this.level.name &&
      current.tagline === this.level.tagline &&
      sameObjectives
    ) {
      return;
    }

    useGameStore.getState().setMission({
      title: this.level.name,
      tagline: this.level.tagline,
      done,
      total,
      objectives: progress,
    });
  }

  private seedObjectiveSnapshot(pieces: BuildingPiece[], budget: number): void {
    this.objectiveDoneSnapshot.clear();
    for (const objective of this.computeProgress(pieces, budget)) {
      this.objectiveDoneSnapshot.set(objective.id, objective.done);
    }
  }

  private computeProgress(pieces: BuildingPiece[], budget = useGameStore.getState().budget) {
    return evaluateObjectives(
      this.level.objectives,
      pieces,
      budget,
      (gx, gz) => this.grid.isBlockedForBuilding(gx, gz),
      this.level.budget,
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

    useGameStore.getState().setCompletedLevel(this.level.id);
    const stars = computeStars(true, budget, this.level.budget);
    persistMaxCompleted(this.level.id);
    persistLevelStars(this.level.id, stars);
    useGameStore.getState().setLevelStars(this.level.id, stars);
    Confetti.burst('epic');
    this.juice.onObjectiveComplete('victory');

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
    this.objectiveDoneSnapshot.clear();
    await this.start();
  }
}
