import type { MoveGizmoSystem } from '@/systems/MoveGizmoSystem';
import { FREE_MOVE_STEP } from '@/config/gameConfig';
import { useGameStore } from '@/store/gameStore';
import { blockGamePointer } from '@/utils/blockGamePointer';
import { attachTooltip } from '@/ui/tooltip';

type MoveDirection = 'up' | 'down' | 'left' | 'right';

const MOVE_DELTA: Record<MoveDirection, { dx: number; dz: number }> = {
  up: { dx: 0, dz: -FREE_MOVE_STEP },
  down: { dx: 0, dz: FREE_MOVE_STEP },
  left: { dx: -FREE_MOVE_STEP, dz: 0 },
  right: { dx: FREE_MOVE_STEP, dz: 0 },
};

export class MovePanel {
  private readonly root: HTMLElement;
  private readonly moveGizmo: MoveGizmoSystem;
  private unsubscribe: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(root: HTMLElement, moveGizmo: MoveGizmoSystem) {
    this.root = root;
    this.moveGizmo = moveGizmo;
    this.root.className = 'move-panel move-panel--hidden';

    this.root.innerHTML = `
      <div class="move-panel-inner">
        <p class="move-panel-label">Mover material</p>
        <div class="move-pad">
          <button type="button" class="move-btn move-btn--up" data-move="up" aria-label="Mover arriba">▲</button>
          <button type="button" class="move-btn move-btn--left" data-move="left" aria-label="Mover izquierda">◀</button>
          <button type="button" class="move-btn move-btn--center" disabled aria-hidden="true">▣</button>
          <button type="button" class="move-btn move-btn--right" data-move="right" aria-label="Mover derecha">▶</button>
          <button type="button" class="move-btn move-btn--down" data-move="down" aria-label="Mover abajo">▼</button>
        </div>
        <p class="move-panel-hint">Arrastra el cubo naranja · Flechas: 0,001 u</p>
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
      const dir = button.dataset.move as MoveDirection;
      attachTooltip(button, `Mover ${dir} (0,001)`, 'top');
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.move(dir);
      });
    });

    blockGamePointer(this.root);
    this.unsubscribe = useGameStore.subscribe(() => this.render());
    this.render();
  }

  dispose(): void {
    this.detachKeys();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
    this.root.className = '';
  }

  private render(): void {
    const { selectedPieceId, selectedTool } = useGameStore.getState();
    const visible = selectedTool === 'select' && selectedPieceId !== null;
    this.root.classList.toggle('move-panel--hidden', !visible);

    if (visible) {
      this.attachKeys();
    } else {
      this.detachKeys();
    }
  }

  private move(direction: MoveDirection): void {
    const state = useGameStore.getState();
    if (!state.selectedPieceId) return;

    const delta = MOVE_DELTA[direction];
    this.moveGizmo.moveBy(delta.dx, delta.dz);
  }

  private attachKeys(): void {
    if (this.keyHandler) return;

    this.keyHandler = (e: KeyboardEvent) => {
      const state = useGameStore.getState();
      if (state.dialogueBlocking || state.selectedTool !== 'select' || !state.selectedPieceId) {
        return;
      }

      const keyMap: Record<string, MoveDirection> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };

      const direction = keyMap[e.key];
      if (!direction) return;

      e.preventDefault();
      e.stopPropagation();
      this.move(direction);
    };

    window.addEventListener('keydown', this.keyHandler, true);
  }

  private detachKeys(): void {
    if (!this.keyHandler) return;
    window.removeEventListener('keydown', this.keyHandler, true);
    this.keyHandler = null;
  }
}
