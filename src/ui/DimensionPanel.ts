import type { Blueprint } from '@/config/blueprints';
import { getUnlockedBlueprints } from '@/config/blueprints';
import { TIER_LABELS, type MaterialTier } from '@/config/materialCatalog';
import { DIMENSION_LIMITS } from '@/domain/materials/MaterialDimensions';
import { computePriceBreakdown } from '@/domain/materials/PricingEngine';
import { BUILD_PIECE_TYPES, type PieceType } from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import { blockGamePointer } from '@/utils/blockGamePointer';
import { animateCounter } from '@/utils/animations';

const TIER_OPTIONS: MaterialTier[] = ['wood', 'stone', 'marble'];

export class DimensionPanel {
  private readonly root: HTMLElement;
  private readonly slidersEl: HTMLElement;
  private readonly costEl: HTMLElement;
  private readonly tierEl: HTMLElement;
  private readonly blueprintsEl: HTMLElement;
  private readonly warningEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private readonly onDimensionsChange?: () => void;
  private lastRenderKey = '';

  constructor(root: HTMLElement, onDimensionsChange?: () => void) {
    this.root = root;
    this.onDimensionsChange = onDimensionsChange;
    this.root.className = 'dimension-panel';

    this.root.innerHTML = `
      <div class="dimension-panel-inner">
        <h3 class="dimension-title">Taller de materiales</h3>
        <div class="dimension-tier" data-tier></div>
        <div class="dimension-sliders" data-sliders></div>
        <div class="dimension-cost" data-cost></div>
        <p class="dimension-warning" data-warning hidden></p>
        <div class="dimension-blueprints" data-blueprints>
          <span class="dimension-label">Plantillas</span>
          <div class="dimension-blueprint-list" data-blueprint-list></div>
        </div>
      </div>
    `;

    this.slidersEl = this.root.querySelector('[data-sliders]')!;
    this.costEl = this.root.querySelector('[data-cost]')!;
    this.tierEl = this.root.querySelector('[data-tier]')!;
    this.blueprintsEl = this.root.querySelector('[data-blueprint-list]')!;
    this.warningEl = this.root.querySelector('[data-warning]')!;

    this.renderTierButtons();
    blockGamePointer(this.root);
    this.unsubscribe = useGameStore.subscribe((state, prevState) => {
      const keys: Array<keyof typeof state> = [
        'selectedTool',
        'draftDimensions',
        'draftMaterialTier',
        'uiVisibility',
        'completedLevel',
        'gameMode',
      ];
      if (keys.every((key) => state[key] === prevState[key])) {
        return;
      }
      this.render();
    });
    this.render();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
    this.root.className = '';
  }

  private renderTierButtons(): void {
    this.tierEl.innerHTML = TIER_OPTIONS.map((tier) => `
      <button type="button" class="dimension-tier-btn" data-tier-btn="${tier}">
        ${TIER_LABELS[tier]}
      </button>
    `).join('');

    this.tierEl.querySelectorAll<HTMLButtonElement>('[data-tier-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tier = btn.dataset.tierBtn as MaterialTier;
        useGameStore.getState().setDraftMaterialTier(tier);
        this.onDimensionsChange?.();
      });
    });
  }

  private render(): void {
    const state = useGameStore.getState();
    const tool = state.selectedTool;
    const { uiVisibility } = state;

    const isBuildTool = BUILD_PIECE_TYPES.includes(tool as PieceType);
    this.root.classList.toggle(
      'dimension-panel--hidden',
      !uiVisibility.dimensions || !isBuildTool,
    );

    if (!isBuildTool) {
      return;
    }

    const type = tool as PieceType;
    const dims = state.draftDimensions[type];

    const renderKey = JSON.stringify({
      tool,
      dims,
      tier: state.draftMaterialTier,
      visible: uiVisibility.dimensions,
      completedLevel: state.completedLevel,
      gameMode: state.gameMode,
    });
    if (renderKey === this.lastRenderKey) {
      return;
    }
    this.lastRenderKey = renderKey;

    const limits = DIMENSION_LIMITS[type];

    this.tierEl.querySelectorAll<HTMLButtonElement>('[data-tier-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tierBtn === state.draftMaterialTier);
    });

    this.slidersEl.innerHTML = Object.entries(limits).map(([key, limit]) => {
      const value = (dims as unknown as Record<string, number>)[key] ?? limit.min;
      return `
        <label class="dimension-slider">
          <span class="dimension-slider__label">${this.labelForKey(key)}</span>
          <input type="range" min="${limit.min}" max="${limit.max}" step="0.25"
            value="${value}" data-dim-key="${key}" />
          <span class="dimension-slider__value" data-dim-val="${key}">${value.toFixed(2)} m</span>
        </label>
      `;
    }).join('');

    this.slidersEl.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.dimKey!;
        const value = Number(input.value);
        useGameStore.getState().setDraftDimension(type, key, value);
        const valEl = this.slidersEl.querySelector(`[data-dim-val="${key}"]`);
        if (valEl) {
          valEl.textContent = `${value.toFixed(2)} m`;
        }
        this.onDimensionsChange?.();
      });
    });

    const breakdown = computePriceBreakdown(type, dims, state.draftMaterialTier);
    this.costEl.innerHTML = `
      <span>Área: <strong>${breakdown.areaCost}</strong></span>
      <span>Volumen: <strong>+${breakdown.volumeSurcharge}</strong></span>
      <span>Total: <strong data-cost-total>${breakdown.total}</strong> monedas</span>
    `;

    const totalEl = this.costEl.querySelector('[data-cost-total]');
    if (totalEl) {
      animateCounter(totalEl as HTMLElement, breakdown.total);
    }

    this.renderBlueprints();
  }

  private renderBlueprints(): void {
    const state = useGameStore.getState();
    const blueprints = getUnlockedBlueprints(
      state.completedLevel,
      state.gameMode === 'sandbox',
    );

    this.blueprintsEl.innerHTML = blueprints.map((bp) => `
      <button type="button" class="dimension-blueprint-btn" data-bp="${bp.id}">
        ${bp.name}
      </button>
    `).join('');

    this.blueprintsEl.querySelectorAll<HTMLButtonElement>('[data-bp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bp = blueprints.find((b) => b.id === btn.dataset.bp);
        if (bp) {
          this.applyBlueprint(bp);
        }
      });
    });
  }

  private applyBlueprint(bp: Blueprint): void {
    const store = useGameStore.getState();
    store.setTool(bp.type);
    store.setDraftDimensions(bp.type, bp.dimensions);
    store.setDraftMaterialTier(bp.tier);
    this.onDimensionsChange?.();
  }

  showWarning(message: string | null): void {
    if (!message) {
      this.warningEl.hidden = true;
      this.warningEl.textContent = '';
      return;
    }
    this.warningEl.hidden = false;
    this.warningEl.textContent = `⚠ ${message}`;
  }

  private labelForKey(key: string): string {
    const labels: Record<string, string> = {
      width: 'Ancho',
      height: 'Alto',
      depth: 'Profundo',
      diameter: 'Diámetro',
    };
    return labels[key] ?? key;
  }
}
