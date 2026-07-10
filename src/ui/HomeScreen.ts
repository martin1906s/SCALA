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
    const continueLabel = allComplete
      ? 'Rejugar campaña'
      : `Continuar · ${LEVELS[continueIndex]?.name ?? 'Nivel 1'}`;

    this.root.className = 'home';
    this.root.innerHTML = `
      <div class="home-sky"></div>
      <div class="home-grass"></div>

      <div class="home-content">
        <div class="home-house" aria-hidden="true">
          <div class="block block--roof"></div>
          <div class="block block--wall block--w1"></div>
          <div class="block block--wall block--w2"></div>
          <div class="block block--pillar"></div>
          <div class="block block--floor"></div>
        </div>

        <h1 class="home-title">SCALA</h1>
        <p class="home-tagline">Arma tu casita con dimensiones a medida</p>
        <p class="home-orient-hint">En móvil, gira a horizontal para jugar</p>

        <ul class="home-tips">
          <li><span class="chip chip--wall"></span> Muros dimensionables</li>
          <li><span class="chip chip--floor"></span> Suelos por área</li>
          <li><span class="chip chip--pillar"></span> Columnas y tiers</li>
        </ul>

        <div class="home-levels" data-levels></div>

        <div class="home-actions">
          <button type="button" class="home-play" data-play-continue>
            ${continueLabel}
          </button>
          <button type="button" class="home-play home-play--sandbox" data-play-sandbox>
            Modo libre
          </button>
        </div>
      </div>

      <div class="home-deco" aria-hidden="true">
        <span class="float-block fb1"></span>
        <span class="float-block fb2"></span>
        <span class="float-block fb3"></span>
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
          <span class="home-level-card__name">${level.name}</span>
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
