import type { UiPanel } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';
import { blockGamePointer } from '@/utils/blockGamePointer';
import { attachTooltip } from '@/ui/tooltip';

const PANELS: { id: UiPanel; label: string; tooltip: string; icon: string }[] = [
  {
    id: 'tools',
    label: 'Herramientas',
    tooltip: 'Mostrar u ocultar panel de herramientas',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm0 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>',
  },
  {
    id: 'rotation',
    label: 'Girar material',
    tooltip: 'Mostrar u ocultar panel para girar material',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.3 0 6 2.7 6 6 0 1-.3 2-.8 2.8l1.5 1.5A7.9 7.9 0 0 0 20 12c0-4.4-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6 0-1 .3-2 .8-2.8L5.3 7.7A7.9 7.9 0 0 0 4 12c0 4.4 3.6 8 8 8v3l4-4-4-4v3z"/></svg>',
  },
];

export class UiToolbar {
  private readonly root: HTMLElement;
  private readonly buttons = new Map<UiPanel, HTMLButtonElement>();
  private unsubscribe: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'ui-toolbar';

    PANELS.forEach(({ id, tooltip, icon }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-toolbar-btn';
      button.dataset.panel = id;
      button.innerHTML = icon;

      attachTooltip(button, tooltip, 'bottom');

      button.addEventListener('click', () => {
        useGameStore.getState().toggleUiPanel(id);
      });

      this.root.appendChild(button);
      this.buttons.set(id, button);
    });

    this.unsubscribe = useGameStore.subscribe((state) => {
      this.sync(state.uiVisibility);
    });

    this.sync(useGameStore.getState().uiVisibility);
    blockGamePointer(this.root);
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
    this.root.className = '';
  }

  private sync(visibility: Record<UiPanel, boolean>): void {
    const labels: Record<UiPanel, string> = {
      tools: 'herramientas',
      rotation: 'girar material',
    };

    for (const [panel, button] of this.buttons) {
      const visible = visibility[panel];
      button.classList.toggle('is-off', !visible);
      button.dataset.tooltip = visible
        ? `Ocultar panel de ${labels[panel]}`
        : `Mostrar panel de ${labels[panel]}`;
    }
  }
}
