import { CameraController } from '@/core/CameraController';
import { SceneManager } from '@/core/SceneManager';
import { BuildingSystem } from '@/systems/BuildingSystem';
import { EconomySystem } from '@/systems/EconomySystem';
import { GridSystem } from '@/systems/GridSystem';
import { InputSystem } from '@/systems/InputSystem';
import { LevelManager } from '@/systems/LevelManager';
import { MoveGizmoSystem } from '@/systems/MoveGizmoSystem';
import { DialogueBox } from '@/ui/DialogueBox';
import { HUD } from '@/ui/HUD';
import { MovePanel } from '@/ui/MovePanel';
import { SelectionPanel } from '@/ui/SelectionPanel';
import { UiToolbar } from '@/ui/UiToolbar';
import { GameplayToast } from '@/ui/GameplayToast';

export class Game {
  private sceneManager: SceneManager | null = null;
  private cameraController: CameraController | null = null;
  private gridSystem: GridSystem | null = null;
  private economySystem: EconomySystem | null = null;
  private buildingSystem: BuildingSystem | null = null;
  private inputSystem: InputSystem | null = null;
  private moveGizmo: MoveGizmoSystem | null = null;
  private hud: HUD | null = null;
  private selectionPanel: SelectionPanel | null = null;
  private movePanel: MovePanel | null = null;
  private uiToolbar: UiToolbar | null = null;
  private dialogueBox: DialogueBox | null = null;
  private levelManager: LevelManager | null = null;
  private started = false;
  private readonly canvas: HTMLCanvasElement;
  private readonly hudRoot: HTMLElement;
  private readonly selectionRoot: HTMLElement;
  private readonly moveRoot: HTMLElement;
  private readonly toolbarRoot: HTMLElement;
  private readonly dialogueRoot: HTMLElement;

  constructor(
    canvas: HTMLCanvasElement,
    hudRoot: HTMLElement,
    selectionRoot: HTMLElement,
    moveRoot: HTMLElement,
    toolbarRoot: HTMLElement,
    dialogueRoot: HTMLElement,
  ) {
    this.canvas = canvas;
    this.hudRoot = hudRoot;
    this.selectionRoot = selectionRoot;
    this.moveRoot = moveRoot;
    this.toolbarRoot = toolbarRoot;
    this.dialogueRoot = dialogueRoot;
  }

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;

    this.sceneManager = new SceneManager();
    const scene = this.sceneManager.init(this.canvas);

    this.cameraController = new CameraController(scene, this.canvas);
    this.gridSystem = new GridSystem(scene);
    this.economySystem = new EconomySystem();
    this.buildingSystem = new BuildingSystem(
      scene,
      this.gridSystem,
      this.economySystem,
    );

    this.moveGizmo = new MoveGizmoSystem(scene, this.gridSystem, this.buildingSystem);
    this.inputSystem = new InputSystem(
      scene,
      this.canvas,
      this.sceneManager.getGroundMesh(),
      this.gridSystem,
      this.buildingSystem,
      this.moveGizmo,
    );

    this.hud = new HUD(this.hudRoot, {
      onUndo: () => this.handleUndo(),
      onRedo: () => this.handleRedo(),
    });

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
    });
    void this.levelManager.start();

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
