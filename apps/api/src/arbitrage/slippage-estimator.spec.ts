import { describe, expect, it } from "vitest";
import { calculateVwap, SlippageEstimator } from "./slippage-estimator.js";
import type { OrderBookLevel } from "@arbix/shared";

function levels(prices: number[], quantities: number[]): OrderBookLevel[] {
  return prices.map((price, i) => ({ price, quantity: quantities[i] ?? 1 }));
}

describe("calculateVwap", () => {
  it("fills completely in a single level", () => {
    const result = calculateVwap(levels([100], [5]), 2);
    expect(result.filledAmount).toBe(2);
    expect(result.averagePrice).toBe(100);
    expect(result.isPartialFill).toBe(false);
    expect(result.remainingAmount).toBeCloseTo(0);
  });

  it("fills completely across multiple levels and returns correct VWAP", () => {
    // Buy 2 BTC: 1 at 100, 1 at 101 → VWAP = (100 + 101) / 2 = 100.5
    const result = calculateVwap(levels([100, 101, 102], [1, 1, 1]), 2);
    expect(result.filledAmount).toBe(2);
    expect(result.averagePrice).toBeCloseTo(100.5);
    expect(result.totalCost).toBeCloseTo(201);
    expect(result.isPartialFill).toBe(false);
  });

  it("marks isPartialFill when depth is insufficient", () => {
    // Want 1, only 0.5 available
    const result = calculateVwap(levels([100], [0.5]), 1);
    expect(result.filledAmount).toBe(0.5);
    expect(result.isPartialFill).toBe(true);
    expect(result.remainingAmount).toBeCloseTo(0.5);
  });

  it("returns zero filledAmount and isPartialFill when book is empty", () => {
    const result = calculateVwap([], 1);
    expect(result.filledAmount).toBe(0);
    expect(result.averagePrice).toBe(0);
    expect(result.isPartialFill).toBe(true);
    expect(result.remainingAmount).toBe(1);
  });

  it("computes correct VWAP with unequal level quantities", () => {
    // Buy 3: 2 at 100, 1 at 102 → totalCost=302, VWAP=302/3≈100.667
    const result = calculateVwap(levels([100, 102], [2, 2]), 3);
    expect(result.filledAmount).toBe(3);
    expect(result.totalCost).toBeCloseTo(302);
    expect(result.averagePrice).toBeCloseTo(302 / 3);
  });

  it("remainingAmount is exactly zero when fully filled", () => {
    const result = calculateVwap(levels([100, 101], [1, 2]), 3);
    expect(result.remainingAmount).toBeCloseTo(0);
    expect(result.isPartialFill).toBe(false);
  });

  it("handles fractional target amounts without precision errors", () => {
    const result = calculateVwap(levels([68000], [0.1]), 0.05);
    expect(result.filledAmount).toBeCloseTo(0.05, 6);
    expect(result.averagePrice).toBeCloseTo(68000);
    expect(Number.isNaN(result.averagePrice)).toBe(false);
  });

  it("stops consuming levels after target is reached", () => {
    const result = calculateVwap(levels([100, 200, 300], [1, 1, 1]), 1);
    // Should only consume the first level (price 100), not the more expensive ones
    expect(result.averagePrice).toBe(100);
    expect(result.filledAmount).toBe(1);
  });
});

describe("SlippageEstimator.estimateSlippage", () => {
  it("buy slippage is positive when executionBuyVwap > bestAsk", () => {
    const est = new SlippageEstimator();
    const result = est.estimateSlippage({
      bestAsk: 100,
      bestBid: 105,
      executionBuyVwap: 101,   // paid more than best ask
      executionSellVwap: 105,
      amount: 1
    });
    expect(result.buySlippage).toBeCloseTo(1);
    expect(result.slippageCost).toBeGreaterThan(0);
  });

  it("sell slippage is positive when executionSellVwap < bestBid", () => {
    const est = new SlippageEstimator();
    const result = est.estimateSlippage({
      bestAsk: 100,
      bestBid: 105,
      executionBuyVwap: 100,
      executionSellVwap: 104,  // received less than best bid
      amount: 1
    });
    expect(result.sellSlippage).toBeCloseTo(1);
  });

  it("slippageCost scales with amount", () => {
    const est = new SlippageEstimator();
    const small = est.estimateSlippage({ bestAsk: 100, bestBid: 105, executionBuyVwap: 101, executionSellVwap: 104, amount: 1 });
    const large = est.estimateSlippage({ bestAsk: 100, bestBid: 105, executionBuyVwap: 101, executionSellVwap: 104, amount: 10 });
    expect(large.slippageCost).toBeCloseTo(small.slippageCost * 10);
  });

  it("returns zero slippage when VWAP matches best prices exactly", () => {
    const est = new SlippageEstimator();
    const result = est.estimateSlippage({
      bestAsk: 100,
      bestBid: 105,
      executionBuyVwap: 100,   // exact match
      executionSellVwap: 105,  // exact match
      amount: 1
    });
    expect(result.buySlippage).toBe(0);
    expect(result.sellSlippage).toBe(0);
    expect(result.slippageCost).toBe(0);
  });

  it("buySlippagePercent is zero when bestAsk is zero (guard)", () => {
    const est = new SlippageEstimator();
    const result = est.estimateSlippage({ bestAsk: 0, bestBid: 0, executionBuyVwap: 0, executionSellVwap: 0, amount: 1 });
    expect(result.buySlippagePercent).toBe(0);
    expect(Number.isNaN(result.buySlippagePercent)).toBe(false);
  });
});
