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

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function animateCounter(element: HTMLElement, target: number, durationMs = 280): void {
  if (prefersReducedMotion()) {
    element.textContent = String(target);
    return;
  }

  const start = Number(element.textContent) || 0;
  if (start === target) {
    element.textContent = String(target);
    return;
  }

  const startTime = performance.now();
  const tick = (): void => {
    const t = Math.min(1, (performance.now() - startTime) / durationMs);
    const value = Math.round(start + (target - start) * easeOutCubic(t));
    element.textContent = String(value);
    if (t < 1) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}
