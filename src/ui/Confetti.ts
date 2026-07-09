const COLORS = ['#ffd54f', '#66bb6a', '#42a5f5', '#ef5350', '#ab47bc', '#ff8a65'];

export class Confetti {
  private static layer: HTMLElement | null = null;

  static burst(intensity: 'normal' | 'epic' = 'normal'): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const layer = Confetti.getLayer();
    const count = intensity === 'epic' ? 90 : 48;

    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = COLORS[i % COLORS.length] ?? '#ffd54f';
      piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
      piece.style.animationDelay = `${Math.random() * 0.35}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
  }

  private static getLayer(): HTMLElement {
    if (!Confetti.layer) {
      Confetti.layer = document.createElement('div');
      Confetti.layer.className = 'confetti-layer';
      document.body.appendChild(Confetti.layer);
    }
    return Confetti.layer;
  }
}
