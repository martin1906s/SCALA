import type { ToolMode } from '@/entities/BuildingPiece';
import { PIECE_COSTS } from '@/config/gameConfig';
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
  delete: 'Borrar',
  select: 'Seleccionar',
};

const TOOL_TOOLTIPS: Record<ToolMode, string> = {
  wall: 'Colocar muro (tecla 1)',
  floor: 'Colocar suelo (tecla 2)',
  pillar: 'Colocar columna (tecla 3)',
  delete: 'Borrar pieza (tecla 4)',
  select: 'Seleccionar bloque (tecla 5)',
};

const TOOL_COST_LABELS: Partial<Record<ToolMode, string>> = {
  wall: `${PIECE_COSTS.wall} monedas`,
  floor: `${PIECE_COSTS.floor} monedas`,
  pillar: `${PIECE_COSTS.pillar} monedas`,
};

export class HUD {
  private readonly budgetEl: HTMLElement;
  private readonly toolEl: HTMLElement;
  private readonly panelEl: HTMLElement;
  private readonly missionEl: HTMLElement;
  private readonly missionTitleEl: HTMLElement;
  private readonly missionTaglineEl: HTMLElement;
  private readonly missionBarEl: HTMLElement;
  private readonly missionCountEl: HTMLElement;
  private readonly undoBtn: HTMLButtonElement;
  private readonly redoBtn: HTMLButtonElement;
  private readonly toolButtons: Map<ToolMode, HTMLButtonElement>;
  private unsubscribe: (() => void) | null = null;
  private readonly root: HTMLElement;
  private readonly actions: HudActions;
  private lastBudget = -1;
  private lastMissionDone = -1;

  constructor(root: HTMLElement, actions: HudActions) {
    this.root = root;
    this.actions = actions;
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-mission" data-mission hidden>
        <div class="hud-mission__header">
          <span class="hud-mission__label">Reto activo</span>
          <span class="hud-mission__count" data-mission-count></span>
        </div>
        <p class="hud-mission__title" data-mission-title></p>
        <p class="hud-mission__tagline" data-mission-tagline></p>
        <div class="hud-mission__bar" aria-hidden="true">
          <span class="hud-mission__fill" data-mission-bar></span>
        </div>
      </div>
      <div class="hud-panel" data-panel>
        <div class="hud-row">
          <span class="hud-label">Presupuesto</span>
          <span class="hud-budget" data-budget></span>
        </div>
        <div class="hud-row">
          <span class="hud-label">Herramienta</span>
          <span class="hud-tool" data-tool></span>
        </div>
        <div class="hud-history">
          <button type="button" class="hud-history-btn" data-undo>↶ Deshacer</button>
          <button type="button" class="hud-history-btn" data-redo>↷ Rehacer</button>
        </div>
        <div class="hud-toolbar" data-toolbar></div>
        <p class="hud-hint">4 = borrar · 5 = seleccionar · Ctrl+Z / Ctrl+Y historial</p>
      </div>
    `;

    this.missionEl = this.root.querySelector('[data-mission]')!;
    this.missionTitleEl = this.root.querySelector('[data-mission-title]')!;
    this.missionTaglineEl = this.root.querySelector('[data-mission-tagline]')!;
    this.missionBarEl = this.root.querySelector('[data-mission-bar]')!;
    this.missionCountEl = this.root.querySelector('[data-mission-count]')!;
    this.panelEl = this.root.querySelector('[data-panel]')!;
    this.budgetEl = this.root.querySelector('[data-budget]')!;
    this.toolEl = this.root.querySelector('[data-tool]')!;
    this.undoBtn = this.root.querySelector('[data-undo]')!;
    this.redoBtn = this.root.querySelector('[data-redo]')!;
    const toolbar = this.root.querySelector('[data-toolbar]')!;

    this.undoBtn.addEventListener('click', () => this.actions.onUndo());
    this.redoBtn.addEventListener('click', () => this.actions.onRedo());
    attachTooltip(this.undoBtn, 'Deshacer (Ctrl+Z)', 'bottom');
    attachTooltip(this.redoBtn, 'Rehacer (Ctrl+Y)', 'bottom');

    this.toolButtons = new Map();
    (Object.keys(TOOL_LABELS) as ToolMode[]).forEach((tool) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hud-btn';
      button.dataset.tool = tool;

      const cost = TOOL_COST_LABELS[tool];
      button.textContent = cost ? `${TOOL_LABELS[tool]} (${cost})` : TOOL_LABELS[tool];

      button.addEventListener('click', () => {
        useGameStore.getState().setTool(tool);
      });

      attachTooltip(button, TOOL_TOOLTIPS[tool], 'bottom');

      toolbar.appendChild(button);
      this.toolButtons.set(tool, button);
    });

    blockGamePointer(this.panelEl);
    blockGamePointer(this.missionEl);

    this.unsubscribe = useGameStore.subscribe((state) => {
      this.render(state);
    });

    this.render(useGameStore.getState());
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
    this.budgetEl.textContent = `${state.budget} monedas`;
    this.toolEl.textContent = TOOL_LABELS[state.selectedTool];

    if (state.budget !== this.lastBudget) {
      pulseElement(this.budgetEl);
      this.lastBudget = state.budget;
    }

    if (state.mission) {
      this.missionEl.hidden = false;
      this.missionTitleEl.textContent = state.mission.title;
      this.missionTaglineEl.textContent = state.mission.tagline;
      this.missionCountEl.textContent = `${state.mission.done}/${state.mission.total}`;
      const ratio = state.mission.total > 0
        ? (state.mission.done / state.mission.total) * 100
        : 0;
      this.missionBarEl.style.width = `${ratio}%`;
      this.missionEl.classList.toggle('is-complete', state.mission.done === state.mission.total);

      if (state.mission.done !== this.lastMissionDone) {
        pulseElement(this.missionEl, 'is-mission-pulse');
        this.lastMissionDone = state.mission.done;
      }
    } else {
      this.missionEl.hidden = true;
      this.lastMissionDone = -1;
    }

    for (const [tool, button] of this.toolButtons) {
      button.classList.toggle('is-active', tool === state.selectedTool);
    }

    this.root.classList.toggle('hud--select-active', state.selectedTool === 'select');
    this.panelEl.classList.toggle('is-hidden', !state.uiVisibility.tools);

    this.undoBtn.classList.toggle('is-disabled', !state.canUndo);
    this.redoBtn.classList.toggle('is-disabled', !state.canRedo);
    void state.historyRevision;
  }
}
