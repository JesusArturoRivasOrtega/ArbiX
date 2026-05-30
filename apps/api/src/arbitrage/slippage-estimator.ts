import { Injectable } from "@nestjs/common";
import type { OrderBookLevel } from "@arbix/shared";

export type VwapComputation = {
  filledAmount: number;
  averagePrice: number;
  totalCost: number;
  isPartialFill: boolean;
  remainingAmount: number;
};

export function calculateVwap(levels: OrderBookLevel[], targetAmount: number): VwapComputation {
  let remainingAmount = Math.max(0, targetAmount);
  let filledAmount = 0;
  let totalCost = 0;

  for (const level of levels) {
    if (remainingAmount <= 0) break;
    const fillAmount = Math.min(remainingAmount, level.quantity);
    filledAmount += fillAmount;
    totalCost += fillAmount * level.price;
    remainingAmount -= fillAmount;
  }

  return {
    filledAmount,
    averagePrice: filledAmount > 0 ? totalCost / filledAmount : 0,
    totalCost,
    isPartialFill: remainingAmount > 1e-9,
    remainingAmount
  };
}

@Injectable()
export class SlippageEstimator {
  calculateVwap(levels: OrderBookLevel[], targetAmount: number) {
    return calculateVwap(levels, targetAmount);
  }

  estimateSlippage(params: {
    bestAsk: number;
    bestBid: number;
    executionBuyVwap: number;
    executionSellVwap: number;
    amount: number;
  }) {
    const buySlippage = Math.max(0, params.executionBuyVwap - params.bestAsk);
    const sellSlippage = Math.max(0, params.bestBid - params.executionSellVwap);
    const buySlippageCost = buySlippage * params.amount;
    const sellSlippageCost = sellSlippage * params.amount;
    return {
      buySlippage,
      sellSlippage,
      buySlippagePercent: params.bestAsk > 0 ? (buySlippage / params.bestAsk) * 100 : 0,
      sellSlippagePercent: params.bestBid > 0 ? (sellSlippage / params.bestBid) * 100 : 0,
      slippageCost: buySlippageCost + sellSlippageCost
    };
  }
}
