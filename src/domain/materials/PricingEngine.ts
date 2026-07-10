import {
  getVisibleArea,
  getVolume,
  AREA_RATE,
  TIER_MULTIPLIERS,
  VOLUME_RATE,
  type MaterialTier,
} from '@/config/materialCatalog';
import type { PieceType } from '@/entities/BuildingPiece';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import { getDefaultDimensions } from '@/domain/materials/MaterialDimensions';

export interface PriceBreakdown {
  areaCost: number;
  volumeSurcharge: number;
  tierMultiplier: number;
  subtotal: number;
  total: number;
  visibleArea: number;
  volume: number;
}

export function computeAreaCost(type: PieceType, dimensions: MaterialDimensions): number {
  return AREA_RATE[type] * getVisibleArea(type, dimensions);
}

export function computeVolumeSurcharge(type: PieceType, dimensions: MaterialDimensions): number {
  return VOLUME_RATE[type] * getVolume(type, dimensions);
}

export function computePriceBreakdown(
  type: PieceType,
  dimensions: MaterialDimensions,
  tier: MaterialTier = 'wood',
): PriceBreakdown {
  const visibleArea = getVisibleArea(type, dimensions);
  const volume = getVolume(type, dimensions);
  const areaCost = computeAreaCost(type, dimensions);
  const volumeSurcharge = computeVolumeSurcharge(type, dimensions);
  const subtotal = areaCost + volumeSurcharge;
  const tierMultiplier = TIER_MULTIPLIERS[tier];
  const total = Math.ceil(subtotal * tierMultiplier);

  return {
    areaCost: Math.ceil(areaCost),
    volumeSurcharge: Math.ceil(volumeSurcharge),
    tierMultiplier,
    subtotal: Math.ceil(subtotal),
    total,
    visibleArea,
    volume,
  };
}

export function computeTotalCost(
  type: PieceType,
  dimensions: MaterialDimensions,
  tier: MaterialTier = 'wood',
): number {
  return computePriceBreakdown(type, dimensions, tier).total;
}

export function getDefaultCost(type: PieceType, tier: MaterialTier = 'wood'): number {
  return computeTotalCost(type, getDefaultDimensions(type), tier);
}
