import { Controller, Get } from "@nestjs/common";
import { AppConfigService } from "../config/app.config.js";
import { PrismaService } from "../database/prisma.service.js";
import { MarketDataService } from "../market-data/market-data.service.js";
import { OrderBookStore } from "../market-data/order-book.store.js";

@Controller("health")
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
    private readonly store: OrderBookStore
  ) {}

  @Get()
  getHealth() {
    const exchangeStatuses = this.marketData.getExchangeStatus();
    const orderBooks = this.store.getOrderBookSnapshots();
    const snapshots = this.store.getSnapshots();

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

    const allConnected = exchangeStatuses.length > 0 && exchangeStatuses.every((s) => s.status === "CONNECTED");
    const overallStatus = allConnected && !isStale ? "ok" : "degraded";

    return {
      status: overallStatus,
      service: "arbix-api",
      version: "0.1.0",
      mode: this.config.marketMode,
      uptime: Math.floor(process.uptime()),
      database: this.prisma.isAvailable() ? "connected" : "optional",
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
