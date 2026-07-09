import { REFUND_RATE } from '@/config/gameConfig';
import { useGameStore } from '@/store/gameStore';

export class EconomySystem {
  canAfford(cost: number): boolean {
    return useGameStore.getState().budget >= cost;
  }

  spend(amount: number): boolean {
    const { budget, setBudget } = useGameStore.getState();
    if (budget < amount) {
      return false;
    }
    setBudget(budget - amount);
    return true;
  }

  refund(originalCost: number): number {
    const refundAmount = Math.floor(originalCost * REFUND_RATE);
    const { budget, setBudget } = useGameStore.getState();
    setBudget(budget + refundAmount);
    return refundAmount;
  }
}
