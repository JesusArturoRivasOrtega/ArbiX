import { Injectable } from "@nestjs/common";
import type { OrderBookLevel } from "@arbix/shared";

export type VwapResult = {
  filledAmount: number;
  averagePrice: number;
  totalCost: number;
  isPartialFill: boolean;
  remainingAmount: number;
};

@Injectable()
export class PartialFillService {
  calculateVwap(levels: OrderBookLevel[], targetAmount: number): VwapResult {
    if (targetAmount <= 0) {
      return { filledAmount: 0, averagePrice: 0, totalCost: 0, isPartialFill: false, remainingAmount: 0 };
    }

    let remaining = targetAmount;
    let totalCost = 0;
    let filledAmount = 0;

    for (const level of levels) {
      if (remaining <= 0) break;
      const fill = Math.min(level.quantity, remaining);
      filledAmount += fill;
      totalCost += fill * level.price;
      remaining -= fill;
    }

    return {
      filledAmount,
      averagePrice: filledAmount > 0 ? totalCost / filledAmount : 0,
      totalCost,
      isPartialFill: remaining > 1e-9,
      remainingAmount: Math.max(0, remaining)
    };
  }
}
