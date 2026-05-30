import { describe, expect, it } from "vitest";
import { calculateVwap, SlippageEstimator } from "./slippage-estimator.js";

describe("calculateVwap", () => {
  it("fills across multiple levels and returns VWAP", () => {
    const result = calculateVwap(
      [
        { price: 100, quantity: 1 },
        { price: 101, quantity: 2 }
      ],
      2
    );

    expect(result.filledAmount).toBe(2);
    expect(result.averagePrice).toBeCloseTo(100.5);
    expect(result.totalCost).toBe(201);
    expect(result.isPartialFill).toBe(false);
  });

  it("marks partial fills when depth is insufficient", () => {
    const result = new SlippageEstimator().calculateVwap([{ price: 100, quantity: 0.5 }], 1);

    expect(result.filledAmount).toBe(0.5);
    expect(result.isPartialFill).toBe(true);
    expect(result.remainingAmount).toBeCloseTo(0.5);
  });
});
