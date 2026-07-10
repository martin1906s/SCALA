import { Color3, StandardMaterial } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { MaterialTier } from '@/config/materialCatalog';
import { PIECE_COLORS } from '@/config/gameConfig';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import type { PieceType } from '@/entities/BuildingPiece';
import { tintColor } from '@/utils/proceduralTextures';
import {
  TEXTURE_URLS,
  cloneGameTexture,
  disposeGameTextures,
  getGameTexture,
} from '@/utils/textureLoader';

const TIER_TINT: Record<MaterialTier, Color3> = {
  wood: new Color3(1, 1, 1),
  stone: new Color3(0.85, 0.88, 0.92),
  marble: new Color3(1.05, 1.02, 0.98),
};

export function createPieceMaterial(
  scene: Scene,
  type: PieceType,
  name: string,
  tier: MaterialTier = 'wood',
  dimensions?: MaterialDimensions,
): StandardMaterial {
  const base = PIECE_COLORS[type] ?? PIECE_COLORS.wall;
  const mat = new StandardMaterial(name, scene);
  const diffuse = new Color3(base.r, base.g, base.b).multiply(TIER_TINT[tier]);

  mat.diffuseColor = diffuse;
  mat.ambientColor = tintColor(diffuse, 0.35);
  mat.backFaceCulling = true;

  switch (type) {
    case 'wall': {
      mat.diffuseTexture = getGameTexture(scene, 'brick', TEXTURE_URLS.brick, {
        uScale: 2,
        vScale: 2,
      });
      mat.diffuseColor = TIER_TINT[tier].clone();
      mat.specularColor = new Color3(0.12, 0.1, 0.08);
      mat.specularPower = tier === 'marble' ? 96 : 32;
      mat.emissiveColor = new Color3(0.04, 0.02, 0.02);
      break;
    }
    case 'floor':
    case 'ramp': {
      mat.diffuseTexture = getGameTexture(scene, 'wood', TEXTURE_URLS.wood, {
        uScale: 1.5,
        vScale: 1.5,
      });
      mat.diffuseColor = TIER_TINT[tier].clone();
      mat.specularColor = new Color3(0.18, 0.14, 0.08);
      mat.specularPower = 48;
      mat.emissiveColor = new Color3(0.03, 0.02, 0.01);
      break;
    }
    case 'roof': {
      mat.diffuseColor = diffuse;
      mat.specularColor = new Color3(0.1, 0.08, 0.06);
      mat.emissiveColor = new Color3(0.02, 0.01, 0.01);
      break;
    }
    case 'pillar': {
      getGameTexture(scene, 'stone', TEXTURE_URLS.stone);
      const pillarDims = dimensions as { diameter?: number; height?: number } | undefined;
      const pillarHeight = pillarDims?.height ?? 1.2;
      const pillarDiameter = pillarDims?.diameter ?? 0.5;
      const circumference = Math.PI * pillarDiameter;
      mat.diffuseTexture = cloneGameTexture(scene, `stone-pillar-${name}`, 'stone', {
        uScale: Math.max(3, Math.ceil(circumference * 2.5)),
        vScale: Math.max(2, Math.ceil(pillarHeight * 2)),
      });
      mat.diffuseColor = TIER_TINT[tier].clone();
      mat.specularColor = tier === 'marble'
        ? new Color3(0.35, 0.35, 0.38)
        : new Color3(0.22, 0.24, 0.28);
      mat.specularPower = tier === 'marble' ? 128 : 64;
      mat.emissiveColor = new Color3(0.02, 0.03, 0.05);
      break;
    }
  }

  return mat;
}

export function disposeMaterialTextures(): void {
  disposeGameTextures();
}
