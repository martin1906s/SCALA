import type { MaterialTier } from '@/config/materialCatalog';
import { TIER_MULTIPLIERS } from '@/config/materialCatalog';
import type { MaterialDimensions } from '@/domain/materials/MaterialDimensions';
import {
  computePriceBreakdown,
  computeTotalCost,
  type PriceBreakdown,
} from '@/domain/materials/PricingEngine';
import type { PieceType } from '@/entities/BuildingPiece';
import { useGameStore } from '@/store/gameStore';
import { REFUND_RATE } from '@/config/gameConfig';

export class EconomySystem {
  getQuoteBreakdown(
    type: PieceType,
    dimensions: MaterialDimensions,
    tier: MaterialTier = 'wood',
  ): PriceBreakdown {
    return computePriceBreakdown(type, dimensions, tier);
  }

  computeCost(
    type: PieceType,
    dimensions: MaterialDimensions,
    tier: MaterialTier = 'wood',
  ): number {
    if (useGameStore.getState().gameMode === 'sandbox') {
      return 0;
    }
    return computeTotalCost(type, dimensions, tier);
  }

  canAfford(cost: number): boolean {
    if (useGameStore.getState().gameMode === 'sandbox') {
      return true;
    }
    return useGameStore.getState().budget >= cost;
  }

  spend(amount: number): boolean {
    if (useGameStore.getState().gameMode === 'sandbox') {
      return true;
    }
    const { budget, setBudget } = useGameStore.getState();
    if (budget < amount) {
      return false;
    }
    setBudget(budget - amount);
    return true;
  }

  refund(originalCost: number): number {
    if (useGameStore.getState().gameMode === 'sandbox') {
      return 0;
    }
    const refundAmount = Math.floor(originalCost * REFUND_RATE);
    const { budget, setBudget } = useGameStore.getState();
    setBudget(budget + refundAmount);
    return refundAmount;
  }

  getTierMultiplier(tier: MaterialTier): number {
    return TIER_MULTIPLIERS[tier];
  }
}
