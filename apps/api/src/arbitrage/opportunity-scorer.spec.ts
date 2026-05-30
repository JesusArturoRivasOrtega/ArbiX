import { describe, expect, it } from "vitest";
import { OpportunityScorer } from "./opportunity.scorer.js";

describe("OpportunityScorer", () => {
  it("recommends execution for high quality opportunities", () => {
    const score = new OpportunityScorer().score({
      cost: {
        grossSpread: 10,
        grossSpreadPercent: 0.2,
        grossProfit: 20,
        buyCost: 10000,
        buyFee: 10,
        sellRevenue: 10030,
        sellFee: 10,
        withdrawalFee: 0,
        slippageCost: 1,
        netProfit: 9,
        netProfitPercent: 0.09,
        buySlippage: 0.1,
        buySlippagePercent: 0.01,
        sellSlippage: 0.1,
        sellSlippagePercent: 0.01
      },
      filledAmount: 0.25,
      targetAmount: 0.25,
      latencyMs: 40,
      maxLatencyMs: 1000,
      orderBookAgeMs: 50,
      circuitBreakerActive: false,
      walletOk: true
    });

    expect(score.confidence).toBeGreaterThan(70);
    expect(score.recommendation).toBe("EXECUTE");
  });

  it("drops confidence to zero when wallet balance is insufficient", () => {
    const score = new OpportunityScorer().score({
      cost: {
        grossSpread: 10,
        grossSpreadPercent: 0.2,
        grossProfit: 20,
        buyCost: 10000,
        buyFee: 10,
        sellRevenue: 10040,
        sellFee: 10,
        withdrawalFee: 0,
        slippageCost: 1,
        netProfit: 19,
        netProfitPercent: 0.19,
        buySlippage: 0,
        buySlippagePercent: 0,
        sellSlippage: 0,
        sellSlippagePercent: 0
      },
      filledAmount: 0.25,
      targetAmount: 0.25,
      latencyMs: 40,
      maxLatencyMs: 1000,
      orderBookAgeMs: 50,
      circuitBreakerActive: false,
      walletOk: false
    });

    expect(score.confidence).toBe(0);
    expect(score.recommendation).toBe("REJECT");
  });
});
