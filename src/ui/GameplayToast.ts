export class GameplayToast {
  private static container: HTMLElement | null = null;

  static show(message: string): void {
    const root = GameplayToast.getContainer();
    const toast = document.createElement('div');
    toast.className = 'gameplay-toast';
    toast.textContent = message;
    root.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.classList.add('is-leaving');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2200);
  }

  private static getContainer(): HTMLElement {
    if (!GameplayToast.container) {
      GameplayToast.container = document.createElement('div');
      GameplayToast.container.className = 'gameplay-toast-layer';
      document.body.appendChild(GameplayToast.container);
    }
    return GameplayToast.container;
  }
}
