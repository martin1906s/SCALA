import { Color3, DynamicTexture } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

function noise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Césped con cuadrícula suave — sustituible por `terrain_grass.png` (512×512, tileable). */
export function createGrassTexture(scene: Scene, cells = 20): DynamicTexture {
  const size = 512;
  const tex = new DynamicTexture('grassTex', size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  const cellPx = size / cells;

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const checker = (row + col) % 2;
      const n = noise(col * 1.7, row * 2.3);
      const base = checker ? 72 : 64;
      const g = base + Math.floor(n * 18);
      const r = g - 18 + Math.floor(n * 8);
      const b = g - 32 + Math.floor(n * 6);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * cellPx, row * cellPx, cellPx, cellPx);

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(col * cellPx + 0.5, row * cellPx + 0.5, cellPx - 1, cellPx - 1);
    }
  }

  tex.update();
  tex.wrapU = DynamicTexture.CLAMP_ADDRESSMODE;
  tex.wrapV = DynamicTexture.CLAMP_ADDRESSMODE;
  return tex;
}

/** Madera para suelos — sustituible por `material_wood.png` (256×256, tileable). */
export function createWoodTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture('woodTex', size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = '#a87848';
  ctx.fillRect(0, 0, size, size);

  const planks = 6;
  const plankH = size / planks;
  for (let i = 0; i < planks; i += 1) {
    const n = noise(i, 1);
    const shade = 150 + Math.floor(n * 40);
    ctx.fillStyle = `rgb(${shade},${shade - 40},${shade - 80})`;
    ctx.fillRect(0, i * plankH, size, plankH - 2);

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, (i + 1) * plankH - 1);
    ctx.lineTo(size, (i + 1) * plankH - 1);
    ctx.stroke();

    const knots = 2 + Math.floor(n * 2);
    for (let k = 0; k < knots; k += 1) {
      const kx = noise(i, k) * size;
      const ky = i * plankH + noise(k, i) * plankH;
      ctx.fillStyle = 'rgba(60,30,10,0.12)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, 6 + n * 4, 3 + n * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  tex.update();
  return tex;
}

/** Ladrillo para muros — sustituible por `material_brick.png` (256×256, tileable). */
export function createBrickTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture('brickTex', size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = '#c4a090';
  ctx.fillRect(0, 0, size, size);

  const brickW = 48;
  const brickH = 22;
  const gap = 3;
  let row = 0;
  for (let y = 0; y < size; y += brickH + gap) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let x = -brickW; x < size + brickW; x += brickW + gap) {
      const n = noise(x, y);
      const r = 190 + Math.floor(n * 30);
      const g = 110 + Math.floor(n * 25);
      const b = 85 + Math.floor(n * 15);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + offset, y, brickW, brickH);
    }
    row += 1;
  }

  ctx.strokeStyle = 'rgba(80,50,40,0.35)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += brickH + gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  tex.update();
  return tex;
}

/** Piedra para columnas — sustituible por `material_stone.png` (256×256, tileable). */
export function createStoneTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture('stoneTex', size, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  ctx.fillStyle = '#8aa8c0';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 120; i += 1) {
    const n = noise(i, i * 2);
    const x = n * size;
    const y = noise(i * 3, i) * size;
    const w = 8 + n * 24;
    const h = 6 + noise(i, i) * 18;
    const shade = 120 + Math.floor(n * 60);
    ctx.fillStyle = `rgba(${shade},${shade + 10},${shade + 25},0.45)`;
    ctx.fillRect(x, y, w, h);
  }

  tex.update();
  return tex;
}

export function tintColor(base: Color3, factor: number): Color3 {
  return new Color3(
    Math.min(base.r * factor, 1),
    Math.min(base.g * factor, 1),
    Math.min(base.b * factor, 1),
  );
}
