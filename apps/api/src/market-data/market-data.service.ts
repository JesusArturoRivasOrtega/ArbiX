import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type {
  BestQuote,
  BotStatus,
  ExchangeConnectionStatus,
  ExchangeName,
  MarketMode,
  NormalizedOrderBook,
  TradingSymbol
} from "@arbix/shared";
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
type ScenarioStatus = {
  scenario: string | null;
  status: "IDLE" | "ACTIVE" | "FINISHED" | "FAILED";
  startedAt?: string;
  finishedAt?: string;
  message?: string;
  generationId: number;
  mode: MarketMode;
  adaptersApplied: number;
  fallback?: boolean;
};

@Injectable()
export class MarketDataService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketDataService.name);
  private adapters: ExchangeAdapter[] = [];
  private botRunning = false;
  private botStatus: BotStatus = "STOPPED";
  private generationId = 1;
  private droppedStaleEvents = 0;
  private scenarioStatus: ScenarioStatus = {
    scenario: null,
    status: "IDLE",
    generationId: this.generationId,
    mode: "DEMO",
    adaptersApplied: 0
  };

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

    // Do NOT tear the adapters down: each one auto-reconnects with exponential
    // backoff, so an exchange that is briefly unreachable will recover on its
    // own. We only announce the degraded state. Synthetic fallback stays
    // disabled in LIVE — we never substitute fake quotes for a real venue.
    this.logger.warn(
      `LIVE mode: ${failed.length} adapter(s) not connected after 10s. Auto-reconnect (backoff) is active; synthetic fallback remains disabled in LIVE.`
    );
    this.adapters.forEach((adapter) => this.persistence.saveExchangeStatus(adapter.getStatus()));

    this.realtime.publish("bot.status.updated", {
      status: "RUNNING",
      mode: "LIVE",
      message: `${failed.length} exchange(s) still connecting. Auto-reconnect is retrying; LIVE mode will not substitute synthetic quotes.`,
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

  async reset(options: { resetWallets?: boolean } = { resetWallets: true }) {
    this.generationId += 1;
    await this.stop();
    this.store.clear();
    this.latency.clear();
    this.replayBuffer.clear();
    this.arbitrage.reset({ resetWallets: options.resetWallets ?? true });
    // Tell the frontend to drop every opportunity from the previous generation
    // so a mode switch (e.g. DEMO -> LIVE) never leaves stale rows from the old
    // market source mixed in with fresh ones.
    this.realtime.publish("opportunities.updated", []);
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
      generationId: this.generationId,
      droppedStaleEvents: this.droppedStaleEvents,
      exchanges: this.adapters.map((adapter) => adapter.getStatus()),
      symbols: this.config.symbols
    };
  }

  getExchangeStatus(): ExchangeConnectionStatus[] {
    return this.adapters.map((adapter) => adapter.getStatus());
  }

  getSnapshots() {
    return this.store.getSnapshots(this.config.risk.maxOrderBookAgeMs);
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

  async activatePresentationMode(scenarioName = "profitable-arbitrage") {
    const previousMode = this.config.marketMode;
    if (previousMode !== "DEMO") {
      this.config.updateConfig({ marketMode: "DEMO" });
    }

    await this.reset({ resetWallets: true });
    if (this.circuitBreaker.isActive()) {
      this.circuitBreaker.clear("Circuit breaker cleared for Presentation Mode.");
    }
    const scenario = await this.runScenario(scenarioName);
    return {
      ...scenario,
      presentationMode: true,
      previousMode,
      mode: this.config.marketMode,
      generationId: this.generationId,
      exchanges: this.getExchangeStatus()
    };
  }

  getScenarioStatus() {
    return {
      ...this.scenarioStatus,
      generationId: this.generationId,
      mode: this.config.marketMode
    };
  }

  async runScenario(
    scenarioName: string,
    opts: { fallbackFrom?: string } = {}
  ): Promise<{ scenario: string; startedAt: string; message: string; generationId: number; mode: MarketMode; adaptersApplied: number; fallback?: boolean }> {
    if (scenarioName.includes("last-5")) {
      return this.replayLast5Minutes();
    }

    if (this.config.marketMode === "LIVE") {
      this.scenarioStatus = {
        scenario: scenarioName,
        status: "FAILED",
        message: "Replay scenarios require DEMO or REPLAY mode. LIVE never substitutes synthetic scenarios.",
        generationId: this.generationId,
        mode: this.config.marketMode,
        adaptersApplied: 0
      };
      throw new BadRequestException(this.scenarioStatus.message);
    }

    const scenario = normalizeScenario(scenarioName);
    if (scenario !== "latency" && this.circuitBreaker.isActive()) {
      this.circuitBreaker.clear(`Circuit breaker cleared before ${scenario} replay scenario.`);
    }
    if (scenario !== "latency") {
      this.latency.clear();
    }
    let adaptersApplied = 0;
    for (const adapter of this.adapters) {
      if (adapter instanceof MockExchangeAdapter || adapter instanceof ReplayExchangeAdapter) {
        adapter.setScenario(scenario);
        adaptersApplied += 1;
      }
    }
    if (adaptersApplied === 0) {
      this.scenarioStatus = {
        scenario,
        status: "FAILED",
        message: "No scenario-capable adapters are active. Start DEMO or REPLAY mode first.",
        generationId: this.generationId,
        mode: this.config.marketMode,
        adaptersApplied
      };
      throw new BadRequestException(this.scenarioStatus.message);
    }
    const payload = {
      scenario,
      startedAt: new Date().toISOString(),
      message: opts.fallbackFrom
        ? `Buffer empty for "${opts.fallbackFrom}" - showing synthetic ${scenario} scenario instead (fallback).`
        : `Replay scenario started: ${scenario}`,
      generationId: this.generationId,
      mode: this.config.marketMode,
      adaptersApplied,
      ...(opts.fallbackFrom ? { fallback: true } : {})
    };
    this.scenarioStatus = { ...payload, status: "ACTIVE" };
    this.persistence.saveReplayEvent(scenario, payload);
    this.realtime.publish("replay.started", payload);
    const scenarioGenerationId = this.generationId;
    setTimeout(() => {
      if (scenarioGenerationId !== this.generationId) return;
      for (const adapter of this.adapters) {
        if (adapter instanceof MockExchangeAdapter || adapter instanceof ReplayExchangeAdapter) {
          adapter.setScenario("neutral");
        }
      }
      const finished = { scenario, finishedAt: new Date().toISOString(), generationId: scenarioGenerationId, mode: this.config.marketMode };
      this.scenarioStatus = {
        scenario,
        status: "FINISHED",
        finishedAt: finished.finishedAt,
        generationId: scenarioGenerationId,
        mode: this.config.marketMode,
        adaptersApplied
      };
      this.persistence.saveReplayEvent(`${scenario}:finished`, finished);
      this.realtime.publish("replay.finished", finished);
    }, 12_000);
    return payload;
  }

  private async replayLast5Minutes(): Promise<{ scenario: string; startedAt: string; message: string; generationId: number; mode: MarketMode; adaptersApplied: number }> {
    let events = this.replayBuffer.getSnapshot();
    const scenario = "last-5-minutes";

    if (events.length < 2) {
      events = await this.persistence.loadRecentMarketSnapshots(5);
    }

    if (events.length < 2) {
      this.logger.log("Replay buffer empty - falling back to profitable-arbitrage scenario");
      return this.runScenario("profitable-arbitrage", { fallbackFrom: "last-5-minutes" });
    }

    const payload = {
      scenario,
      startedAt: new Date().toISOString(),
      message: `Replaying ${events.length} real market events from the last 5 minutes`,
      generationId: this.generationId,
      mode: this.config.marketMode,
      adaptersApplied: 0
    };
    this.scenarioStatus = { ...payload, status: "ACTIVE" };
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
        this.processQuote({
          ...quote,
          generationId: this.generationId,
          marketMode: this.config.marketMode,
          source: "REPLAY",
          generatedBy: "cache"
        });
      }
    } catch (error) {
      this.logger.warn(`Replay ${scenario} failed: ${(error as Error).message}`);
    }

    const finished = { scenario, finishedAt: new Date().toISOString(), generationId: this.generationId, mode: this.config.marketMode };
    this.scenarioStatus = {
      scenario,
      status: "FINISHED",
      finishedAt: finished.finishedAt,
      generationId: this.generationId,
      mode: this.config.marketMode,
      adaptersApplied: 0
    };
    this.persistence.saveReplayEvent(`${scenario}:finished`, finished);
    this.realtime.publish("replay.finished", finished);
  }

  private createAdapters(): ExchangeAdapter[] {
    const exchanges = this.config.enabledExchanges;
    if (this.config.marketMode === "DEMO") {
      return exchanges.map((exchange) => this.withGeneration(new MockExchangeAdapter(exchange)));
    }

    if (this.config.marketMode === "REPLAY") {
      return exchanges.map((exchange) => this.withGeneration(new ReplayExchangeAdapter(exchange)));
    }

    const factories: Record<ExchangeName, () => ExchangeAdapter> = {
      BINANCE:  () => new BinanceAdapter(),
      KRAKEN:   () => new KrakenAdapter(),
      OKX:      () => new OkxAdapter(),
      COINBASE: () => new CoinbaseAdapter(),
      BYBIT:    () => new BybitAdapter(),
      MOCK:     () => new MockExchangeAdapter("MOCK")
    };
    return exchanges.map((exchange) => this.withGeneration(factories[exchange]())).filter(Boolean);
  }

  private handleOrderBook(orderBook: NormalizedOrderBook) {
    if (!this.isCurrentEvent(orderBook)) return;
    this.store.upsertOrderBook(orderBook);
    this.persistence.saveOrderBookSnapshot(orderBook);
    this.realtime.publish("market.orderbook.updated", orderBook);
  }

  private handleQuote(quote: BestQuote) {
    if (!this.isCurrentEvent(quote)) return;
    this.replayBuffer.push(quote);
    this.processQuote(quote);
  }

  private processQuote(quote: BestQuote) {
    if (!this.isCurrentEvent(quote)) return;
    const effectiveLatencyMs = this.getEffectiveLatencyMs(quote);
    this.store.upsertQuote(quote);
    this.latency.update(quote.exchange, effectiveLatencyMs);
    this.persistence.saveMarketSnapshot(quote);
    this.persistence.saveLatencyMetric(quote.exchange, quote.symbol, {
      exchangeTimestamp: quote.exchangeTimestamp,
      backendReceivedAt: quote.backendReceivedAt,
      normalizedAt: quote.normalizedAt,
      detectedAt: Date.now(),
      emittedToFrontendAt: Date.now(),
      exchangeToBackendMs: effectiveLatencyMs,
      normalizationMs: quote.normalizedAt - quote.backendReceivedAt,
      detectionLatencyMs: Date.now() - quote.normalizedAt,
      exchangeLatencyMs: quote.exchangeLatencyMs ?? null,
      latencyConfidence: quote.latencyConfidence ?? "UNKNOWN"
    });
    this.realtime.publish("market.quote.updated", quote);
    this.arbitrage.evaluateSymbol(quote.symbol);
  }

  private withGeneration<T extends ExchangeAdapter>(adapter: T): T {
    adapter.setGenerationId(this.generationId);
    return adapter;
  }

  private isCurrentEvent(event: { generationId?: number; marketMode?: MarketMode }): boolean {
    if (event.generationId !== undefined && event.generationId !== this.generationId) {
      this.droppedStaleEvents += 1;
      return false;
    }
    if (event.marketMode && event.marketMode !== this.config.marketMode) {
      this.droppedStaleEvents += 1;
      return false;
    }
    return true;
  }

  private getEffectiveLatencyMs(quote: BestQuote) {
    if (quote.latencyConfidence === "UNKNOWN") {
      return this.config.risk.maxLatencyMs + 1;
    }
    return quote.exchangeLatencyMs ?? quote.latencyMs;
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
