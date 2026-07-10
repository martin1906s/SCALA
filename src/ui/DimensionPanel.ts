import type { Blueprint } from '@/config/blueprints';
import { getUnlockedBlueprints } from '@/config/blueprints';
import { TIER_LABELS, type MaterialTier } from '@/config/materialCatalog';
import { DIMENSION_LIMITS } from '@/domain/materials/MaterialDimensions';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
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
  private builtTool: PieceType | null = null;
  private builtBlueprintKey = '';

  constructor(root: HTMLElement, onDimensionsChange?: () => void) {
    this.root = root;
    this.onDimensionsChange = onDimensionsChange;
    this.root.className = 'dimension-panel';

    this.root.innerHTML = `
      <div class="dimension-panel-inner">
        <header class="dimension-header">
          <span class="dimension-header__eyebrow">Taller del gremio</span>
          <h3 class="dimension-title">Materiales</h3>
        </header>
        <section class="dimension-section">
          <span class="dimension-section__label">Calidad</span>
          <div class="dimension-tier" data-tier></div>
        </section>
        <section class="dimension-section">
          <span class="dimension-section__label">Dimensiones</span>
          <div class="dimension-sliders" data-sliders></div>
        </section>
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

    this.bindTierButtons();
    this.bindSliderDelegation();
    blockGamePointer(this.root);

    this.unsubscribe = useGameStore.subscribe((state, prevState) => {
      const changed =
        state.selectedTool !== prevState.selectedTool
        || state.draftDimensions !== prevState.draftDimensions
        || state.draftMaterialTier !== prevState.draftMaterialTier
        || state.uiVisibility !== prevState.uiVisibility
        || state.completedLevel !== prevState.completedLevel
        || state.gameMode !== prevState.gameMode;
      if (changed) {
        this.render();
      }
    });
    this.render();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
    this.root.className = '';
  }

  private bindTierButtons(): void {
    this.tierEl.innerHTML = TIER_OPTIONS.map((tier) => `
      <button type="button" class="dimension-tier-btn" data-tier-btn="${tier}">
        ${TIER_LABELS[tier]}
      </button>
    `).join('');

    this.tierEl.querySelectorAll<HTMLButtonElement>('[data-tier-btn]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const tier = btn.dataset.tierBtn as MaterialTier;
        useGameStore.getState().setDraftMaterialTier(tier);
        this.onDimensionsChange?.();
      });
    });
  }

  private bindSliderDelegation(): void {
    this.slidersEl.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.type !== 'range' || !input.dataset.dimKey) {
        return;
      }

      event.stopPropagation();

      const state = useGameStore.getState();
      const tool = state.selectedTool;
      if (!BUILD_PIECE_TYPES.includes(tool as PieceType)) {
        return;
      }

      const type = tool as PieceType;
      const key = input.dataset.dimKey;
      const value = Number(input.value);
      useGameStore.getState().setDraftDimension(type, key, value);

      const valEl = this.slidersEl.querySelector(`[data-dim-val="${key}"]`);
      if (valEl) {
        valEl.textContent = `${value.toFixed(2)} m`;
      }

      this.updateCostDisplay(type, useGameStore.getState().getDraftForTool(type), state.draftMaterialTier);
      this.onDimensionsChange?.();
    });
  }

  private render(): void {
    const state = useGameStore.getState();
    const tool = state.selectedTool;
    const { uiVisibility } = state;

    const isBuildTool = BUILD_PIECE_TYPES.includes(tool as PieceType);
    const hidden = !uiVisibility.dimensions || !isBuildTool;
    this.root.classList.toggle('dimension-panel--hidden', hidden);
    this.root.toggleAttribute('inert', hidden);
    this.root.setAttribute('aria-hidden', hidden ? 'true' : 'false');

    if (!isBuildTool) {
      this.builtTool = null;
      return;
    }

    const type = tool as PieceType;
    const dims = state.draftDimensions[type];

    if (this.builtTool !== type) {
      this.buildSliders(type, dims);
      this.builtTool = type;
    } else {
      this.syncSliderValues(dims);
    }

    this.tierEl.querySelectorAll<HTMLButtonElement>('[data-tier-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tierBtn === state.draftMaterialTier);
    });

    this.updateCostDisplay(type, dims, state.draftMaterialTier);
    this.renderBlueprintsIfNeeded(state.completedLevel, state.gameMode);
  }

  private buildSliders(type: PieceType, dims: MaterialDimensions): void {
    const limits = DIMENSION_LIMITS[type];
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
  }

  private syncSliderValues(dims: MaterialDimensions): void {
    this.slidersEl.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input) => {
      const key = input.dataset.dimKey;
      if (!key) {
        return;
      }
      const value = (dims as unknown as Record<string, number>)[key];
      if (value !== undefined && Number(input.value) !== value) {
        input.value = String(value);
        const valEl = this.slidersEl.querySelector(`[data-dim-val="${key}"]`);
        if (valEl) {
          valEl.textContent = `${value.toFixed(2)} m`;
        }
      }
    });
  }

  private updateCostDisplay(
    type: PieceType,
    dims: MaterialDimensions,
    tier: MaterialTier,
  ): void {
    const breakdown = computePriceBreakdown(type, dims, tier);
    this.costEl.innerHTML = `
      <div class="dimension-cost__item">
        <span>Área</span>
        <strong>${breakdown.areaCost}</strong>
      </div>
      <div class="dimension-cost__item">
        <span>Volumen</span>
        <strong>+${breakdown.volumeSurcharge}</strong>
      </div>
      <div class="dimension-cost__item dimension-cost__item--total">
        <span>Total estimado</span>
        <strong><span data-cost-total>${breakdown.total}</span> monedas</strong>
      </div>
    `;

    const totalEl = this.costEl.querySelector('[data-cost-total]');
    if (totalEl) {
      animateCounter(totalEl as HTMLElement, breakdown.total);
    }
  }

  private renderBlueprintsIfNeeded(completedLevel: number, gameMode: string): void {
    const key = `${completedLevel}|${gameMode}`;
    if (key === this.builtBlueprintKey) {
      return;
    }
    this.builtBlueprintKey = key;

    const blueprints = getUnlockedBlueprints(
      completedLevel,
      gameMode === 'sandbox',
    );

    this.blueprintsEl.innerHTML = blueprints.map((bp) => `
      <button type="button" class="dimension-blueprint-btn" data-bp="${bp.id}">
        ${bp.name}
      </button>
    `).join('');

    this.blueprintsEl.querySelectorAll<HTMLButtonElement>('[data-bp]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
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
    this.builtTool = null;
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
