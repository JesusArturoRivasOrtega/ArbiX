import { describe, expect, it, vi } from "vitest";
import { defaultRiskConfig } from "@arbix/config";
import { RiskEngine } from "./risk-engine.js";

// Full cost breakdown fixture — profitable scenario
function goodCost(overrides: Record<string, number> = {}) {
  return {
    grossSpread: 300,
    grossSpreadPercent: 0.44,
    grossProfit: 150,
    buyCost: 34000,
    buyFee: 34,
    sellRevenue: 34300,
    sellFee: 34.3,
    withdrawalFee: 0,
    slippageCost: 5,
    netProfit: 76.7,
    netProfitPercent: 0.226,
    buySlippage: 2,
    buySlippagePercent: 0.003,
    sellSlippage: 2,
    sellSlippagePercent: 0.003,
    ...overrides
  };
}

function goodScore(overrides = {}) {
  return {
    profitScore: 85,
    liquidityScore: 90,
    latencyScore: 95,
    slippageScore: 90,
    riskPenalty: 0,
    confidence: 90,
    recommendation: "EXECUTE" as const,
    ...overrides
  };
}

function makeEngine() {
  return new RiskEngine(
    { risk: defaultRiskConfig } as never,
    { isActive: vi.fn().mockReturnValue(false), trigger: vi.fn(), getReason: () => undefined, getLastTriggeredAt: () => undefined } as never,
    { getHighestLatency: () => 30 } as never
  );
}

describe("RiskEngine.evaluate", () => {
  it("accepts when all conditions are good", () => {
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("rejects when net profit is zero or negative", () => {
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost({ netProfit: -1 })
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("NET_PROFIT_NEGATIVE");
  });

  it("rejects when fees exceed the gross spread", () => {
    // buyFee + sellFee + withdrawalFee > grossProfit
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost({ buyFee: 100, sellFee: 100, withdrawalFee: 5, grossProfit: 10 })
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("FEES_EXCEED_SPREAD");
  });

  it("rejects when net profit percent is below minimum threshold", () => {
    // defaultRiskConfig.minNetProfitPercent = 0.05
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost({ netProfit: 0.001, netProfitPercent: 0.001 })
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("BELOW_MIN_PROFIT_THRESHOLD");
  });

  it("rejects when latency exceeds the maximum", () => {
    // defaultRiskConfig.maxLatencyMs = 1000
    const result = makeEngine().evaluate({
      latencyMs: 2000, // exceeds limit
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("LATENCY_TOO_HIGH");
  });

  it("rejects when order book data is stale", () => {
    // defaultRiskConfig.maxOrderBookAgeMs = 5000
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 8000, // exceeds limit
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("STALE_ORDER_BOOK");
  });

  it("rejects when liquidity is insufficient", () => {
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: false,
      partialFill: false,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("INSUFFICIENT_LIQUIDITY");
  });

  it("rejects when wallet balance is insufficient", () => {
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: false,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("INSUFFICIENT_WALLET_BALANCE");
  });

  it("rejects when slippage exceeds the maximum", () => {
    // defaultRiskConfig.maxSlippagePercent = 2
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost({ buySlippagePercent: 5, sellSlippagePercent: 5 })
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("SLIPPAGE_TOO_HIGH");
  });

  it("rejects partial fills when allowPartialFills is false", () => {
    const engine = new RiskEngine(
      { risk: { ...defaultRiskConfig, allowPartialFills: false } } as never,
      { isActive: vi.fn().mockReturnValue(false), trigger: vi.fn(), getReason: () => undefined, getLastTriggeredAt: () => undefined } as never,
      { getHighestLatency: () => 30 } as never
    );
    const result = engine.evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: true,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("PARTIAL_FILL_NOT_ALLOWED");
  });

  it("rejects when circuit breaker is active", () => {
    const engine = new RiskEngine(
      { risk: { ...defaultRiskConfig, circuitBreakerEnabled: true } } as never,
      {
        isActive: vi.fn().mockReturnValue(true), // active breaker
        trigger: vi.fn(),
        getReason: () => "Test breaker",
        getLastTriggeredAt: () => undefined
      } as never,
      { getHighestLatency: () => 30 } as never
    );
    const result = engine.evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost()
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons).toContain("CIRCUIT_BREAKER_ACTIVE");
  });

  it("returns deduplicated reasons when multiple conditions fail", () => {
    const result = makeEngine().evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: false,
      liquidityOk: false,
      partialFill: false,
      score: goodScore(),
      cost: goodCost({ netProfit: -5 })
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons.length).toBe(new Set(result.reasons).size); // no duplicates
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it("triggers circuit breaker when cumulative P&L is below stop threshold", () => {
    const breaker = {
      isActive: vi.fn().mockReturnValue(false),
      trigger: vi.fn(),
      getReason: () => undefined,
      getLastTriggeredAt: () => undefined
    };
    const engine = new RiskEngine(
      { risk: { ...defaultRiskConfig, maxNegativePnLBeforeStop: -100 } } as never,
      breaker as never,
      { getHighestLatency: () => 30 } as never
    );
    engine.evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      walletOk: true,
      liquidityOk: true,
      partialFill: false,
      score: goodScore(),
      cost: goodCost(),
      currentNetPnl: -500 // below threshold
    });
    expect(breaker.trigger).toHaveBeenCalled();
  });
});
