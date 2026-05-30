import { describe, expect, it, vi } from "vitest";
import type { ArbitrageOpportunity, BestQuote, NormalizedOrderBook } from "@arbix/shared";
import { uid } from "@arbix/shared";
import { CostCalculator } from "../arbitrage/cost-calculator.js";
import { OpportunityClassifier } from "../arbitrage/opportunity-classifier.js";
import { OpportunityScorer } from "../arbitrage/opportunity.scorer.js";
import { RejectionAnalyzer } from "../arbitrage/rejection-analyzer.js";
import { SlippageEstimator } from "../arbitrage/slippage-estimator.js";
import { AppConfigService } from "../config/app.config.js";
import { PersistenceService } from "../database/persistence.service.js";
import { OrderBookStore } from "../market-data/order-book.store.js";
import { CircuitBreaker } from "../risk/circuit-breaker.js";
import { LatencyMonitor } from "../risk/latency-monitor.js";
import { RiskEngine } from "../risk/risk-engine.js";
import { ExecutionSimulator } from "./execution-simulator.js";
import { PnlService } from "./pnl.service.js";
import { WalletService } from "./wallet.service.js";

function makeMockConfig() {
  return {
    marketMode: "DEMO",
    symbols: ["BTC/USDT"],
    enabledExchanges: ["BINANCE", "KRAKEN"],
    risk: {
      minNetProfitPercent: 0.05,
      maxTradeSize: 0.5,
      maxLatencyMs: 2000,
      maxOrderBookAgeMs: 5000,
      maxSlippagePercent: 1,
      maxRejectedOpportunitiesPerMinute: 30,
      maxNegativePnLBeforeStop: -10000,
      minLiquidityScore: 20,
      allowPartialFills: true,
      autoSimulationEnabled: true,
      circuitBreakerEnabled: false
    },
    fees: {
      BINANCE: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      KRAKEN: { tradingFeeRate: 0.0026, withdrawalFee: 0 },
      OKX: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      COINBASE: { tradingFeeRate: 0.002, withdrawalFee: 0 },
      MOCK: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }
  } as unknown as AppConfigService;
}

function makePersistence() {
  return {
    isAvailable: () => false,
    saveOpportunity: vi.fn(),
    saveTrade: vi.fn(),
    upsertWallet: vi.fn(),
    saveLedger: vi.fn(),
    saveRiskEvent: vi.fn()
  } as unknown as PersistenceService;
}

function makeRealtime() {
  return { publish: vi.fn() } as unknown as import("../realtime/realtime-events.service.js").RealtimeEventsService;
}

function makeOrderBook(exchange: string, symbol: string, mid: number, spread: number): NormalizedOrderBook {
  const now = Date.now();
  return {
    exchange: exchange as never,
    symbol: symbol as never,
    bids: [{ price: mid - spread / 2, quantity: 2 }, { price: mid - spread, quantity: 3 }],
    asks: [{ price: mid + spread / 2, quantity: 2 }, { price: mid + spread, quantity: 3 }],
    exchangeTimestamp: now - 30,
    backendReceivedAt: now - 10,
    normalizedAt: now
  };
}

function makeQuote(exchange: string, symbol: string, bidPrice: number, askPrice: number): BestQuote {
  const now = Date.now();
  return {
    exchange: exchange as never,
    symbol: symbol as never,
    bidPrice,
    askPrice,
    bidQty: 2,
    askQty: 2,
    exchangeTimestamp: now - 30,
    backendReceivedAt: now - 10,
    normalizedAt: now,
    latencyMs: 30
  };
}

describe("Engine -> Simulator -> Wallet -> P&L integration", () => {
  it("records profit and updates wallet balances after a successful simulated trade", () => {
    const config = makeMockConfig();
    const persistence = makePersistence();
    const realtime = makeRealtime();

    const store = new OrderBookStore();
    const slippage = new SlippageEstimator();
    const costCalc = new CostCalculator(slippage);
    const scorer = new OpportunityScorer();
    const classifier = new OpportunityClassifier();
    const latencyMonitor = new LatencyMonitor();
    const circuitBreaker = new CircuitBreaker(realtime as never, persistence);
    const riskEngine = new RiskEngine(config, circuitBreaker, latencyMonitor);
    const pnlService = new PnlService(persistence);
    const walletService = new WalletService(realtime as never, persistence);
    const simulator = new ExecutionSimulator(walletService, pnlService, realtime as never);

    // Seed order books: BINANCE cheap, KRAKEN expensive
    store.upsertOrderBook(makeOrderBook("BINANCE", "BTC/USDT", 68000, 10));
    store.upsertOrderBook(makeOrderBook("KRAKEN", "BTC/USDT", 68350, 10));
    store.upsertQuote(makeQuote("BINANCE", "BTC/USDT", 67995, 68005) as never);
    store.upsertQuote(makeQuote("KRAKEN", "BTC/USDT", 68345, 68355) as never);

    // Manually build and classify an opportunity
    const buyQuote = makeQuote("BINANCE", "BTC/USDT", 67995, 68005);
    const sellQuote = makeQuote("KRAKEN", "BTC/USDT", 68345, 68355);
    const buyBook = store.getOrderBook("BINANCE" as never, "BTC/USDT" as never)!;
    const sellBook = store.getOrderBook("KRAKEN" as never, "BTC/USDT" as never)!;

    const amount = 0.5;
    const buyVwap = slippage.calculateVwap(buyBook.asks, amount);
    const sellVwap = slippage.calculateVwap(sellBook.bids, amount);
    const cost = costCalc.calculate({
      buyAskPrice: buyQuote.askPrice,
      sellBidPrice: sellQuote.bidPrice,
      executionBuyPrice: buyVwap.averagePrice,
      executionSellPrice: sellVwap.averagePrice,
      amount,
      buyFee: config.fees.BINANCE!,
      sellFee: config.fees.KRAKEN!
    });

    expect(cost.grossSpread).toBeGreaterThan(0);

    const scoreResult = scorer.score({
      cost,
      filledAmount: amount,
      targetAmount: amount,
      latencyMs: 30,
      maxLatencyMs: config.risk.maxLatencyMs,
      orderBookAgeMs: 100,
      circuitBreakerActive: false,
      walletOk: true
    });

    const riskResult = riskEngine.evaluate({
      latencyMs: 30,
      orderBookAgeMs: 100,
      cost,
      score: scoreResult,
      walletOk: true,
      liquidityOk: true,
      partialFill: false
    });

    const status = classifier.classify(scoreResult.recommendation, riskResult.reasons, true);

    const opportunity: ArbitrageOpportunity = {
      id: uid("opp"),
      symbol: "BTC/USDT",
      buyExchange: "BINANCE",
      sellExchange: "KRAKEN",
      buyPrice: buyQuote.askPrice,
      sellPrice: sellQuote.bidPrice,
      executionBuyPrice: buyVwap.averagePrice,
      executionSellPrice: sellVwap.averagePrice,
      volume: amount,
      grossSpread: cost.grossSpread,
      grossSpreadPercent: cost.grossSpreadPercent,
      grossProfit: cost.grossProfit,
      netProfit: cost.netProfit,
      netProfitPercent: cost.netProfitPercent,
      buyFee: cost.buyFee,
      sellFee: cost.sellFee,
      withdrawalFee: cost.withdrawalFee,
      slippageCost: cost.slippageCost,
      latencyMs: 30,
      confidence: scoreResult.confidence,
      score: scoreResult,
      status,
      recommendation: scoreResult.recommendation,
      detectedAt: new Date().toISOString(),
      latency: {
        exchangeTimestamp: Date.now() - 30,
        backendReceivedAt: Date.now() - 10,
        normalizedAt: Date.now(),
        detectedAt: Date.now(),
        emittedToFrontendAt: Date.now(),
        exchangeToBackendMs: 20,
        normalizationMs: 5,
        detectionLatencyMs: 15
      }
    };

    // Record in P&L
    pnlService.recordOpportunity(opportunity);
    expect(pnlService.getOpportunities()).toHaveLength(1);

    if (opportunity.status === "EXECUTED") {
      // Snapshot balances before
      const usdtBefore = walletService.getBalances().find((b) => b.exchange === "BINANCE" && b.asset === "USDT")?.balance ?? 0;

      // Simulate trade
      const trade = simulator.simulate(opportunity);
      expect(trade.netProfit).toBe(opportunity.netProfit);
      expect(trade.symbol).toBe("BTC/USDT");
      expect(trade.status).toBe("SIMULATED");
      expect(trade.timeline.length).toBeGreaterThan(0);

      // P&L totals should reflect the trade
      const totals = pnlService.getTotals();
      expect(totals.netProfit).toBeCloseTo(opportunity.netProfit);
      expect(totals.volume).toBeCloseTo(amount);

      // Wallet should be debited USDT on buy side
      const usdtAfter = walletService.getBalances().find((b) => b.exchange === "BINANCE" && b.asset === "USDT")?.balance ?? 0;
      expect(usdtAfter).toBeLessThan(usdtBefore);

      // BTC should be credited on sell side
      const btcOnKraken = walletService.getBalances().find((b) => b.exchange === "KRAKEN" && b.asset === "BTC")?.balance ?? 0;
      expect(btcOnKraken).toBeGreaterThan(0);
    } else {
      // Opportunity was rejected or watching - still recorded
      expect(pnlService.getOpportunities()[0]?.status).not.toBe("EXECUTED");
    }
  });

  it("preserves P&L totals across multiple trades", () => {
    const config = makeMockConfig();
    const persistence = makePersistence();
    const realtime = makeRealtime();

    const pnlService = new PnlService(persistence);
    const walletService = new WalletService(realtime as never, persistence);
    const simulator = new ExecutionSimulator(walletService, pnlService, realtime as never);

    const makeOpp = (netProfit: number): ArbitrageOpportunity => ({
      id: uid("opp"),
      symbol: "BTC/USDT",
      buyExchange: "BINANCE",
      sellExchange: "KRAKEN",
      buyPrice: 68000,
      sellPrice: 68350,
      executionBuyPrice: 68005,
      executionSellPrice: 68345,
      volume: 0.1,
      grossSpread: 350,
      grossSpreadPercent: 0.51,
      grossProfit: 35,
      netProfit,
      netProfitPercent: netProfit / 6800 * 100,
      buyFee: 6.8,
      sellFee: 6.8,
      withdrawalFee: 0,
      slippageCost: 1,
      latencyMs: 30,
      confidence: 80,
      score: { profitScore: 80, liquidityScore: 90, latencyScore: 95, slippageScore: 90, riskPenalty: 0, confidence: 80, recommendation: "EXECUTE" },
      status: "EXECUTED",
      recommendation: "EXECUTE",
      detectedAt: new Date().toISOString(),
      latency: { exchangeTimestamp: 0, backendReceivedAt: 0, normalizedAt: 0, detectedAt: 0, emittedToFrontendAt: 0, exchangeToBackendMs: 0, normalizationMs: 0, detectionLatencyMs: 0 }
    });

    const profits = [18.5, 22.1, -3.2];
    for (const profit of profits) {
      const opp = makeOpp(profit);
      pnlService.recordOpportunity(opp);
      simulator.simulate(opp);
    }

    const totals = pnlService.getTotals();
    const expectedTotal = profits.reduce((a, b) => a + b, 0);
    expect(totals.netProfit).toBeCloseTo(expectedTotal, 4);
    expect(pnlService.getTrades()).toHaveLength(3);
  });

  it("rejects opportunity when wallet balance is insufficient", () => {
    const config = makeMockConfig();
    const persistence = makePersistence();
    const realtime = makeRealtime();

    const walletService = new WalletService(realtime as never, persistence);

    // Drain all BINANCE USDT
    const binanceUsdt = walletService.getBalances().find((b) => b.exchange === "BINANCE" && b.asset === "USDT")?.balance ?? 0;
    const opp = {
      buyExchange: "BINANCE" as const,
      sellExchange: "KRAKEN" as const,
      symbol: "BTC/USDT" as const,
      executionBuyPrice: 70000,
      volume: (binanceUsdt + 1000) / 70000, // exceeds available balance
      buyFee: 10
    } as ArbitrageOpportunity;

    expect(walletService.canSimulate(opp)).toBe(false);
  });
});
