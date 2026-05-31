import { Controller, Get } from "@nestjs/common";
import { AppConfigService } from "../config/app.config.js";
import { PersistenceService } from "../database/persistence.service.js";
import { PrismaService } from "../database/prisma.service.js";
import { MarketDataService } from "../market-data/market-data.service.js";
import { OrderBookStore } from "../market-data/order-book.store.js";
import { RiskEngine } from "../risk/risk-engine.js";

@Controller("health")
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly persistence: PersistenceService,
    private readonly marketData: MarketDataService,
    private readonly store: OrderBookStore,
    private readonly risk: RiskEngine
  ) {}

  @Get()
  getHealth() {
    const exchangeStatuses = this.marketData.getExchangeStatus();
    const orderBooks = this.store.getOrderBookSnapshots();
    const snapshots = this.store.getSnapshots();
    const botStatus = this.marketData.getStatus();

    const now = Date.now();
    const oldestBookAgeMs = orderBooks.length > 0 ? Math.max(...orderBooks.map((b) => b.ageMs)) : null;
    const isStale = oldestBookAgeMs !== null && oldestBookAgeMs > 5000;

    const lastQuoteByExchange = snapshots.reduce<Record<string, number>>((acc, s) => {
      const age = now - new Date(s.lastUpdate).getTime();
      if (!acc[s.exchange] || age < (acc[s.exchange] ?? Infinity)) {
        acc[s.exchange] = age;
      }
      return acc;
    }, {});

    const riskStatus = this.risk.getStatus();
    const persistenceStatus = this.persistence.getPersistenceStatus();

    const allConnected = exchangeStatuses.length > 0 && exchangeStatuses.every((s) => s.status === "CONNECTED");
    // A tripped circuit breaker is a degraded condition: surface it honestly so
    // a green /health never masks a halted engine.
    const overallStatus = allConnected && !isStale && !riskStatus.circuitBreakerActive ? "ok" : "degraded";

    const engineStatus = botStatus.running ? "ACTIVE" : "IDLE";

    return {
      status: overallStatus,
      service: "arbix-api",
      version: "0.1.0",
      mode: this.config.marketMode,
      config: this.config.getEffectiveConfig().sources,
      uptime: Math.floor(process.uptime()),
      database: this.prisma.isAvailable() ? "connected" : "optional",
      persistence: persistenceStatus,
      botRunning: botStatus.running,
      symbols: botStatus.symbols,
      risk: {
        circuitBreakerActive: riskStatus.circuitBreakerActive,
        currentRiskLevel: riskStatus.currentRiskLevel,
        reason: riskStatus.reason ?? null,
        highestLatencyMs: riskStatus.currentHighestLatencyMs
      },
      services: {
        // Engine-bound services reflect whether the bot loop is running.
        marketData: engineStatus,
        arbitrageEngine: engineStatus,
        riskEngine: engineStatus,
        // Real circuit-breaker state — not a hard-coded "AVAILABLE".
        circuitBreaker: riskStatus.circuitBreakerActive ? "TRIGGERED" : "CLEAR",
        // Persistence reflects real DB availability and whether writes are being dropped.
        persistence: !persistenceStatus.available
          ? "DEGRADED"
          : persistenceStatus.droppedWrites > 0
            ? "DROPPING_WRITES"
            : "CONNECTED",
        // These are in-memory singletons with no external dependency.
        walletService: "AVAILABLE",
        simulator: "AVAILABLE",
        pnlService: "AVAILABLE",
        analyticsService: "AVAILABLE"
      },
      exchanges: exchangeStatuses.map((s) => ({
        exchange: s.exchange,
        status: s.status,
        mode: s.mode,
        symbols: s.symbols,
        lastMessageAgoMs: s.lastMessageAt ? now - s.lastMessageAt : null,
        error: s.error ?? null
      })),
      orderBooks: {
        count: orderBooks.length,
        oldestAgeMs: oldestBookAgeMs,
        stale: isStale
      },
      lastQuoteAgeMs: lastQuoteByExchange,
      timestamp: new Date().toISOString()
    };
  }
}
