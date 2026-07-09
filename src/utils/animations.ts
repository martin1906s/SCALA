export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export async function typewriterText(
  element: HTMLElement,
  text: string,
  speedMs = 22,
): Promise<void> {
  element.textContent = '';
  if (prefersReducedMotion()) {
    element.textContent = text;
    return;
  }

  for (let index = 0; index < text.length; index += 1) {
    element.textContent += text[index];
    await sleep(speedMs);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function pulseElement(element: HTMLElement, className = 'is-pulsing'): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
