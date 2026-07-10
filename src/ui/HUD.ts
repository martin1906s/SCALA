import { BUILD_PIECE_TYPES, type ToolMode } from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import { attachTooltip } from '@/ui/tooltip';
import { blockGamePointer } from '@/utils/blockGamePointer';
import { pulseElement } from '@/utils/animations';

interface HudActions {
  onUndo: () => void;
  onRedo: () => void;
}

const TOOL_LABELS: Record<ToolMode, string> = {
  wall: 'Muro',
  floor: 'Suelo',
  pillar: 'Columna',
  roof: 'Techo',
  ramp: 'Rampa',
  delete: 'Borrar',
  select: 'Seleccionar',
};

const TOOL_TOOLTIPS: Record<ToolMode, string> = {
  wall: 'Colocar muro (tecla 1)',
  floor: 'Colocar suelo (tecla 2)',
  pillar: 'Colocar columna (tecla 3)',
  roof: 'Colocar techo (tecla 6)',
  ramp: 'Colocar rampa (tecla 7)',
  delete: 'Borrar pieza (tecla 4)',
  select: 'Seleccionar bloque (tecla 5)',
};

const HUD_TOOLS: ToolMode[] = [
  'wall', 'floor', 'pillar', 'roof', 'ramp', 'delete', 'select',
];

const TOOL_SHORT: Record<ToolMode, string> = {
  wall: 'M',
  floor: 'S',
  pillar: 'C',
  roof: 'T',
  ramp: 'R',
  delete: '✕',
  select: '◎',
};

export class HUD {
  private readonly budgetEl: HTMLElement;
  private readonly toolEl: HTMLElement;
  private readonly costEl: HTMLElement;
  private readonly panelEl: HTMLElement;
  private readonly missionEl: HTMLElement;
  private readonly missionToggleEl: HTMLButtonElement;
  private readonly missionTitleEl: HTMLElement;
  private readonly missionTaglineEl: HTMLElement;
  private readonly missionBarEl: HTMLElement;
  private readonly missionCountEl: HTMLElement;
  private readonly missionObjectivesEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly toolButtons: Map<ToolMode, HTMLButtonElement>;
  private unsubscribe: (() => void) | null = null;
  private readonly root: HTMLElement;
  private readonly actions: HudActions;
  private lastBudget = -1;
  private lastMissionDone = -1;
  private lastMissionTitle = '';
  private missionExpanded = false;

  constructor(root: HTMLElement, actions: HudActions) {
    this.root = root;
    this.actions = actions;
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-mission" data-mission hidden>
        <button
          type="button"
          class="hud-mission__toggle"
          data-mission-toggle
          aria-expanded="false"
          aria-controls="hud-mission-body"
        >
          <span class="hud-mission__summary">
            <span class="hud-mission__header">
              <span class="hud-mission__label">Reto activo</span>
              <span class="hud-mission__count" data-mission-count></span>
            </span>
            <span class="hud-mission__title" data-mission-title></span>
          </span>
          <span class="hud-mission__chevron" aria-hidden="true">▾</span>
        </button>
        <div class="hud-mission__body" id="hud-mission-body" data-mission-body>
          <p class="hud-mission__tagline" data-mission-tagline></p>
          <div class="hud-mission__bar" aria-hidden="true">
            <span class="hud-mission__fill" data-mission-bar></span>
          </div>
          <ul class="hud-mission__objectives" data-mission-objectives hidden></ul>
        </div>
      </div>
      <div class="hud-panel" data-panel>
        <div class="hud-stats">
          <div class="hud-stat hud-stat--budget">
            <span class="hud-label">Presupuesto</span>
            <span class="hud-budget" data-budget></span>
          </div>
          <div class="hud-stat hud-stat--tool">
            <span class="hud-label">Herramienta</span>
            <span class="hud-tool" data-tool></span>
          </div>
          <div class="hud-stat hud-stat--cost">
            <span class="hud-label">Costo</span>
            <span class="hud-cost" data-cost></span>
          </div>
        </div>
        <div class="hud-actions-row">
          <div class="hud-history">
            <button type="button" class="hud-history-btn" data-undo aria-label="Deshacer">
              <span class="hud-history-btn__icon" aria-hidden="true">↶</span>
              <span class="hud-history-btn__text">Deshacer</span>
            </button>
            <button type="button" class="hud-history-btn" data-redo aria-label="Rehacer">
              <span class="hud-history-btn__icon" aria-hidden="true">↷</span>
              <span class="hud-history-btn__text">Rehacer</span>
            </button>
          </div>
          <div class="hud-toolbar" data-toolbar></div>
        </div>
        <p class="hud-hint" data-hud-hint>M = medir · 6/7 techo/rampa · Ctrl+Z historial</p>
      </div>
    `;

    this.missionEl = this.root.querySelector('[data-mission]')!;
    this.missionToggleEl = this.root.querySelector('[data-mission-toggle]') as HTMLButtonElement;
    this.missionTitleEl = this.root.querySelector('[data-mission-title]')!;
    this.missionTaglineEl = this.root.querySelector('[data-mission-tagline]')!;
    this.missionBarEl = this.root.querySelector('[data-mission-bar]')!;
    this.missionCountEl = this.root.querySelector('[data-mission-count]')!;
    this.missionObjectivesEl = this.root.querySelector('[data-mission-objectives]')!;
    this.hintEl = this.root.querySelector('[data-hud-hint]')!;
    this.panelEl = this.root.querySelector('[data-panel]')!;
    this.budgetEl = this.root.querySelector('[data-budget]')!;
    this.toolEl = this.root.querySelector('[data-tool]')!;
    this.costEl = this.root.querySelector('[data-cost]')!;
    this.undoBtn = this.root.querySelector('[data-undo]')!;
    this.redoBtn = this.root.querySelector('[data-redo]')!;
    const toolbar = this.root.querySelector('[data-toolbar]')!;

    this.undoBtn.addEventListener('click', () => this.actions.onUndo());
    this.redoBtn.addEventListener('click', () => this.actions.onRedo());
    attachTooltip(this.undoBtn, 'Deshacer (Ctrl+Z)', 'bottom');
    attachTooltip(this.redoBtn, 'Rehacer (Ctrl+Y)', 'bottom');

    this.toolButtons = new Map();
    HUD_TOOLS.forEach((tool) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hud-btn';
      button.dataset.tool = tool;
      button.innerHTML = `
        <span class="hud-btn__short" aria-hidden="true">${TOOL_SHORT[tool]}</span>
        <span class="hud-btn__label">${TOOL_LABELS[tool]}</span>
      `;
      button.addEventListener('click', () => {
        useGameStore.getState().setTool(tool);
      });
      attachTooltip(button, TOOL_TOOLTIPS[tool], 'bottom');
      toolbar.appendChild(button);
      this.toolButtons.set(tool, button);
    });

    blockGamePointer(this.panelEl);
    blockGamePointer(this.missionEl);

    this.missionToggleEl.addEventListener('click', () => {
      this.missionExpanded = !this.missionExpanded;
      this.syncMissionExpanded();
    });

    this.unsubscribe = useGameStore.subscribe((state) => {
      this.render(state);
    });

    this.render(useGameStore.getState());
  }

  getBudgetElement(): HTMLElement {
    return this.budgetEl;
  }

  refreshHistory(): void {
    this.render(useGameStore.getState());
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
    this.root.className = '';
  }

  private render(state: ReturnType<typeof useGameStore.getState>): void {
    const isSandbox = state.gameMode === 'sandbox';
    this.budgetEl.textContent = isSandbox ? '∞ libre' : `${state.budget} monedas`;
    this.toolEl.textContent = TOOL_LABELS[state.selectedTool];

    const canAfford = isSandbox || state.budget >= state.estimatedCost;
    this.costEl.textContent = BUILD_PIECE_TYPES.includes(state.selectedTool as typeof BUILD_PIECE_TYPES[number])
      ? (isSandbox ? 'Gratis' : `${state.estimatedCost} monedas`)
      : '—';
    this.costEl.classList.toggle('hud-cost--expensive', !canAfford && !isSandbox);

    if (state.budget !== this.lastBudget) {
      pulseElement(this.budgetEl);
      this.lastBudget = state.budget;
    }

    if (state.mission) {
      this.missionEl.hidden = false;
      if (state.mission.title !== this.lastMissionTitle) {
        this.lastMissionTitle = state.mission.title;
        this.missionExpanded = false;
      }
      this.missionTitleEl.textContent = state.mission.title;
      this.missionTaglineEl.textContent = state.mission.tagline;
      this.missionCountEl.textContent = `${state.mission.done}/${state.mission.total}`;
      const ratio = state.mission.total > 0
        ? (state.mission.done / state.mission.total) * 100
        : 0;
      this.missionBarEl.style.width = `${ratio}%`;
      this.missionEl.classList.toggle('is-complete', state.mission.done === state.mission.total);

      if (state.mission.objectives.length > 0) {
        this.missionObjectivesEl.hidden = false;
        this.missionObjectivesEl.innerHTML = state.mission.objectives.map((obj) => `
          <li class="hud-objective ${obj.done ? 'hud-objective--done' : ''}">
            <span class="hud-objective__icon">${obj.done ? '✓' : '○'}</span>
            <span class="hud-objective__text">${obj.text}</span>
            <span class="hud-objective__progress">${obj.progressLabel}</span>
          </li>
        `).join('');
      } else {
        this.missionObjectivesEl.hidden = true;
      }

      if (state.mission.done !== this.lastMissionDone) {
        pulseElement(this.missionEl, 'is-mission-pulse');
        this.lastMissionDone = state.mission.done;
      }

      this.syncMissionExpanded();
    } else {
      this.missionEl.hidden = true;
      this.missionObjectivesEl.hidden = true;
      this.lastMissionDone = -1;
      this.lastMissionTitle = '';
      this.missionExpanded = false;
      this.syncMissionExpanded();
    }

    this.root.classList.toggle('hud--measuring', state.measurementActive);
    this.hintEl.textContent = state.measurementActive
      ? '📏 Medición activa: clic A → clic B · M para salir'
      : 'M = medir · 6/7 techo/rampa · Ctrl+Z historial';

    for (const [tool, button] of this.toolButtons) {
      button.classList.toggle('is-active', tool === state.selectedTool);
    }

    this.root.classList.toggle('hud--select-active', state.selectedTool === 'select');
    const toolsHidden = !state.uiVisibility.tools;
    this.panelEl.classList.toggle('is-hidden', toolsHidden);
    this.panelEl.toggleAttribute('inert', toolsHidden);
    this.panelEl.setAttribute('aria-hidden', toolsHidden ? 'true' : 'false');

    this.undoBtn.classList.toggle('is-disabled', !state.canUndo);
    this.redoBtn.classList.toggle('is-disabled', !state.canRedo);
    void state.historyRevision;
  }

  private syncMissionExpanded(): void {
    this.missionEl.classList.toggle('is-expanded', this.missionExpanded);
    this.missionToggleEl.setAttribute('aria-expanded', String(this.missionExpanded));
  }
}
