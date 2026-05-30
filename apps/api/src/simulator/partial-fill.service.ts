import { Injectable } from "@nestjs/common";
import type { OrderBookLevel } from "@arbix/shared";
import { calculateVwap, type VwapComputation } from "../arbitrage/slippage-estimator.js";

export type { VwapComputation };

/**
 * PartialFillService — partial-fill analysis utilities.
 *
 * Uses the shared `calculateVwap` pure function from slippage-estimator (not
 * the injectable class) to avoid a circular module dependency while ensuring
 * a single implementation of the VWAP algorithm.
 */
@Injectable()
export class PartialFillService {
  /**
   * Compute VWAP and fill metrics for a given side of the order book.
   */
  calculateVwap(levels: OrderBookLevel[], targetAmount: number): VwapComputation {
    return calculateVwap(levels, targetAmount);
  }

  /**
   * Returns true when the actual filled amount is materially less than the
   * requested amount (gap > 1e-9 to avoid floating-point noise).
   */
  isPartialFill(filledAmount: number, requestedAmount: number): boolean {
    return requestedAmount - filledAmount > 1e-9;
  }

  /**
   * The fill ratio as a percentage [0, 100].
   * e.g. 0.20 filled / 0.25 requested = 80%
   */
  fillRatioPercent(filledAmount: number, requestedAmount: number): number {
    if (requestedAmount <= 0) return 0;
    return Math.min(100, (filledAmount / requestedAmount) * 100);
  }
}
