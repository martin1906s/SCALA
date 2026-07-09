import { Texture } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

/** Rutas en `public/` — formatos según assets del usuario. */
export const TEXTURE_URLS = {
  grass: '/textures/terrain_grass.jpeg',
  brick: '/textures/material_brick.webp',
  wood: '/textures/material_wood.jpg',
  stone: '/textures/material_stone.webp',
  sky: '/textures/sky_gradient.jpg',
} as const;

export interface TextureScaleOptions {
  uScale?: number;
  vScale?: number;
}

const cache = new Map<string, Texture>();

export function getGameTexture(
  scene: Scene,
  key: string,
  url: string,
  options: TextureScaleOptions = {},
): Texture {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const texture = new Texture(
    url,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      texture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    },
  );
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;

  if (options.uScale !== undefined) {
    texture.uScale = options.uScale;
  }
  if (options.vScale !== undefined) {
    texture.vScale = options.vScale;
  }

  cache.set(key, texture);
  return texture;
}

/** Clona una textura cacheada con escala distinta (p. ej. cilindro). */
export function cloneGameTexture(
  _scene: Scene,
  key: string,
  sourceKey: string,
  options: TextureScaleOptions = {},
): Texture {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const source = cache.get(sourceKey);
  if (!source) {
    throw new Error(`Texture source "${sourceKey}" not loaded.`);
  }

  const texture = source.clone();
  if (!texture) {
    return source;
  }
  texture.name = key;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;

  if (options.uScale !== undefined) {
    texture.uScale = options.uScale;
  }
  if (options.vScale !== undefined) {
    texture.vScale = options.vScale;
  }

  cache.set(key, texture);
  return texture;
}

export function disposeGameTextures(): void {
  for (const texture of cache.values()) {
    texture.dispose();
  }
  cache.clear();
}
