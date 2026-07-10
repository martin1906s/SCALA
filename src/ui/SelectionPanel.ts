import type { BuildingSystem } from '@/systems/BuildingSystem';
import { PIECE_COLORS } from '@/config/gameConfig';
import {
  BUILD_PIECE_TYPES,
  PIECE_TYPE_LABELS,
  type PieceType,
} from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import { blockGamePointer } from '@/utils/blockGamePointer';
import { attachTooltip } from '@/ui/tooltip';
import { rgbToCss } from '@/utils/colorUtils';
import { GameplayToast } from '@/ui/GameplayToast';

const BUILD_TOOLS: PieceType[] = BUILD_PIECE_TYPES;

export class SelectionPanel {
  private readonly root: HTMLElement;
  private readonly previewEl: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly stripEl: HTMLElement;
  private readonly actionsEl: HTMLElement;
  private unsubscribe: (() => void) | null = null;
  private readonly buildingSystem: BuildingSystem;
  private readonly onRotate?: () => void;

  constructor(
    root: HTMLElement,
    buildingSystem: BuildingSystem,
    onRotate?: () => void,
  ) {
    this.root = root;
    this.buildingSystem = buildingSystem;
    this.onRotate = onRotate;
    this.root.className = 'selection-panel';

    this.root.innerHTML = `
      <div class="selection-panel-inner">
        <div class="selection-strip" data-strip>
          <button type="button" class="selection-arrow" data-rotate-dir="-1" aria-label="Girar izquierda">
            ‹
          </button>
          <div class="selection-material">
            <div class="selection-preview" data-preview></div>
            <div class="selection-title" data-title>Material</div>
          </div>
          <button type="button" class="selection-arrow" data-rotate-dir="1" aria-label="Girar derecha">
            ›
          </button>
        </div>
        <div class="selection-actions" data-actions hidden>
          <button type="button" class="selection-action" data-action="duplicate">Duplicar (D)</button>
          <button type="button" class="selection-action" data-action="sell">Vender (V)</button>
          <button type="button" class="selection-action" data-action="copy">Copiar tipo (C)</button>
        </div>
      </div>
    `;

    this.stripEl = this.root.querySelector('[data-strip]')!;
    this.actionsEl = this.root.querySelector('[data-actions]')!;
    this.previewEl = this.root.querySelector('[data-preview]')!;
    this.titleEl = this.root.querySelector('[data-title]')!;

    this.bindActions();
    this.root.querySelectorAll<HTMLButtonElement>('[data-rotate-dir]').forEach((button) => {
      const direction = button.dataset.rotateDir === '-1' ? 'izquierda' : 'derecha';
      attachTooltip(button, `Girar material a la ${direction}`, 'top');
    });
    blockGamePointer(this.root);
    this.unsubscribe = useGameStore.subscribe(() => this.render());

    this.render();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
    this.root.className = '';
  }

  private bindActions(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-rotate-dir]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const direction = Number(button.dataset.rotateDir) as 1 | -1;
        this.rotate('y', direction);
      });
    });

    this.actionsEl.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.action;
        const state = useGameStore.getState();
        if (!state.selectedPieceId) return;

        if (action === 'duplicate') {
          if (this.buildingSystem.duplicatePiece(state.selectedPieceId)) {
            GameplayToast.show('Pieza duplicada');
          } else {
            GameplayToast.show('No hay espacio para duplicar');
          }
        } else if (action === 'sell') {
          if (this.buildingSystem.sellPiece(state.selectedPieceId)) {
            state.setSelectedPiece(null);
            GameplayToast.show('Pieza vendida');
          }
        } else if (action === 'copy') {
          const piece = this.buildingSystem.getPieceById(state.selectedPieceId);
          if (piece) {
            state.setTool(piece.type);
            state.setDraftDimensions(piece.type, piece.dimensions);
            state.setDraftMaterialTier(piece.materialTier);
            state.setPreviewRotation(piece.rotation);
            GameplayToast.show('Tipo y dimensiones copiados');
          }
        }
        this.render();
      });
    });
  }

  private rotate(axis: 'x' | 'y' | 'z', direction: 1 | -1): void {
    const state = useGameStore.getState();

    if (state.selectedPieceId) {
      this.buildingSystem.rotatePiece(state.selectedPieceId, axis, direction);
      this.buildingSystem.updateHighlights(state.hoveredPieceId, state.selectedPieceId);
      this.render();
      return;
    }

    if (BUILD_TOOLS.includes(state.selectedTool as PieceType)) {
      state.rotatePreview(axis, direction);
      this.onRotate?.();
      this.render();
    }
  }

  private render(): void {
    const state = useGameStore.getState();
    const { selectedTool, selectedPieceId, previewRotation, uiVisibility } = state;

    this.root.classList.toggle('selection-panel--hidden', !uiVisibility.rotation);
    this.root.toggleAttribute('inert', !uiVisibility.rotation);
    this.root.setAttribute('aria-hidden', uiVisibility.rotation ? 'false' : 'true');

    if (selectedPieceId) {
      const piece = this.buildingSystem.getPieceById(selectedPieceId);
      if (piece) {
        const color = piece.customColor ?? PIECE_COLORS[piece.type];
        this.previewEl.style.background = rgbToCss(color);
        this.previewEl.className = `selection-preview selection-preview--${piece.type}`;
        this.titleEl.textContent = PIECE_TYPE_LABELS[piece.type];
        this.stripEl.classList.add('selection-strip--active');
        this.actionsEl.hidden = false;
        return;
      }
    }

    this.actionsEl.hidden = true;

    if (BUILD_TOOLS.includes(selectedTool as PieceType)) {
      const type = selectedTool as PieceType;
      const color = PIECE_COLORS[type];
      this.previewEl.style.background = rgbToCss(color);
      this.previewEl.className = `selection-preview selection-preview--${type}`;
      this.titleEl.textContent = PIECE_TYPE_LABELS[type];
      this.stripEl.classList.add('selection-strip--active');
      void previewRotation;
      return;
    }

    this.previewEl.style.background = 'rgba(255,255,255,0.15)';
    this.previewEl.className = 'selection-preview selection-preview--idle';
    this.titleEl.textContent = 'Sin material';
    this.stripEl.classList.remove('selection-strip--active');
  }
}
