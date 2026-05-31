import { BadRequestException } from "@nestjs/common";
import type { BotConfig, ExchangeConnectionStatus } from "@arbix/shared";
import { describe, expect, it, vi, afterEach } from "vitest";
import { MarketDataService } from "./market-data.service.js";

const risk = {
  minNetProfitPercent: 0.05,
  maxTradeSize: 0.25,
  maxLatencyMs: 1000,
  maxOrderBookAgeMs: 3000,
  maxSlippagePercent: 0.1,
  allowPartialFills: true,
  autoSimulationEnabled: true,
  circuitBreakerEnabled: true,
  maxRejectedOpportunitiesPerMinute: 1000,
  maxNegativePnLBeforeStop: -250,
  minLiquidityScore: 40
};

function makeService() {
  let marketMode: BotConfig["marketMode"] = "LIVE";
  let service: MarketDataService;

  const config = {
    get marketMode() {
      return marketMode;
    },
    get enabledExchanges() {
      return ["BINANCE", "KRAKEN"];
    },
    get symbols() {
      return ["BTC/USDT"];
    },
    get risk() {
      return risk;
    },
    updateConfig: vi.fn((partial: Partial<BotConfig>) => {
      if (partial.marketMode) marketMode = partial.marketMode;
      return { marketMode } as BotConfig;
    })
  };

  const store = {
    clear: vi.fn(),
    getSnapshots: vi.fn(() => []),
    upsertOrderBook: vi.fn(),
    upsertQuote: vi.fn()
  };
  const arbitrage = { reset: vi.fn(), evaluateSymbol: vi.fn() };
  const realtime = { publish: vi.fn() };
  const circuitBreaker = { isActive: vi.fn(() => false), clear: vi.fn() };
  const latency = { clear: vi.fn(), update: vi.fn() };
  const replayBuffer = { clear: vi.fn(), push: vi.fn(), size: vi.fn(() => 0), getSnapshot: vi.fn(() => []) };
  const persistence = {
    saveExchangeStatus: vi.fn(),
    saveOrderBookSnapshot: vi.fn(),
    saveMarketSnapshot: vi.fn(),
    saveLatencyMetric: vi.fn(),
    saveReplayEvent: vi.fn(),
    loadRecentMarketSnapshots: vi.fn(async () => [])
  };

  service = new MarketDataService(
    config as never,
    store as never,
    arbitrage as never,
    realtime as never,
    circuitBreaker as never,
    latency as never,
    replayBuffer as never,
    persistence as never
  );

  return { service, config, get marketMode() { return marketMode; } };
}

describe("MarketDataService scenario safety", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("rejects synthetic scenarios while effective mode is LIVE", async () => {
    const { service } = makeService();

    await expect(service.runScenario("profitable-arbitrage")).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getScenarioStatus()).toMatchObject({
      status: "FAILED",
      mode: "LIVE",
      adaptersApplied: 0
    });
  });

  it("Presentation Mode forces DEMO before starting the profitable scenario", async () => {
    const ctx = makeService();

    const result = await ctx.service.activatePresentationMode();

    expect(ctx.marketMode).toBe("DEMO");
    expect(ctx.config.updateConfig).toHaveBeenCalledWith({ marketMode: "DEMO" });
    expect(result).toMatchObject({
      presentationMode: true,
      previousMode: "LIVE",
      mode: "DEMO",
      scenario: "profitable"
    });
    expect((result.exchanges as ExchangeConnectionStatus[]).every((exchange) => exchange.mode === "DEMO")).toBe(true);

    await ctx.service.stop();
  });
});
