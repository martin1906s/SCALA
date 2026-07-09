import { attachTooltip } from '@/ui/tooltip';

export class HomeScreen {
  private readonly root: HTMLElement;
  private readonly onStart: () => void;

  constructor(root: HTMLElement, onStart: () => void) {
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
        <p class="home-tagline">Arma tu casita pieza por pieza</p>

        <ul class="home-tips">
          <li><span class="chip chip--wall"></span> Muros</li>
          <li><span class="chip chip--floor"></span> Suelos</li>
          <li><span class="chip chip--pillar"></span> Columnas</li>
        </ul>

        <button type="button" class="home-play" data-play>
          ¡A construir!
        </button>
      </div>

      <div class="home-deco" aria-hidden="true">
        <span class="float-block fb1"></span>
        <span class="float-block fb2"></span>
        <span class="float-block fb3"></span>
      </div>
    `;

    const playButton = this.root.querySelector<HTMLButtonElement>('[data-play]');
    if (playButton) {
      attachTooltip(playButton, 'Entrar al juego y empezar a construir', 'top');
      playButton.addEventListener('click', () => {
        this.onStart();
      });
    }
  }
}
