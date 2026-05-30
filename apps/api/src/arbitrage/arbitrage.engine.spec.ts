import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BestQuote, NormalizedOrderBook, TradingSymbol } from "@arbix/shared";
import { ArbitrageEngine } from "./arbitrage.engine.js";

function makeQuote(exchange: string, symbol: TradingSymbol, bid: number, ask: number): BestQuote {
  const now = Date.now();
  return {
    exchange: exchange as never,
    symbol,
    bidPrice: bid,
    askPrice: ask,
    bidQty: 1,
    askQty: 1,
    latencyMs: 20,
    exchangeTimestamp: now - 20,
    backendReceivedAt: now - 5,
    normalizedAt: now
  };
}

function makeBook(exchange: string, symbol: TradingSymbol, midPrice: number): NormalizedOrderBook {
  const now = Date.now();
  const asks = Array.from({ length: 5 }, (_, i) => ({ price: midPrice + i * 5, quantity: 0.5 }));
  const bids = Array.from({ length: 5 }, (_, i) => ({ price: midPrice - (i + 1) * 5, quantity: 0.5 }));
  return {
    exchange: exchange as never,
    symbol,
    bids,
    asks,
    exchangeTimestamp: now - 20,
    backendReceivedAt: now - 5,
    normalizedAt: now,
    sequence: 1
  };
}

function makeDeps() {
  const store = {
    getQuotesBySymbol: vi.fn().mockReturnValue([]),
    getOrderBook: vi.fn().mockReturnValue(null),
    upsertOrderBook: vi.fn(),
    upsertQuote: vi.fn()
  };
  const config = {
    risk: {
      maxTradeSize: 0.5,
      maxLatencyMs: 1000,
      autoSimulationEnabled: true,
      minNetProfitPercent: 0.05,
      maxOrderBookAgeMs: 5000,
      maxSlippagePercent: 2,
      allowPartialFills: true,
      maxRejectedOpportunitiesPerMinute: 100,
      maxNegativePnLBeforeStop: -1000,
      minLiquidityScore: 0.1,
      circuitBreakerEnabled: true
    },
    fees: {
      BINANCE: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      KRAKEN: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      MOCK: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }
  };
  const costCalculator = {
    calculate: vi.fn().mockReturnValue({
      grossSpread: 200,
      grossSpreadPercent: 0.29,
      grossProfit: 100,
      buyCost: 34000,
      buyFee: 34,
      sellRevenue: 34200,
      sellFee: 34.2,
      withdrawalFee: 0,
      slippageCost: 10,
      netProfit: 21.8,
      netProfitPercent: 0.064,
      buySlippage: 5,
      buySlippagePercent: 0.015,
      sellSlippage: 5,
      sellSlippagePercent: 0.015
    })
  };
  const slippage = {
    calculateVwap: vi.fn().mockReturnValue({ averagePrice: 68200, filledAmount: 0.5, isPartialFill: false })
  };
  const scorer = {
    score: vi.fn().mockReturnValue({
      profitScore: 80,
      liquidityScore: 85,
      latencyScore: 95,
      slippageScore: 90,
      riskPenalty: 0,
      confidence: 88,
      recommendation: "EXECUTE"
    })
  };
  const classifier = { classify: vi.fn().mockReturnValue("EXECUTED") };
  const rejectionAnalyzer = { humanize: vi.fn().mockReturnValue(undefined) };
  const risk = { evaluate: vi.fn().mockReturnValue({ accepted: true, reasons: [], riskLevel: "LOW" }) };
  const circuitBreaker = { isActive: vi.fn().mockReturnValue(false) };
  const wallets = { canSimulate: vi.fn().mockReturnValue(true), applyTrade: vi.fn() };
  const simulator = { simulate: vi.fn(), reset: vi.fn() };
  const pnl = {
    recordOpportunity: vi.fn(),
    getOpportunities: vi.fn().mockReturnValue([]),
    getTotals: vi.fn().mockReturnValue({ netProfit: 0, grossProfit: 0, totalFees: 0 }),
    reset: vi.fn()
  };
  const realtime = { publish: vi.fn() };
  const latencyMonitor = { update: vi.fn(), clear: vi.fn() };
  const priceAnomaly = { update: vi.fn(), isAnomaly: vi.fn().mockReturnValue(false) };

  return { store, config, costCalculator, slippage, scorer, classifier, rejectionAnalyzer, risk, circuitBreaker, wallets, simulator, pnl, realtime, latencyMonitor, priceAnomaly };
}

function makeEngine(deps: ReturnType<typeof makeDeps>) {
  return new ArbitrageEngine(
    deps.store as never, deps.config as never, deps.costCalculator as never,
    deps.slippage as never, deps.scorer as never, deps.classifier as never,
    deps.rejectionAnalyzer as never, deps.risk as never, deps.circuitBreaker as never,
    deps.wallets as never, deps.simulator as never, deps.pnl as never,
    deps.realtime as never, deps.latencyMonitor as never, deps.priceAnomaly as never
  );
}

describe("ArbitrageEngine", () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
    vi.clearAllMocks();
  });

  it("does nothing when fewer than 2 quotes exist for the symbol", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([makeQuote("BINANCE", "BTC/USDT", 68000, 68100)]);
    makeEngine(deps).evaluateSymbol("BTC/USDT");
    expect(deps.realtime.publish).not.toHaveBeenCalled();
  });

  it("does nothing when both quotes are from the same exchange", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 68000, 68100),
      makeQuote("BINANCE", "BTC/USDT", 68200, 68300)
    ]);
    makeEngine(deps).evaluateSymbol("BTC/USDT");
    expect(deps.realtime.publish).not.toHaveBeenCalled();
  });

  it("skips when buy ask >= sell bid (no spread)", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 68000, 68200), // ask 68200
      makeQuote("KRAKEN", "BTC/USDT", 68100, 68300)   // bid 68100 — no arb
    ]);
    makeEngine(deps).evaluateSymbol("BTC/USDT");
    expect(deps.realtime.publish).not.toHaveBeenCalled();
  });

  it("skips when spread is below the minimum 0.03% threshold", () => {
    // Very narrow spread: ask=100.00, bid=100.02 → 0.02% < 0.03%
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 99.99, 100.00),
      makeQuote("KRAKEN", "BTC/USDT", 100.02, 100.05)
    ]);
    makeEngine(deps).evaluateSymbol("BTC/USDT");
    expect(deps.realtime.publish).not.toHaveBeenCalled();
  });

  it("evaluates and publishes opportunity.detected for a valid spread", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 67900, 68000),
      makeQuote("KRAKEN", "BTC/USDT", 68500, 68600)
    ]);
    deps.store.getOrderBook.mockReturnValue(makeBook("BINANCE", "BTC/USDT", 68000));

    makeEngine(deps).evaluateSymbol("BTC/USDT");

    expect(deps.realtime.publish).toHaveBeenCalledWith(
      "opportunity.detected",
      expect.objectContaining({ symbol: "BTC/USDT", buyExchange: "BINANCE", sellExchange: "KRAKEN" })
    );
  });

  it("calls simulator.simulate when classifier returns EXECUTED", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 67900, 68000),
      makeQuote("KRAKEN", "BTC/USDT", 68500, 68600)
    ]);
    deps.store.getOrderBook.mockReturnValue(makeBook("BINANCE", "BTC/USDT", 68000));
    deps.classifier.classify.mockReturnValue("EXECUTED");

    makeEngine(deps).evaluateSymbol("BTC/USDT");

    expect(deps.simulator.simulate).toHaveBeenCalled();
    expect(deps.realtime.publish).toHaveBeenCalledWith("opportunity.executed", expect.any(Object));
  });

  it("does not simulate when classifier returns REJECTED", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 67900, 68000),
      makeQuote("KRAKEN", "BTC/USDT", 68500, 68600)
    ]);
    deps.store.getOrderBook.mockReturnValue(makeBook("BINANCE", "BTC/USDT", 68000));
    deps.classifier.classify.mockReturnValue("REJECTED");

    makeEngine(deps).evaluateSymbol("BTC/USDT");

    expect(deps.simulator.simulate).not.toHaveBeenCalled();
    expect(deps.realtime.publish).toHaveBeenCalledWith("opportunity.rejected", expect.any(Object));
  });

  it("deduplicates the same exchange pair within 3 seconds", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 67900, 68000),
      makeQuote("KRAKEN", "BTC/USDT", 68500, 68600)
    ]);
    deps.store.getOrderBook.mockReturnValue(makeBook("BINANCE", "BTC/USDT", 68000));

    const engine = makeEngine(deps);
    engine.evaluateSymbol("BTC/USDT");
    engine.evaluateSymbol("BTC/USDT"); // should be deduped

    const detected = (deps.realtime.publish as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === "opportunity.detected"
    );
    expect(detected.length).toBe(1);
  });

  it("reset clears the dedupe map, allowing re-evaluation", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 67900, 68000),
      makeQuote("KRAKEN", "BTC/USDT", 68500, 68600)
    ]);
    deps.store.getOrderBook.mockReturnValue(makeBook("BINANCE", "BTC/USDT", 68000));

    const engine = makeEngine(deps);
    engine.evaluateSymbol("BTC/USDT");
    engine.reset();
    engine.evaluateSymbol("BTC/USDT");

    const detected = (deps.realtime.publish as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === "opportunity.detected"
    );
    expect(detected.length).toBe(2);
  });

  it("skips evaluation when price anomaly is detected", () => {
    deps.store.getQuotesBySymbol.mockReturnValue([
      makeQuote("BINANCE", "BTC/USDT", 67900, 68000),
      makeQuote("KRAKEN", "BTC/USDT", 68500, 68600)
    ]);
    deps.store.getOrderBook.mockReturnValue(makeBook("BINANCE", "BTC/USDT", 68000));
    deps.priceAnomaly.isAnomaly.mockReturnValue(true); // anomaly detected

    makeEngine(deps).evaluateSymbol("BTC/USDT");
    expect(deps.realtime.publish).not.toHaveBeenCalled();
  });
});
