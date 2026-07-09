import { Color3, StandardMaterial } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { PIECE_COLORS, PIECE_DIMS } from '@/config/gameConfig';
import type { PieceType } from '@/entities/BuildingPiece';
import { tintColor } from '@/utils/proceduralTextures';
import {
  TEXTURE_URLS,
  cloneGameTexture,
  disposeGameTextures,
  getGameTexture,
} from '@/utils/textureLoader';

export function createPieceMaterial(
  scene: Scene,
  type: PieceType,
  name: string,
): StandardMaterial {
  const base = PIECE_COLORS[type];
  const mat = new StandardMaterial(name, scene);
  const diffuse = new Color3(base.r, base.g, base.b);

  mat.diffuseColor = diffuse;
  mat.ambientColor = tintColor(diffuse, 0.35);
  mat.backFaceCulling = true;

  switch (type) {
    case 'wall': {
      mat.diffuseTexture = getGameTexture(scene, 'brick', TEXTURE_URLS.brick, {
        uScale: 2,
        vScale: 2,
      });
      mat.diffuseColor = new Color3(1, 1, 1);
      mat.specularColor = new Color3(0.12, 0.1, 0.08);
      mat.specularPower = 32;
      mat.emissiveColor = new Color3(0.04, 0.02, 0.02);
      break;
    }
    case 'floor': {
      mat.diffuseTexture = getGameTexture(scene, 'wood', TEXTURE_URLS.wood, {
        uScale: 1.5,
        vScale: 1.5,
      });
      mat.diffuseColor = new Color3(1, 1, 1);
      mat.specularColor = new Color3(0.18, 0.14, 0.08);
      mat.specularPower = 48;
      mat.emissiveColor = new Color3(0.03, 0.02, 0.01);
      break;
    }
    case 'pillar': {
      getGameTexture(scene, 'stone', TEXTURE_URLS.stone);
      const pillarHeight = PIECE_DIMS.pillar.height;
      const pillarDiameter = PIECE_DIMS.pillar.diameter;
      const circumference = Math.PI * pillarDiameter;
      mat.diffuseTexture = cloneGameTexture(scene, 'stone-pillar', 'stone', {
        uScale: Math.max(3, Math.ceil(circumference * 2.5)),
        vScale: Math.max(2, Math.ceil(pillarHeight * 2)),
      });
      mat.diffuseColor = new Color3(1, 1, 1);
      mat.specularColor = new Color3(0.22, 0.24, 0.28);
      mat.specularPower = 64;
      mat.emissiveColor = new Color3(0.02, 0.03, 0.05);
      break;
    }
  }

  return mat;
}

export function disposeMaterialTextures(): void {
  disposeGameTextures();
}
