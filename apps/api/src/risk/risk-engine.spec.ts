import { describe, expect, it, vi } from "vitest";
import { defaultRiskConfig } from "@arbix/config";
import { RiskEngine } from "./risk-engine.js";

describe("RiskEngine", () => {
  it("rejects opportunities below the minimum net profit threshold", () => {
    const engine = new RiskEngine(
      { risk: defaultRiskConfig } as never,
      { isActive: () => false, trigger: vi.fn(), getReason: () => undefined, getLastTriggeredAt: () => undefined } as never,
      { getHighestLatency: () => 30 } as never
    );

    const result = engine.evaluate({
      latencyMs: 30,
      orderBookAgeMs: 20,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: {
        profitScore: 20,
        liquidityScore: 90,
        latencyScore: 95,
        slippageScore: 90,
        riskPenalty: 0,
        confidence: 60,
        recommendation: "WATCH"
      },
      cost: {
        grossSpread: 10,
        grossSpreadPercent: 0.1,
        grossProfit: 10,
        buyCost: 10000,
        buyFee: 1,
        sellRevenue: 10001,
        sellFee: 1,
        withdrawalFee: 0,
        slippageCost: 0,
        netProfit: 0.4,
        netProfitPercent: 0.004,
        buySlippage: 0,
        buySlippagePercent: 0,
        sellSlippage: 0,
        sellSlippagePercent: 0
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("BELOW_MIN_PROFIT_THRESHOLD");
  });

  it("accepts profitable, fresh and liquid opportunities", () => {
    const engine = new RiskEngine(
      { risk: defaultRiskConfig } as never,
      { isActive: () => false, trigger: vi.fn(), getReason: () => undefined, getLastTriggeredAt: () => undefined } as never,
      { getHighestLatency: () => 30 } as never
    );

    const result = engine.evaluate({
      latencyMs: 30,
      orderBookAgeMs: 20,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: {
        profitScore: 80,
        liquidityScore: 90,
        latencyScore: 95,
        slippageScore: 90,
        riskPenalty: 0,
        confidence: 88,
        recommendation: "EXECUTE"
      },
      cost: {
        grossSpread: 80,
        grossSpreadPercent: 0.12,
        grossProfit: 20,
        buyCost: 10000,
        buyFee: 5,
        sellRevenue: 10035,
        sellFee: 5,
        withdrawalFee: 0,
        slippageCost: 1,
        netProfit: 24,
        netProfitPercent: 0.24,
        buySlippage: 0.5,
        buySlippagePercent: 0.01,
        sellSlippage: 0.5,
        sellSlippagePercent: 0.01
      }
    });

    expect(result.accepted).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});
