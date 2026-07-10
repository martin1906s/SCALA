import { LEVELS } from '@/config/levels';
import { attachTooltip } from '@/ui/tooltip';
import type { GameMode } from '@/store/gameStore';
import {
  getContinueLevelIndex,
  isLevelUnlocked,
  loadSave,
} from '@/utils/progressStorage';

export interface StartOptions {
  mode: GameMode;
  levelIndex?: number;
}

export class HomeScreen {
  private readonly root: HTMLElement;
  private readonly onStart: (options: StartOptions) => void;

  constructor(root: HTMLElement, onStart: (options: StartOptions) => void) {
    this.root = root;
    this.onStart = onStart;
    this.render();
  }

  hide(): void {
    this.root.classList.add('home--hidden');
    window.setTimeout(() => {
      this.root.style.display = 'none';
    }, 450);
  }

  private render(): void {
    const save = loadSave();
    const continueIndex = getContinueLevelIndex(LEVELS.length);
    const allComplete = save.maxCompletedLevel >= LEVELS.length;
    const continueLevel = LEVELS[continueIndex];
    const continueLabel = allComplete
      ? 'Rejugar campaña'
      : `Continuar · ${continueLevel?.name ?? 'Nivel 1'}`;

    this.root.className = 'home';
    this.root.innerHTML = `
      <div class="home-bg" aria-hidden="true">
        <div class="home-bg__grid"></div>
        <div class="home-bg__glow"></div>
      </div>

      <div class="home-deco" aria-hidden="true">
        <span class="home-deco__corner home-deco__corner--tl"></span>
        <span class="home-deco__corner home-deco__corner--br"></span>
      </div>

      <div class="home-shell">
        <header class="home-header">
          <div class="home-emblem" aria-hidden="true">
            <span class="home-emblem__roof"></span>
            <span class="home-emblem__wall home-emblem__wall--l"></span>
            <span class="home-emblem__wall home-emblem__wall--r"></span>
            <span class="home-emblem__pillar"></span>
            <span class="home-emblem__base"></span>
          </div>
          <p class="home-eyebrow">Gremio de constructores</p>
          <h1 class="home-title">SCALA</h1>
          <p class="home-tagline">Arma estructuras con dimensiones a medida y cumple los retos del gremio</p>
          <p class="home-orient-hint">En móvil, gira a horizontal para jugar</p>
        </header>

        <ul class="home-features">
          <li><span class="home-chip home-chip--wall"></span> Muros</li>
          <li><span class="home-chip home-chip--floor"></span> Suelos</li>
          <li><span class="home-chip home-chip--pillar"></span> Columnas</li>
        </ul>

        <section class="home-levels" aria-labelledby="home-levels-label">
          <p class="home-levels__label" id="home-levels-label">Pruebas del gremio</p>
          <div data-levels></div>
        </section>

        <div class="home-actions">
          <button type="button" class="home-btn home-btn--primary" data-play-continue>
            ${continueLabel}
          </button>
          <button type="button" class="home-btn home-btn--ghost" data-play-sandbox>
            Modo libre · sin límites
          </button>
        </div>
      </div>
    `;

    this.renderLevels(save.stars);

    const continueBtn = this.root.querySelector<HTMLButtonElement>('[data-play-continue]');
    const sandboxBtn = this.root.querySelector<HTMLButtonElement>('[data-play-sandbox]');

    if (continueBtn) {
      attachTooltip(
        continueBtn,
        allComplete ? 'Vuelve a la primera prueba del gremio' : 'Retoma tu aventura',
        'top',
      );
      continueBtn.addEventListener('click', () => {
        this.onStart({ mode: 'campaign', levelIndex: continueIndex });
      });
    }
    if (sandboxBtn) {
      attachTooltip(sandboxBtn, 'Construye sin límites ni objetivos', 'top');
      sandboxBtn.addEventListener('click', () => this.onStart({ mode: 'sandbox' }));
    }
  }

  private renderLevels(stars: Record<number, number>): void {
    const container = this.root.querySelector('[data-levels]');
    if (!container) {
      return;
    }

    container.innerHTML = LEVELS.map((level, index) => {
      const unlocked = isLevelUnlocked(level.id);
      const earned = stars[level.id] ?? 0;
      const starText = earned > 0 ? '★'.repeat(earned) + '☆'.repeat(3 - earned) : '☆☆☆';
      return `
        <button
          type="button"
          class="home-level-card ${unlocked ? '' : 'home-level-card--locked'}"
          data-level-index="${index}"
          ${unlocked ? '' : 'disabled'}
        >
          <span class="home-level-card__num">${level.id}</span>
          <span>
            <span class="home-level-card__name">${level.name}</span>
            <span class="home-level-card__meta">${level.tagline}</span>
          </span>
          <span class="home-level-card__stars" aria-label="${earned} de 3 estrellas">${starText}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll<HTMLButtonElement>('[data-level-index]').forEach((button) => {
      const index = Number(button.dataset.levelIndex);
      const level = LEVELS[index];
      if (!level) {
        return;
      }
      attachTooltip(button, level.tagline, 'top');
      button.addEventListener('click', () => {
        this.onStart({ mode: 'campaign', levelIndex: index });
      });
    });
  }
}
