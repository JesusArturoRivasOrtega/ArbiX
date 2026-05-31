import { Injectable, Logger } from "@nestjs/common";
import type {
  ArbitrageOpportunity,
  BestQuote,
  BotConfig,
  ExchangeConnectionStatus,
  ExchangeName,
  LatencyMetrics,
  NormalizedOrderBook,
  RiskEvent,
  SimulatedTrade,
  TradingSymbol,
  WalletBalance,
  WalletLedgerEntry
} from "@arbix/shared";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class PersistenceService {
  private readonly logger = new Logger(PersistenceService.name);
  private readonly maxQueueSize = 5000;
  private readonly batchSize = 250;
  private marketSnapshotQueue: BestQuote[] = [];
  private orderBookQueue: NormalizedOrderBook[] = [];
  private latencyQueue: Array<{ exchange: string; symbol: string; latency: LatencyMetrics }> = [];
  private flushTimer?: NodeJS.Timeout;
  private flushing = false;
  private droppedWrites = 0;

  constructor(private readonly prisma: PrismaService) {}

  saveExchangeStatus(status: ExchangeConnectionStatus) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.exchange
      .upsert({
        where: { name: status.exchange },
        update: { status: status.status, mode: status.mode },
        create: { name: status.exchange, status: status.status, mode: status.mode }
      })
      .catch((error) => this.logger.warn(`saveExchangeStatus failed: ${(error as Error).message}`));
  }

  saveMarketSnapshot(quote: BestQuote) {
    if (!this.prisma.isAvailable()) return;
    this.marketSnapshotQueue.push(quote);
    this.trimQueue(this.marketSnapshotQueue);
    this.scheduleFlush();
  }

  saveOrderBookSnapshot(orderBook: NormalizedOrderBook) {
    if (!this.prisma.isAvailable()) return;
    this.orderBookQueue.push(orderBook);
    this.trimQueue(this.orderBookQueue);
    this.scheduleFlush();
  }

  saveLatencyMetric(exchange: string, symbol: string, latency: LatencyMetrics) {
    if (!this.prisma.isAvailable()) return;
    this.latencyQueue.push({ exchange, symbol, latency });
    this.trimQueue(this.latencyQueue);
    this.scheduleFlush();
  }

  getPersistenceStatus() {
    return {
      available: this.prisma.isAvailable(),
      queues: {
        marketSnapshots: this.marketSnapshotQueue.length,
        orderBooks: this.orderBookQueue.length,
        latencyMetrics: this.latencyQueue.length
      },
      droppedWrites: this.droppedWrites,
      flushing: this.flushing
    };
  }

  saveReplayEvent(scenario: string, payload: Record<string, unknown>) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.replayEvent
      .create({
        data: {
          scenario,
          payload: JSON.parse(JSON.stringify(payload))
        }
      })
      .catch((error) => this.logger.warn(`saveReplayEvent failed: ${(error as Error).message}`));
  }

  saveBotConfig(config: BotConfig) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.botConfig
      .findFirst({ orderBy: { updatedAt: "desc" } })
      .then((existing) => {
        const data = {
          marketMode: config.marketMode,
          enabledExchanges: JSON.parse(JSON.stringify(config.enabledExchanges)),
          fees: JSON.parse(JSON.stringify(config.fees)),
          minNetProfitPercent: config.minNetProfitPercent,
          maxTradeSize: config.maxTradeSize,
          maxLatencyMs: config.maxLatencyMs,
          maxOrderBookAgeMs: config.maxOrderBookAgeMs,
          maxSlippagePercent: config.maxSlippagePercent,
          allowPartialFills: config.allowPartialFills,
          autoSimulationEnabled: config.autoSimulationEnabled,
          circuitBreakerEnabled: config.circuitBreakerEnabled,
          maxRejectedOpportunitiesPerMinute: config.maxRejectedOpportunitiesPerMinute,
          maxNegativePnLBeforeStop: config.maxNegativePnLBeforeStop,
          minLiquidityScore: config.minLiquidityScore
        };
        return existing ? this.prisma.botConfig.update({ where: { id: existing.id }, data }) : this.prisma.botConfig.create({ data });
      })
      .catch((error) => this.logger.warn(`saveBotConfig failed: ${(error as Error).message}`));
  }

  async loadBotConfig(): Promise<Partial<BotConfig> | undefined> {
    if (!this.prisma.isAvailable()) return undefined;
    const row = await this.prisma.botConfig.findFirst({ orderBy: { updatedAt: "desc" } }).catch((error) => {
      this.logger.warn(`loadBotConfig failed: ${(error as Error).message}`);
      return null;
    });
    if (!row) return undefined;
    const config: Partial<BotConfig> = {
      marketMode: row.marketMode as BotConfig["marketMode"],
      minNetProfitPercent: row.minNetProfitPercent,
      maxTradeSize: row.maxTradeSize,
      maxLatencyMs: row.maxLatencyMs,
      maxOrderBookAgeMs: row.maxOrderBookAgeMs,
      maxSlippagePercent: row.maxSlippagePercent,
      allowPartialFills: row.allowPartialFills,
      autoSimulationEnabled: row.autoSimulationEnabled,
      circuitBreakerEnabled: row.circuitBreakerEnabled,
      maxRejectedOpportunitiesPerMinute: row.maxRejectedOpportunitiesPerMinute,
      maxNegativePnLBeforeStop: row.maxNegativePnLBeforeStop,
      minLiquidityScore: row.minLiquidityScore
    };
    if (Array.isArray(row.enabledExchanges)) {
      config.enabledExchanges = row.enabledExchanges as BotConfig["enabledExchanges"];
    }
    if (row.fees && typeof row.fees === "object" && !Array.isArray(row.fees)) {
      config.fees = row.fees as BotConfig["fees"];
    }
    return config;
  }

  async loadWalletRecords(): Promise<Array<{ exchange: string; asset: string; balance: number; updatedAt: Date }>> {
    if (!this.prisma.isAvailable()) return [];
    return this.prisma.walletBalance
      .findMany({ orderBy: [{ exchange: "asc" }, { asset: "asc" }] })
      .catch((error) => {
        this.logger.warn(`loadWalletRecords failed: ${(error as Error).message}`);
        return [];
      });
  }

  async loadRecentMarketSnapshots(minutes = 5): Promise<Array<{ quote: BestQuote; ts: number }>> {
    if (!this.prisma.isAvailable()) return [];
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const rows = await this.prisma.marketSnapshot
      .findMany({
        where: { createdAt: { gte: cutoff } },
        orderBy: { createdAt: "asc" },
        take: 2000
      })
      .catch((error) => {
        this.logger.warn(`loadRecentMarketSnapshots failed: ${(error as Error).message}`);
        return [];
      });

    return rows.map((row) => ({
      quote: {
        exchange: row.exchange as BestQuote["exchange"],
        symbol: row.symbol as BestQuote["symbol"],
        bidPrice: row.bidPrice,
        bidQty: row.bidQty,
        askPrice: row.askPrice,
        askQty: row.askQty,
        exchangeTimestamp: Number(row.exchangeTimestamp),
        backendReceivedAt: Number(row.backendReceivedAt),
        normalizedAt: Number(row.normalizedAt),
        latencyMs: row.latencyMs
      },
      ts: row.createdAt.getTime()
    }));
  }

  /**
   * Load the most recent simulated trades so cumulative P&L survives a backend
   * restart. Fields not stored in the DB (timeline, requestedVolume,
   * withdrawalFee) are filled with neutral defaults — these are informational
   * only and never feed back into the P&L totals.
   */
  async loadRecentTrades(limit = 200): Promise<SimulatedTrade[]> {
    if (!this.prisma.isAvailable()) return [];
    const rows = await this.prisma.simulatedTrade
      .findMany({ orderBy: { createdAt: "desc" }, take: limit })
      .catch((error) => {
        this.logger.warn(`loadRecentTrades failed: ${(error as Error).message}`);
        return [];
      });

    return rows.map((row) => ({
      id: row.id,
      opportunityId: row.opportunityId,
      symbol: row.symbol as TradingSymbol,
      buyExchange: row.buyExchange as ExchangeName,
      sellExchange: row.sellExchange as ExchangeName,
      volume: row.volume,
      requestedVolume: row.volume,
      buyCost: row.buyCost,
      sellRevenue: row.sellRevenue,
      grossProfit: row.grossProfit,
      totalFees: row.totalFees,
      withdrawalFee: 0,
      slippageCost: row.slippageCost,
      netProfit: row.netProfit,
      status: row.status as SimulatedTrade["status"],
      timeline: [],
      createdAt: row.createdAt.toISOString()
    }));
  }

  /**
   * Delete persisted simulation history so a bot reset is honest even across
   * restarts (otherwise the next boot would reload trades the operator cleared).
   * Fire-and-forget: market-data flow must never block on this.
   */
  clearSimulationHistory() {
    if (!this.prisma.isAvailable()) return;
    void Promise.all([this.prisma.simulatedTrade.deleteMany({}), this.prisma.opportunity.deleteMany({})]).catch((error) =>
      this.logger.warn(`clearSimulationHistory failed: ${(error as Error).message}`)
    );
  }

  saveOpportunity(opportunity: ArbitrageOpportunity) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.opportunity
      .create({
        data: {
          id: opportunity.id,
          symbol: opportunity.symbol,
          buyExchange: opportunity.buyExchange,
          sellExchange: opportunity.sellExchange,
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          executionBuyPrice: opportunity.executionBuyPrice,
          executionSellPrice: opportunity.executionSellPrice,
          volume: opportunity.volume,
          grossSpread: opportunity.grossSpread,
          grossSpreadPercent: opportunity.grossSpreadPercent,
          grossProfit: opportunity.grossProfit,
          netProfit: opportunity.netProfit,
          netProfitPercent: opportunity.netProfitPercent,
          buyFee: opportunity.buyFee,
          sellFee: opportunity.sellFee,
          withdrawalFee: opportunity.withdrawalFee,
          slippageCost: opportunity.slippageCost,
          latencyMs: opportunity.latencyMs,
          confidence: opportunity.confidence,
          status: opportunity.status,
          rejectionReason: opportunity.rejectionReason ?? null,
          recommendation: opportunity.recommendation,
          detectedAt: new Date(opportunity.detectedAt)
        }
      })
      .catch((error) => this.logger.warn(`saveOpportunity failed: ${(error as Error).message}`));
  }

  saveTrade(trade: SimulatedTrade) {
    if (!this.prisma.isAvailable()) return;
    // Cast is required because `grossProfit` was added to the schema but
    // `prisma generate` must be re-run before the generated client types
    // include it. The column exists in the DB (migration applied).
    // Fire-and-forget: any DB error is silently logged.
    const data = {
      id: trade.id,
      opportunityId: trade.opportunityId,
      symbol: trade.symbol,
      buyExchange: trade.buyExchange,
      sellExchange: trade.sellExchange,
      volume: trade.volume,
      buyCost: trade.buyCost,
      sellRevenue: trade.sellRevenue,
      grossProfit: trade.grossProfit, // raw spread × volume (before slippage & fees)
      totalFees: trade.totalFees,
      slippageCost: trade.slippageCost,
      netProfit: trade.netProfit,
      status: trade.status
    } as Parameters<typeof this.prisma.simulatedTrade.create>[0]["data"];
    void this.prisma.simulatedTrade
      .create({ data })
      .catch((error) => this.logger.warn(`saveTrade failed: ${(error as Error).message}`));
  }

  upsertWallet(wallet: WalletBalance) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.walletBalance
      .upsert({
        where: { exchange_asset: { exchange: wallet.exchange, asset: wallet.asset } },
        update: { balance: wallet.balance },
        create: { exchange: wallet.exchange, asset: wallet.asset, balance: wallet.balance }
      })
      .catch((error) => this.logger.warn(`upsertWallet failed: ${(error as Error).message}`));
  }

  saveLedger(entry: WalletLedgerEntry) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.walletLedger
      .create({
        data: {
          id: entry.id,
          exchange: entry.exchange,
          asset: entry.asset,
          change: entry.change,
          balanceAfter: entry.balanceAfter,
          reason: entry.reason,
          tradeId: entry.tradeId ?? null
        }
      })
      .catch((error) => this.logger.warn(`saveLedger failed: ${(error as Error).message}`));
  }

  saveRiskEvent(event: RiskEvent) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.riskEvent
      .create({
        data: {
          id: event.id,
          type: event.type,
          severity: event.severity,
          message: event.message,
          metadata: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : null
        }
      })
      .catch((error) => this.logger.warn(`saveRiskEvent failed: ${(error as Error).message}`));
  }

  private trimQueue<T>(queue: T[]) {
    const overflow = queue.length - this.maxQueueSize;
    if (overflow > 0) {
      queue.splice(0, overflow);
      this.droppedWrites += overflow;
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      delete this.flushTimer;
      void this.flushQueues();
    }, 500);
  }

  private async flushQueues() {
    if (this.flushing || !this.prisma.isAvailable()) return;
    this.flushing = true;
    const marketSnapshots = this.marketSnapshotQueue.splice(0, this.batchSize);
    const orderBooks = this.orderBookQueue.splice(0, this.batchSize);
    const latencyMetrics = this.latencyQueue.splice(0, this.batchSize);

    try {
      await Promise.all([
        marketSnapshots.length
          ? this.prisma.marketSnapshot.createMany({
              data: marketSnapshots.map((quote) => ({
                exchange: quote.exchange,
                symbol: quote.symbol,
                bidPrice: quote.bidPrice,
                bidQty: quote.bidQty,
                askPrice: quote.askPrice,
                askQty: quote.askQty,
                exchangeTimestamp: BigInt(quote.exchangeTimestamp),
                backendReceivedAt: BigInt(quote.backendReceivedAt),
                normalizedAt: BigInt(quote.normalizedAt),
                latencyMs: Math.round(quote.exchangeLatencyMs ?? quote.latencyMs)
              }))
            })
          : Promise.resolve(),
        orderBooks.length
          ? this.prisma.orderBookSnapshot.createMany({
              data: orderBooks.map((orderBook) => ({
                exchange: orderBook.exchange,
                symbol: orderBook.symbol,
                bids: JSON.parse(JSON.stringify(orderBook.bids)),
                asks: JSON.parse(JSON.stringify(orderBook.asks)),
                exchangeTimestamp: BigInt(orderBook.exchangeTimestamp),
                backendReceivedAt: BigInt(orderBook.backendReceivedAt),
                normalizedAt: BigInt(orderBook.normalizedAt),
                sequence: orderBook.sequence === undefined ? null : BigInt(orderBook.sequence)
              }))
            })
          : Promise.resolve(),
        latencyMetrics.length
          ? this.prisma.latencyMetric.createMany({
              data: latencyMetrics.map(({ exchange, symbol, latency }) => ({
                exchange,
                symbol,
                exchangeToBackendMs: Math.round(latency.exchangeToBackendMs),
                normalizationMs: Math.round(latency.normalizationMs),
                detectionLatencyMs: Math.round(latency.detectionLatencyMs),
                backendToFrontendMs: latency.backendToFrontendMs === undefined ? null : Math.round(latency.backendToFrontendMs),
                endToEndLatencyMs: latency.endToEndLatencyMs === undefined ? null : Math.round(latency.endToEndLatencyMs)
              }))
            })
          : Promise.resolve()
      ]);
    } catch (error) {
      this.logger.warn(`flushQueues failed: ${(error as Error).message}`);
    } finally {
      this.flushing = false;
      if (this.marketSnapshotQueue.length || this.orderBookQueue.length || this.latencyQueue.length) {
        this.scheduleFlush();
      }
    }
  }
}
