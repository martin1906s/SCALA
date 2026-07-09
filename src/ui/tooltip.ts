export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export function attachTooltip(
  element: HTMLElement,
  text: string,
  position: TooltipPosition = 'top',
): void {
  element.classList.add('has-tooltip');
  element.dataset.tooltip = text;
  element.dataset.tooltipPos = position;
  element.setAttribute('aria-label', text);
}
