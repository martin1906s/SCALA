export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }

  return { r: rp + m, g: gp + m, b: bp + m };
}

export function rgbToCss(color: { r: number; g: number; b: number }): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function pickColorFromWheel(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
): { r: number; g: number; b: number } {
  const dx = x - centerX;
  const dy = y - centerY;
  let dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    dist = (innerRadius + outerRadius) / 2;
  }

  dist = Math.max(innerRadius, Math.min(outerRadius, dist));

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const hue = (angle + 360) % 360;
  const ringT = (dist - innerRadius) / (outerRadius - innerRadius);
  const saturation = Math.min(1, Math.max(0.45, ringT * 0.55 + 0.45));

  return hsvToRgb(hue, saturation, 0.92);
}

export function canvasCoords(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}
