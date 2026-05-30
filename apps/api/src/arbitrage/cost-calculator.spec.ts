import { describe, expect, it } from "vitest";
import { CostCalculator } from "./cost-calculator.js";
import { SlippageEstimator } from "./slippage-estimator.js";

describe("CostCalculator", () => {
  it("calculates net profitability after fees and slippage", () => {
    const calculator = new CostCalculator(new SlippageEstimator());
    const result = calculator.calculate({
      buyAskPrice: 100,
      sellBidPrice: 102,
      executionBuyPrice: 100.5,
      executionSellPrice: 101.5,
      amount: 2,
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    });

    expect(result.grossProfit).toBe(4);
    expect(result.buyFee).toBeCloseTo(0.201);
    expect(result.sellFee).toBeCloseTo(0.203);
    expect(result.slippageCost).toBeCloseTo(2);
    expect(result.netProfit).toBeCloseTo(-0.404);
  });
});
