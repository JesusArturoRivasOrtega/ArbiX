import { Injectable, Logger } from "@nestjs/common";
import type { ArbitrageOpportunity, BestQuote, ExchangeName, LatencyMetrics, NormalizedOrderBook, RejectionReason, TradingSymbol } from "@arbix/shared";
import { uid } from "@arbix/shared";
import { AppConfigService } from "../config/app.config.js";
import { OrderBookStore } from "../market-data/order-book.store.js";
import { RealtimeEventsService } from "../realtime/realtime-events.service.js";
import { CircuitBreaker } from "../risk/circuit-breaker.js";
import { LatencyMonitor } from "../risk/latency-monitor.js";
import { PriceAnomalyGuard } from "../risk/price-anomaly.guard.js";
import { RiskEngine } from "../risk/risk-engine.js";
import { ExecutionSimulator } from "../simulator/execution-simulator.js";
import { PnlService } from "../simulator/pnl.service.js";
import { WalletService } from "../simulator/wallet.service.js";
import { CostCalculator } from "./cost-calculator.js";
import { OpportunityClassifier } from "./opportunity-classifier.js";
import { OpportunityScorer } from "./opportunity.scorer.js";
import { RejectionAnalyzer } from "./rejection-analyzer.js";
import { SlippageEstimator } from "./slippage-estimator.js";

const EXECUTION_COOLDOWN_MS = 8_000;

@Injectable()
export class ArbitrageEngine {
  private readonly logger = new Logger(ArbitrageEngine.name);
  private readonly dedupe = new Map<string, number>();
  private readonly executionCooldown = new Map<string, number>();

  constructor(
    private readonly store: OrderBookStore,
    private readonly config: AppConfigService,
    private readonly costCalculator: CostCalculator,
    private readonly slippage: SlippageEstimator,
    private readonly scorer: OpportunityScorer,
    private readonly classifier: OpportunityClassifier,
    private readonly rejectionAnalyzer: RejectionAnalyzer,
    private readonly risk: RiskEngine,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly wallets: WalletService,
    private readonly simulator: ExecutionSimulator,
    private readonly pnl: PnlService,
    private readonly realtime: RealtimeEventsService,
    private readonly latencyMonitor: LatencyMonitor,
    private readonly priceAnomaly: PriceAnomalyGuard
  ) {}

  evaluateSymbol(symbol: TradingSymbol) {
    const quotes = this.store.getQuotesBySymbol(symbol);
    if (quotes.length < 2) return;

    for (const buyQuote of quotes) {
      for (const sellQuote of quotes) {
        if (buyQuote.exchange === sellQuote.exchange) continue;
        if (buyQuote.askPrice >= sellQuote.bidPrice) continue;
        const grossSpreadPercent = ((sellQuote.bidPrice - buyQuote.askPrice) / buyQuote.askPrice) * 100;
        if (grossSpreadPercent < 0.01) continue;

        const key = `${symbol}:${buyQuote.exchange}:${sellQuote.exchange}`;
        const now = Date.now();
        if ((this.dedupe.get(key) ?? 0) > now - 3000) continue;
        if ((this.executionCooldown.get(key) ?? 0) > now - EXECUTION_COOLDOWN_MS) continue;
        this.dedupe.set(key, now);
        this.evaluatePair(key, symbol, buyQuote, sellQuote);
      }
    }
  }

  getOpportunities() {
    return this.pnl.getOpportunities();
  }

  reset(options: { resetWallets?: boolean } = {}) {
    this.dedupe.clear();
    this.executionCooldown.clear();
    this.priceAnomaly.clear();
    this.pnl.reset();
    this.simulator.reset();
    if (options.resetWallets) {
      this.wallets.reset();
    }
  }

  private evaluatePair(key: string, symbol: TradingSymbol, buyQuote: BestQuote, sellQuote: BestQuote) {
    const buyBook = this.store.getOrderBook(buyQuote.exchange, symbol);
    const sellBook = this.store.getOrderBook(sellQuote.exchange, symbol);
    if (!buyBook || !sellBook) return;
    if (!this.hasCompatibleSources(buyQuote, sellQuote, buyBook, sellBook)) {
      this.logger.warn(`Skipping ${symbol} pair with mixed market source/generation metadata.`);
      return;
    }

    if (
      this.priceAnomaly.isAnomaly(buyQuote.exchange, symbol, buyQuote.askPrice) ||
      this.priceAnomaly.isAnomaly(sellQuote.exchange, symbol, sellQuote.bidPrice)
    ) {
      this.logger.warn(`Flash crash guard: skipping ${symbol} pair - price anomaly on ${buyQuote.exchange} or ${sellQuote.exchange}`);
      this.emitPriceAnomalyRejection(symbol, buyQuote, sellQuote, buyBook, sellBook);
      return;
    }
    this.priceAnomaly.update(buyQuote.exchange, symbol, buyQuote.askPrice);
    this.priceAnomaly.update(sellQuote.exchange, symbol, sellQuote.bidPrice);

    const detectedAt = Date.now();
    const buyLatencyMs = this.effectiveLatencyMs(buyQuote);
    const sellLatencyMs = this.effectiveLatencyMs(sellQuote);
    this.latencyMonitor.update(buyQuote.exchange, buyLatencyMs);
    this.latencyMonitor.update(sellQuote.exchange, sellLatencyMs);

    const targetAmount = this.config.risk.maxTradeSize;
    const initialBuyVwap = this.slippage.calculateVwap(buyBook.asks, targetAmount);
    const initialSellVwap = this.slippage.calculateVwap(sellBook.bids, targetAmount);
    const executableAmount = Math.min(targetAmount, initialBuyVwap.filledAmount, initialSellVwap.filledAmount);

    if (executableAmount <= 0) {
      this.logger.debug(`Ignoring ${symbol} opportunity with zero executable amount`);
      return;
    }

    const buyVwap = this.slippage.calculateVwap(buyBook.asks, executableAmount);
    const sellVwap = this.slippage.calculateVwap(sellBook.bids, executableAmount);
    const fallbackFee = this.config.fees.MOCK ?? { tradingFeeRate: 0.001, withdrawalFee: 0 };
    const cost = this.costCalculator.calculate({
      buyAskPrice: buyQuote.askPrice,
      sellBidPrice: sellQuote.bidPrice,
      executionBuyPrice: buyVwap.averagePrice,
      executionSellPrice: sellVwap.averagePrice,
      amount: executableAmount,
      buyFee: this.config.fees[buyQuote.exchange] ?? fallbackFee,
      sellFee: this.config.fees[sellQuote.exchange] ?? fallbackFee,
      symbol
    });

    const partialFill = initialBuyVwap.isPartialFill || initialSellVwap.isPartialFill;
    const orderBookAgeMs = detectedAt - Math.min(buyBook.normalizedAt, sellBook.normalizedAt);
    const latencyMs = Math.max(buyLatencyMs, sellLatencyMs);
    const latency = this.buildLatencyMetrics(buyBook, sellBook, detectedAt);

    // Real wallet affordability check, computed directly from the candidate's
    // execution numbers — no throwaway opportunity object required.
    const walletOk = this.wallets.canSimulate({
      symbol,
      buyExchange: buyQuote.exchange,
      sellExchange: sellQuote.exchange,
      executionBuyPrice: buyVwap.averagePrice,
      volume: executableAmount,
      buyFee: cost.buyFee,
      withdrawalFee: cost.withdrawalFee
    });
    const adjustedScore = this.scorer.score({
      cost,
      filledAmount: executableAmount,
      targetAmount,
      latencyMs,
      maxLatencyMs: this.config.risk.maxLatencyMs,
      orderBookAgeMs,
      circuitBreakerActive: this.circuitBreaker.isActive(),
      walletOk
    });

    const risk = this.risk.evaluate({
      latencyMs,
      orderBookAgeMs,
      cost,
      score: adjustedScore,
      walletOk,
      liquidityOk: !partialFill || executableAmount > 0,
      partialFill,
      currentNetPnl: this.pnl.getTotals().netProfit
    });

    const status = this.classifier.classify(adjustedScore.recommendation, risk.reasons, this.config.risk.autoSimulationEnabled);
    const rejectionReason = risk.reasons[0];
    const opportunity = this.buildOpportunity({
      symbol,
      buyQuote,
      sellQuote,
      buyVwap: buyVwap.averagePrice,
      sellVwap: sellVwap.averagePrice,
      executableAmount,
      requestedVolume: targetAmount,
      latencyMs,
      detectedAt,
      latency,
      cost,
      score: adjustedScore,
      status,
      recommendation: adjustedScore.recommendation,
      ...(rejectionReason ? { rejectionReason } : {})
    });

    const emitAt = Date.now();
    const finalOpportunity = {
      ...opportunity,
      latency: { ...opportunity.latency, emittedToFrontendAt: emitAt, processingMs: emitAt - detectedAt }
    };

    this.pnl.recordOpportunity(finalOpportunity);
    this.realtime.publish("opportunity.detected", finalOpportunity);

    if (finalOpportunity.status === "EXECUTED") {
      this.executionCooldown.set(key, Date.now());
      this.realtime.publish("opportunity.executed", finalOpportunity);
      this.simulator.simulate(finalOpportunity);
      return;
    }

    if (finalOpportunity.status === "REJECTED") {
      this.realtime.publish("opportunity.rejected", finalOpportunity);
    }
  }

  private buildOpportunity(input: {
    symbol: TradingSymbol;
    buyQuote: BestQuote;
    sellQuote: BestQuote;
    buyVwap: number;
    sellVwap: number;
    executableAmount: number;
    requestedVolume: number;
    latencyMs: number;
    detectedAt: number;
    latency: LatencyMetrics;
    cost: ReturnType<CostCalculator["calculate"]>;
    score: ReturnType<OpportunityScorer["score"]>;
    status: ArbitrageOpportunity["status"];
    recommendation: ArbitrageOpportunity["recommendation"];
    rejectionReason?: RejectionReason;
  }): ArbitrageOpportunity {
    const rejectionMessage = input.rejectionReason ? this.rejectionAnalyzer.humanize(input.rejectionReason) : undefined;
    const generationId = input.buyQuote.generationId ?? input.sellQuote.generationId;
    const source = input.buyQuote.source ?? input.sellQuote.source;
    const generatedBy = input.buyQuote.generatedBy ?? input.sellQuote.generatedBy;
    return {
      id: uid("opp"),
      symbol: input.symbol,
      buyExchange: input.buyQuote.exchange,
      sellExchange: input.sellQuote.exchange,
      buyPrice: input.buyQuote.askPrice,
      sellPrice: input.sellQuote.bidPrice,
      executionBuyPrice: input.buyVwap,
      executionSellPrice: input.sellVwap,
      volume: input.executableAmount,
      requestedVolume: input.requestedVolume,
      grossSpread: input.cost.grossSpread,
      grossSpreadPercent: input.cost.grossSpreadPercent,
      grossProfit: input.cost.grossProfit,
      netProfit: input.cost.netProfit,
      netProfitPercent: input.cost.netProfitPercent,
      buyFee: input.cost.buyFee,
      sellFee: input.cost.sellFee,
      withdrawalFee: input.cost.withdrawalFee,
      slippageCost: input.cost.slippageCost,
      latencyMs: input.latencyMs,
      confidence: input.score.confidence,
      score: input.score,
      status: input.status,
      ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
      ...(rejectionMessage ? { rejectionMessage } : {}),
      recommendation: input.recommendation,
      detectedAt: new Date(input.detectedAt).toISOString(),
      latency: input.latency,
      marketMode: input.buyQuote.marketMode ?? input.sellQuote.marketMode ?? this.config.marketMode,
      ...(generationId !== undefined ? { generationId } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(generatedBy !== undefined ? { generatedBy } : {}),
      backendGenerated: true
    };
  }

  private buildLatencyMetrics(buyBook: NormalizedOrderBook, sellBook: NormalizedOrderBook, detectedAt: number): LatencyMetrics {
    const exchangeTimestamp = Math.min(buyBook.exchangeTimestamp, sellBook.exchangeTimestamp);
    const backendReceivedAt = Math.max(buyBook.backendReceivedAt, sellBook.backendReceivedAt);
    const normalizedAt = Math.max(buyBook.normalizedAt, sellBook.normalizedAt);
    const emittedToFrontendAt = Date.now();
    const buyLatency = buyBook.exchangeLatencyMs ?? (buyBook.latencyConfidence === "UNKNOWN" ? null : buyBook.backendReceivedAt - buyBook.exchangeTimestamp);
    const sellLatency = sellBook.exchangeLatencyMs ?? (sellBook.latencyConfidence === "UNKNOWN" ? null : sellBook.backendReceivedAt - sellBook.exchangeTimestamp);
    const exchangeToBackendMs =
      buyLatency === null || sellLatency === null
        ? this.config.risk.maxLatencyMs + 1
        : Math.max(buyLatency, sellLatency);
    const latencyConfidence = buyBook.latencyConfidence === "UNKNOWN" || sellBook.latencyConfidence === "UNKNOWN" ? "UNKNOWN" : "HIGH";

    return {
      exchangeTimestamp,
      backendReceivedAt,
      normalizedAt,
      detectedAt,
      emittedToFrontendAt,
      exchangeToBackendMs,
      exchangeLatencyMs: buyLatency === null || sellLatency === null ? null : exchangeToBackendMs,
      latencyConfidence,
      normalizationMs: Math.max(0, normalizedAt - backendReceivedAt),
      detectionLatencyMs: Math.max(0, detectedAt - normalizedAt)
    };
  }

  private effectiveLatencyMs(quote: BestQuote) {
    if (quote.latencyConfidence === "UNKNOWN") {
      return this.config.risk.maxLatencyMs + 1;
    }
    return quote.exchangeLatencyMs ?? quote.latencyMs;
  }

  private hasCompatibleSources(
    buyQuote: BestQuote,
    sellQuote: BestQuote,
    buyBook: NormalizedOrderBook,
    sellBook: NormalizedOrderBook
  ) {
    const modes = [buyQuote.marketMode, sellQuote.marketMode, buyBook.marketMode, sellBook.marketMode].filter(Boolean);
    if (modes.some((mode) => mode !== this.config.marketMode)) return false;
    if (new Set(modes).size > 1) return false;

    const generations = [buyQuote.generationId, sellQuote.generationId, buyBook.generationId, sellBook.generationId].filter(
      (value): value is number => value !== undefined
    );
    return new Set(generations).size <= 1;
  }

  private emitPriceAnomalyRejection(
    symbol: TradingSymbol,
    buyQuote: BestQuote,
    sellQuote: BestQuote,
    buyBook: NormalizedOrderBook,
    sellBook: NormalizedOrderBook
  ) {
    const detectedAt = Date.now();
    const grossSpread = sellQuote.bidPrice - buyQuote.askPrice;
    const rejectionMessage = this.rejectionAnalyzer.humanize("PRICE_ANOMALY");
    const generationId = buyQuote.generationId ?? sellQuote.generationId;
    const source = buyQuote.source ?? sellQuote.source;
    const generatedBy = buyQuote.generatedBy ?? sellQuote.generatedBy;
    const opportunity: ArbitrageOpportunity = {
      id: uid("opp"),
      symbol,
      buyExchange: buyQuote.exchange,
      sellExchange: sellQuote.exchange,
      buyPrice: buyQuote.askPrice,
      sellPrice: sellQuote.bidPrice,
      executionBuyPrice: buyQuote.askPrice,
      executionSellPrice: sellQuote.bidPrice,
      volume: 0,
      requestedVolume: this.config.risk.maxTradeSize,
      grossSpread,
      grossSpreadPercent: buyQuote.askPrice > 0 ? (grossSpread / buyQuote.askPrice) * 100 : 0,
      grossProfit: 0,
      netProfit: 0,
      netProfitPercent: 0,
      buyFee: 0,
      sellFee: 0,
      withdrawalFee: 0,
      slippageCost: 0,
      latencyMs: Math.max(this.effectiveLatencyMs(buyQuote), this.effectiveLatencyMs(sellQuote)),
      confidence: 0,
      score: {
        profitScore: 0,
        liquidityScore: 0,
        latencyScore: 0,
        slippageScore: 0,
        riskPenalty: 100,
        confidence: 0,
        recommendation: "REJECT"
      },
      status: "REJECTED",
      rejectionReason: "PRICE_ANOMALY",
      ...(rejectionMessage ? { rejectionMessage } : {}),
      recommendation: "REJECT",
      detectedAt: new Date(detectedAt).toISOString(),
      latency: this.buildLatencyMetrics(buyBook, sellBook, detectedAt),
      marketMode: buyQuote.marketMode ?? sellQuote.marketMode ?? this.config.marketMode,
      ...(generationId !== undefined ? { generationId } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(generatedBy !== undefined ? { generatedBy } : {}),
      backendGenerated: true
    };

    this.pnl.recordOpportunity(opportunity);
    this.realtime.publish("opportunity.detected", opportunity);
    this.realtime.publish("opportunity.rejected", opportunity);
  }
}
