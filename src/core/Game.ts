import { CameraController } from '@/core/CameraController';
import { SceneManager } from '@/core/SceneManager';
import { BuildingSystem } from '@/systems/BuildingSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { EconomySystem } from '@/systems/EconomySystem';
import { GridSystem } from '@/systems/GridSystem';
import { InputSystem } from '@/systems/InputSystem';
import { JuiceSystem } from '@/systems/JuiceSystem';
import { LevelManager } from '@/systems/LevelManager';
import { MeasureSystem } from '@/systems/MeasureSystem';
import { MeshFactory } from '@/systems/MeshFactory';
import { MoveGizmoSystem } from '@/systems/MoveGizmoSystem';
import { StructuralIntegritySystem } from '@/systems/StructuralIntegritySystem';
import { DialogueBox } from '@/ui/DialogueBox';
import { DimensionPanel } from '@/ui/DimensionPanel';
import { HUD } from '@/ui/HUD';
import { MovePanel } from '@/ui/MovePanel';
import { SelectionPanel } from '@/ui/SelectionPanel';
import { UiToolbar } from '@/ui/UiToolbar';
import { GameplayToast } from '@/ui/GameplayToast';
import type { GameMode } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';
import { loadSave } from '@/utils/progressStorage';
import { tryLockLandscape } from '@/utils/orientation';

export class Game {
  private sceneManager: SceneManager | null = null;
  private cameraController: CameraController | null = null;
  private gridSystem: GridSystem | null = null;
  private economySystem: EconomySystem | null = null;
  private buildingSystem: BuildingSystem | null = null;
  private inputSystem: InputSystem | null = null;
  private moveGizmo: MoveGizmoSystem | null = null;
  private measureSystem: MeasureSystem | null = null;
  private juiceSystem: JuiceSystem | null = null;
  private hud: HUD | null = null;
  private selectionPanel: SelectionPanel | null = null;
  private dimensionPanel: DimensionPanel | null = null;
  private movePanel: MovePanel | null = null;
  private uiToolbar: UiToolbar | null = null;
  private dialogueBox: DialogueBox | null = null;
  private levelManager: LevelManager | null = null;
  private started = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly hudRoot: HTMLElement;
  private readonly selectionRoot: HTMLElement;
  private readonly dimensionRoot: HTMLElement;
  private readonly moveRoot: HTMLElement;
  private readonly toolbarRoot: HTMLElement;
  private readonly dialogueRoot: HTMLElement;
  private readonly gameMode: GameMode;
  private readonly startLevelIndex: number;

  constructor(
    canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
    selectionRoot: HTMLElement,
    dimensionRoot: HTMLElement,
    moveRoot: HTMLElement,
    toolbarRoot: HTMLElement,
    dialogueRoot: HTMLElement,
    gameMode: GameMode = 'campaign',
    startLevelIndex = 0,
  ) {
    this.canvas = canvas;
    this.hudRoot = hudRoot;
    this.selectionRoot = selectionRoot;
    this.dimensionRoot = dimensionRoot;
    this.moveRoot = moveRoot;
    this.toolbarRoot = toolbarRoot;
    this.dialogueRoot = dialogueRoot;
    this.gameMode = gameMode;
    this.startLevelIndex = startLevelIndex;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    const save = loadSave();
    useGameStore.getState().setCompletedLevel(save.maxCompletedLevel);
    for (const [levelId, stars] of Object.entries(save.stars)) {
      useGameStore.getState().setLevelStars(Number(levelId), stars);
    }

    useGameStore.getState().setGameMode(this.gameMode);
    if (this.gameMode === 'sandbox') {
      useGameStore.getState().setBudget(999_999);
    }

    this.sceneManager = new SceneManager();
    const scene = this.sceneManager.init(this.canvas);

    this.cameraController = new CameraController(scene, this.canvas);
    this.gridSystem = new GridSystem(scene);
    this.economySystem = new EconomySystem();
    const collisionSystem = new CollisionSystem(this.gridSystem);
    const meshFactory = new MeshFactory(scene, this.gridSystem);
    this.juiceSystem = new JuiceSystem(scene, this.cameraController);
    const integritySystem = new StructuralIntegritySystem(collisionSystem);
    this.measureSystem = new MeasureSystem(scene);

    this.buildingSystem = new BuildingSystem(
      scene,
      this.gridSystem,
      this.economySystem,
      collisionSystem,
      meshFactory,
      this.juiceSystem,
      integritySystem,
    );

    this.moveGizmo = new MoveGizmoSystem(scene, this.gridSystem, this.buildingSystem);

    this.hud = new HUD(this.hudRoot, {
      onUndo: () => this.handleUndo(),
      onRedo: () => this.handleRedo(),
    });
    this.juiceSystem.setBudgetElement(this.hud.getBudgetElement());
    this.buildingSystem.setBudgetElement(this.hud.getBudgetElement());

    this.dimensionPanel = new DimensionPanel(
      this.dimensionRoot,
      () => this.inputSystem?.refreshPreviewIfBuilding(),
    );

    this.inputSystem = new InputSystem(
      scene,
      this.canvas,
      this.sceneManager.getGroundMesh(),
      this.gridSystem,
      this.buildingSystem,
      this.moveGizmo,
      {
        onStructuralWarning: (message) => this.dimensionPanel?.showWarning(message),
        measureSystem: this.measureSystem,
        onMeasureSound: () => this.juiceSystem?.onMeasure(),
      },
    );

    this.buildingSystem.onHistoryChange(() => this.hud?.refreshHistory());
    this.selectionPanel = new SelectionPanel(
      this.selectionRoot,
      this.buildingSystem,
      () => this.inputSystem?.refreshPreviewIfBuilding(),
    );
    this.movePanel = new MovePanel(this.moveRoot, this.moveGizmo);
    this.uiToolbar = new UiToolbar(this.toolbarRoot);

    this.dialogueBox = new DialogueBox(this.dialogueRoot);
    this.levelManager = new LevelManager(this.dialogueBox, {
      camera: this.cameraController,
      building: this.buildingSystem,
      grid: this.gridSystem,
      juice: this.juiceSystem,
      gameMode: this.gameMode,
      startLevelIndex: this.gameMode === 'campaign' ? this.startLevelIndex : undefined,
    });
    void this.levelManager.start();

    this.canvas.addEventListener('pointerdown', () => {
      this.juiceSystem?.ensureAudio();
      void tryLockLandscape();
    }, { once: true });

    this.sceneManager.startRenderLoop();
  }

  private handleUndo(): void {
    if (!this.buildingSystem?.undoLastAction()) {
      GameplayToast.show('Nada que deshacer');
      return;
    }
    this.inputSystem?.syncAfterHistory();
    GameplayToast.show('Acción deshecha');
  }

  private handleRedo(): void {
    if (!this.buildingSystem?.redoLastAction()) {
      GameplayToast.show('Nada que rehacer');
      return;
    }
    this.inputSystem?.syncAfterHistory();
    GameplayToast.show('Acción rehecha');
  }

  destroy(): void {
    this.inputSystem?.dispose();
    this.inputSystem = null;

    this.moveGizmo?.dispose();
    this.moveGizmo = null;

    this.measureSystem?.dispose();
    this.measureSystem = null;

    this.juiceSystem?.dispose();
    this.juiceSystem = null;

    this.dimensionPanel?.dispose();
    this.dimensionPanel = null;

    this.selectionPanel?.dispose();
    this.selectionPanel = null;

    this.movePanel?.dispose();
    this.movePanel = null;

    this.uiToolbar?.dispose();
    this.uiToolbar = null;

    this.levelManager?.dispose();
    this.levelManager = null;

    this.dialogueBox?.dispose();
    this.dialogueBox = null;

    this.hud?.dispose();
    this.hud = null;

    this.buildingSystem?.dispose();
    this.buildingSystem = null;

    this.gridSystem?.dispose();
    this.gridSystem = null;

    this.cameraController?.dispose();
    this.cameraController = null;

    this.sceneManager?.dispose();
    this.sceneManager = null;

    this.economySystem = null;
    this.started = false;
  }
}
