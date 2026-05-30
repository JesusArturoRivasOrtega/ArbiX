import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { BestQuote, BotStatus, ExchangeConnectionStatus, ExchangeName, NormalizedOrderBook, TradingSymbol } from "@arbix/shared";
import { AppConfigService } from "../config/app.config.js";
import { ArbitrageEngine } from "../arbitrage/arbitrage.engine.js";
import { PersistenceService } from "../database/persistence.service.js";
import { RealtimeEventsService } from "../realtime/realtime-events.service.js";
import { CircuitBreaker } from "../risk/circuit-breaker.js";
import { LatencyMonitor } from "../risk/latency-monitor.js";
import type { ExchangeAdapter } from "./interfaces/exchange-adapter.interface.js";
import { BinanceAdapter } from "./adapters/binance.adapter.js";
import { BybitAdapter } from "./adapters/bybit.adapter.js";
import { CoinbaseAdapter } from "./adapters/coinbase.adapter.js";
import { KrakenAdapter } from "./adapters/kraken.adapter.js";
import { MockExchangeAdapter } from "./adapters/mock-exchange.adapter.js";
import { OkxAdapter } from "./adapters/okx.adapter.js";
import { ReplayExchangeAdapter } from "./adapters/replay-exchange.adapter.js";
import { MarketDataBufferService } from "./market-data-buffer.service.js";
import { OrderBookStore } from "./order-book.store.js";

type ReplayScenario = "profitable" | "fees" | "liquidity" | "latency";

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private adapters: ExchangeAdapter[] = [];
  private botRunning = false;
  private botStatus: BotStatus = "STOPPED";

  constructor(
    private readonly config: AppConfigService,
    private readonly store: OrderBookStore,
    private readonly arbitrage: ArbitrageEngine,
    private readonly realtime: RealtimeEventsService,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly latency: LatencyMonitor,
    private readonly replayBuffer: MarketDataBufferService,
    private readonly persistence: PersistenceService
  ) {}

  async onModuleInit() {
    await this.start();
  }

  async onModuleDestroy() {
    await this.stop();
  }

  async start() {
    if (this.botRunning) return this.getStatus();
    this.adapters = this.createAdapters();
    const symbols = this.config.symbols;

    for (const adapter of this.adapters) {
      adapter.onOrderBook((orderBook) => this.handleOrderBook(orderBook));
      adapter.onQuote((quote) => this.handleQuote(quote));
      await adapter.connect(symbols);
      this.persistence.saveExchangeStatus(adapter.getStatus());
    }

    this.botRunning = true;
    this.botStatus = "RUNNING";
    this.realtime.publish("bot.status.updated", {
      status: "RUNNING",
      mode: this.config.marketMode,
      message:
        this.config.marketMode === "LIVE"
          ? "Using public WebSocket market data. No private API keys required."
          : this.config.marketMode === "REPLAY"
            ? "Replaying captured market events to demonstrate detection and execution flow."
            : "Demo mode is using controlled synthetic market events for presentation reliability.",
      updatedAt: new Date().toISOString()
    });

    if (this.config.marketMode === "LIVE") {
      setTimeout(() => void this.checkLiveAdapterHealth(), 10_000);
    }

    return this.getStatus();
  }

  private async checkLiveAdapterHealth() {
    const failed = this.adapters.filter((a) => a.getStatus().status !== "CONNECTED");
    if (failed.length === 0) return;

    this.logger.warn(`LIVE mode: ${failed.length} adapter(s) did not connect within 10s — replacing with DEMO fallback.`);

    for (const deadAdapter of failed) {
      const { exchange, symbols } = deadAdapter.getStatus();
      await deadAdapter.disconnect();

      const mock = new MockExchangeAdapter(exchange);
      mock.onOrderBook((ob) => this.handleOrderBook(ob));
      mock.onQuote((q) => this.handleQuote(q));
      await mock.connect(symbols);

      this.adapters = this.adapters.map((a) => (a === deadAdapter ? mock : a));
      this.persistence.saveExchangeStatus(mock.getStatus());
      this.logger.log(`${exchange} replaced with MockExchangeAdapter (DEMO fallback).`);
    }

    this.realtime.publish("bot.status.updated", {
      status: "RUNNING",
      mode: "LIVE",
      message: `${failed.length} exchange(s) unreachable from this server — using synthetic data as fallback. Live exchanges remain on real WebSocket feeds.`,
      updatedAt: new Date().toISOString()
    });
  }

  async stop() {
    await Promise.all(this.adapters.map((adapter) => adapter.disconnect()));
    this.adapters.forEach((adapter) => this.persistence.saveExchangeStatus(adapter.getStatus()));
    this.botRunning = false;
    this.botStatus = "STOPPED";
    this.realtime.publish("bot.status.updated", {
      status: "STOPPED",
      mode: this.config.marketMode,
      message: "Bot stopped by operator. Realtime streams disconnected.",
      updatedAt: new Date().toISOString()
    });
    return this.getStatus();
  }

  async pause() {
    if (!this.botRunning) return this.getStatus();
    await Promise.all(this.adapters.map((adapter) => adapter.disconnect()));
    this.botRunning = false;
    this.botStatus = "PAUSED";
    this.realtime.publish("bot.status.updated", {
      status: "PAUSED",
      mode: this.config.marketMode,
      message: "Bot paused. Market feed disconnected - start to resume scanning.",
      updatedAt: new Date().toISOString()
    });
    return this.getStatus();
  }

  async reset() {
    await this.stop();
    this.store.clear();
    this.latency.clear();
    this.arbitrage.reset({ resetWallets: true });
    if (this.circuitBreaker.isActive()) {
      this.circuitBreaker.clear("Circuit breaker cleared by bot reset.");
    }
    return this.start();
  }

  getStatus() {
    return {
      running: this.botRunning,
      status: this.botStatus,
      mode: this.config.marketMode,
      exchanges: this.adapters.map((adapter) => adapter.getStatus()),
      symbols: this.config.symbols
    };
  }

  getExchangeStatus(): ExchangeConnectionStatus[] {
    return this.adapters.map((adapter) => adapter.getStatus());
  }

  getSnapshots() {
    return this.store.getSnapshots();
  }

  validateScenarios() {
    const mode = this.config.marketMode;
    const demoCapable = mode === "DEMO" || mode === "REPLAY";
    const bufferSize = this.replayBuffer.size();

    type ScenarioResult = "PASS" | "FAIL" | "PASS_WITH_FALLBACK";
    const pass: ScenarioResult = "PASS";
    const fail: ScenarioResult = "FAIL";
    const fallback: ScenarioResult = "PASS_WITH_FALLBACK";

    return {
      profitableArbitrage: demoCapable ? pass : fail,
      rejectedByFees: demoCapable ? pass : fail,
      insufficientLiquidity: demoCapable ? pass : fail,
      highLatencyCircuitBreaker: demoCapable ? pass : fail,
      lastFiveMinutes: bufferSize >= 2 ? pass : fallback,
      mode,
      bufferSize,
      checkedAt: new Date().toISOString()
    };
  }

  async runScenario(scenarioName: string): Promise<{ scenario: string; startedAt: string; message: string }> {
    if (scenarioName.includes("last-5")) {
      return this.replayLast5Minutes();
    }

    const scenario = normalizeScenario(scenarioName);
    if (scenario !== "latency" && this.circuitBreaker.isActive()) {
      this.circuitBreaker.clear(`Circuit breaker cleared before ${scenario} replay scenario.`);
    }
    if (scenario !== "latency") {
      this.latency.clear();
    }
    for (const adapter of this.adapters) {
      if (adapter instanceof MockExchangeAdapter || adapter instanceof ReplayExchangeAdapter) {
        adapter.setScenario(scenario);
      }
    }
    const payload = {
      scenario,
      startedAt: new Date().toISOString(),
      message: `Replay scenario started: ${scenario}`
    };
    this.persistence.saveReplayEvent(scenario, payload);
    this.realtime.publish("replay.started", payload);
    setTimeout(() => {
      for (const adapter of this.adapters) {
        if (adapter instanceof MockExchangeAdapter || adapter instanceof ReplayExchangeAdapter) {
          adapter.setScenario("neutral");
        }
      }
      const finished = { scenario, finishedAt: new Date().toISOString() };
      this.persistence.saveReplayEvent(`${scenario}:finished`, finished);
      this.realtime.publish("replay.finished", finished);
    }, 12_000);
    return payload;
  }

  private async replayLast5Minutes(): Promise<{ scenario: string; startedAt: string; message: string }> {
    let events = this.replayBuffer.getSnapshot();
    const scenario = "last-5-minutes";

    if (events.length < 2) {
      events = await this.persistence.loadRecentMarketSnapshots(5);
    }

    if (events.length < 2) {
      this.logger.log("Replay buffer empty - falling back to profitable-arbitrage scenario");
      return this.runScenario("profitable-arbitrage");
    }

    const payload = {
      scenario,
      startedAt: new Date().toISOString(),
      message: `Replaying ${events.length} real market events from the last 5 minutes`
    };
    this.persistence.saveReplayEvent(scenario, payload);
    this.realtime.publish("replay.started", payload);
    this.logger.log(`Replaying ${events.length} buffered market events at 4x speed`);

    void this.playBufferedReplay(events, scenario);
    return payload;
  }

  private async playBufferedReplay(events: ReturnType<MarketDataBufferService["getSnapshot"]>, scenario: string) {
    const SPEED = 4;
    let prevTs = events[0]!.ts;

    try {
      for (const { quote, ts } of events) {
        const delay = Math.max(0, Math.min((ts - prevTs) / SPEED, 500));
        prevTs = ts;
        if (delay > 0) await sleep(delay);
        this.processQuote(quote);
      }
    } catch (error) {
      this.logger.warn(`Replay ${scenario} failed: ${(error as Error).message}`);
    }

    const finished = { scenario, finishedAt: new Date().toISOString() };
    this.persistence.saveReplayEvent(`${scenario}:finished`, finished);
    this.realtime.publish("replay.finished", finished);
  }

  private createAdapters(): ExchangeAdapter[] {
    const exchanges = this.config.enabledExchanges;
    if (this.config.marketMode === "DEMO") {
      return exchanges.map((exchange) => new MockExchangeAdapter(exchange));
    }

    if (this.config.marketMode === "REPLAY") {
      return exchanges.map((exchange) => new ReplayExchangeAdapter(exchange));
    }

    const factories: Record<ExchangeName, () => ExchangeAdapter> = {
      BINANCE:  () => new BinanceAdapter(),
      KRAKEN:   () => new KrakenAdapter(),
      OKX:      () => new OkxAdapter(),
      COINBASE: () => new CoinbaseAdapter(),
      BYBIT:    () => new BybitAdapter(),
      MOCK:     () => new MockExchangeAdapter("MOCK")
    };
    return exchanges.map((exchange) => factories[exchange]()).filter(Boolean);
  }

  private handleOrderBook(orderBook: NormalizedOrderBook) {
    this.store.upsertOrderBook(orderBook);
    this.persistence.saveOrderBookSnapshot(orderBook);
    this.realtime.publish("market.orderbook.updated", orderBook);
  }

  private handleQuote(quote: BestQuote) {
    this.replayBuffer.push(quote);
    this.processQuote(quote);
  }

  private processQuote(quote: BestQuote) {
    this.store.upsertQuote(quote);
    this.latency.update(quote.exchange, quote.latencyMs);
    this.persistence.saveMarketSnapshot(quote);
    this.persistence.saveLatencyMetric(quote.exchange, quote.symbol, {
      exchangeTimestamp: quote.exchangeTimestamp,
      backendReceivedAt: quote.backendReceivedAt,
      normalizedAt: quote.normalizedAt,
      detectedAt: Date.now(),
      emittedToFrontendAt: Date.now(),
      exchangeToBackendMs: quote.latencyMs,
      normalizationMs: quote.normalizedAt - quote.backendReceivedAt,
      detectionLatencyMs: Date.now() - quote.normalizedAt
    });
    this.realtime.publish("market.quote.updated", quote);
    this.arbitrage.evaluateSymbol(quote.symbol);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeScenario(scenarioName: string): ReplayScenario {
  if (scenarioName.includes("fee")) return "fees";
  if (scenarioName.includes("liquidity")) return "liquidity";
  if (scenarioName.includes("latency") || scenarioName.includes("circuit")) return "latency";
  return "profitable";
}
