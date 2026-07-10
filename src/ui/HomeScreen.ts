import { attachTooltip } from '@/ui/tooltip';
import type { GameMode } from '@/store/gameStore';

export class HomeScreen {
  private readonly root: HTMLElement;
  private readonly onStart: (mode: GameMode) => void;

  constructor(root: HTMLElement, onStart: (mode: GameMode) => void) {
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

        <ul class="home-tips">
          <li><span class="chip chip--wall"></span> Muros dimensionables</li>
          <li><span class="chip chip--floor"></span> Suelos por área</li>
          <li><span class="chip chip--pillar"></span> Columnas y tiers</li>
        </ul>

        <div class="home-actions">
          <button type="button" class="home-play" data-play-campaign>
            ¡A construir!
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

    const campaignBtn = this.root.querySelector<HTMLButtonElement>('[data-play-campaign]');
    const sandboxBtn = this.root.querySelector<HTMLButtonElement>('[data-play-sandbox]');

    if (campaignBtn) {
      attachTooltip(campaignBtn, 'Campaña con retos y presupuesto', 'top');
      campaignBtn.addEventListener('click', () => this.onStart('campaign'));
    }
    if (sandboxBtn) {
      attachTooltip(sandboxBtn, 'Construye sin límites ni objetivos', 'top');
      sandboxBtn.addEventListener('click', () => this.onStart('sandbox'));
    }
  }
}
