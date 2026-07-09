export class ObjectiveToast {
  private static container: HTMLElement | null = null;

  static show(message: string): void {
    const root = ObjectiveToast.getContainer();
    const toast = document.createElement('div');
    toast.className = 'objective-toast';
    toast.innerHTML = `
      <span class="objective-toast__icon">✦</span>
      <span class="objective-toast__text">${message}</span>
    `;
    root.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.classList.add('is-leaving');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 2400);
  }

  private static getContainer(): HTMLElement {
    if (!ObjectiveToast.container) {
      ObjectiveToast.container = document.createElement('div');
      ObjectiveToast.container.className = 'objective-toast-layer';
      document.body.appendChild(ObjectiveToast.container);
    }
    return ObjectiveToast.container;
  }
}
