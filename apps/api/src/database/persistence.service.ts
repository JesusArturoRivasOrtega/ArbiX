import { Injectable, Logger } from "@nestjs/common";
import type {
  ArbitrageOpportunity,
  BestQuote,
  BotConfig,
  ExchangeConnectionStatus,
  LatencyMetrics,
  NormalizedOrderBook,
  RiskEvent,
  SimulatedTrade,
  WalletBalance,
  WalletLedgerEntry
} from "@arbix/shared";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class PersistenceService {
  private readonly logger = new Logger(PersistenceService.name);

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
    void this.prisma.marketSnapshot
      .create({
        data: {
          exchange: quote.exchange,
          symbol: quote.symbol,
          bidPrice: quote.bidPrice,
          bidQty: quote.bidQty,
          askPrice: quote.askPrice,
          askQty: quote.askQty,
          exchangeTimestamp: BigInt(quote.exchangeTimestamp),
          backendReceivedAt: BigInt(quote.backendReceivedAt),
          normalizedAt: BigInt(quote.normalizedAt),
          latencyMs: quote.latencyMs
        }
      })
      .catch((error) => this.logger.warn(`saveMarketSnapshot failed: ${(error as Error).message}`));
  }

  saveOrderBookSnapshot(orderBook: NormalizedOrderBook) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.orderBookSnapshot
      .create({
        data: {
          exchange: orderBook.exchange,
          symbol: orderBook.symbol,
          bids: JSON.parse(JSON.stringify(orderBook.bids)),
          asks: JSON.parse(JSON.stringify(orderBook.asks)),
          exchangeTimestamp: BigInt(orderBook.exchangeTimestamp),
          backendReceivedAt: BigInt(orderBook.backendReceivedAt),
          normalizedAt: BigInt(orderBook.normalizedAt),
          sequence: orderBook.sequence === undefined ? null : BigInt(orderBook.sequence)
        }
      })
      .catch((error) => this.logger.warn(`saveOrderBookSnapshot failed: ${(error as Error).message}`));
  }

  saveLatencyMetric(exchange: string, symbol: string, latency: LatencyMetrics) {
    if (!this.prisma.isAvailable()) return;
    void this.prisma.latencyMetric
      .create({
        data: {
          exchange,
          symbol,
          exchangeToBackendMs: Math.round(latency.exchangeToBackendMs),
          normalizationMs: Math.round(latency.normalizationMs),
          detectionLatencyMs: Math.round(latency.detectionLatencyMs),
          backendToFrontendMs: latency.backendToFrontendMs === undefined ? null : Math.round(latency.backendToFrontendMs),
          endToEndLatencyMs: latency.endToEndLatencyMs === undefined ? null : Math.round(latency.endToEndLatencyMs)
        }
      })
      .catch((error) => this.logger.warn(`saveLatencyMetric failed: ${(error as Error).message}`));
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
    void this.prisma.simulatedTrade
      .create({
        data: {
          id: trade.id,
          opportunityId: trade.opportunityId,
          symbol: trade.symbol,
          buyExchange: trade.buyExchange,
          sellExchange: trade.sellExchange,
          volume: trade.volume,
          buyCost: trade.buyCost,
          sellRevenue: trade.sellRevenue,
          totalFees: trade.totalFees,
          slippageCost: trade.slippageCost,
          netProfit: trade.netProfit,
          status: trade.status
        }
      })
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
}
