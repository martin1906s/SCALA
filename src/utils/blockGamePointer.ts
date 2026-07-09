/** Evita que los clics en la UI lleguen al canvas 3D. */
export function blockGamePointer(element: HTMLElement): void {
  const stop = (event: Event) => {
    event.stopPropagation();
  };

  element.addEventListener('pointerdown', stop);
  element.addEventListener('pointerup', stop);
  element.addEventListener('click', stop);
}
