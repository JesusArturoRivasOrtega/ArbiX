export const EXCHANGES = ["BINANCE", "KRAKEN", "OKX", "COINBASE", "BYBIT", "MOCK"] as const;
export type ExchangeName = (typeof EXCHANGES)[number];

export const TRADING_SYMBOLS = ["BTC/USDT", "BTC/USD", "ETH/USDT", "ETH/USD", "SOL/USDT"] as const;
export type TradingSymbol = (typeof TRADING_SYMBOLS)[number];

export type MarketMode = "LIVE" | "DEMO" | "REPLAY";
export type AdapterMode = MarketMode;
export type DataSource = MarketMode | "SEED" | "CACHE" | "ERROR";
export type GeneratedBy = "live-adapter" | "mock-adapter" | "replay-adapter" | "frontend-seed" | "cache";
export type LatencyConfidence = "HIGH" | "LOW" | "UNKNOWN";

export type BotStatus = "RUNNING" | "STOPPED" | "PAUSED";
export type ConnectionStatus = "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "ERROR";

export type OpportunityStatus = "EXECUTED" | "REJECTED" | "WATCHING" | "EXPIRED";
export type Recommendation = "EXECUTE" | "WATCH" | "REJECT";

export type RejectionReason =
  | "NET_PROFIT_NEGATIVE"
  | "FEES_EXCEED_SPREAD"
  | "INSUFFICIENT_LIQUIDITY"
  | "STALE_ORDER_BOOK"
  | "LATENCY_TOO_HIGH"
  | "INSUFFICIENT_WALLET_BALANCE"
  | "SLIPPAGE_TOO_HIGH"
  | "BELOW_MIN_PROFIT_THRESHOLD"
  | "CIRCUIT_BREAKER_ACTIVE"
  | "PARTIAL_FILL_NOT_ALLOWED"
  | "EXCHANGE_DISCONNECTED"
  | "PRICE_ANOMALY";

export type OrderBookLevel = {
  price: number;
  quantity: number;
};

export type NormalizedOrderBook = {
  exchange: ExchangeName;
  symbol: TradingSymbol;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  exchangeTimestamp: number;
  backendReceivedAt: number;
  normalizedAt: number;
  sequence?: number;
  adapterId?: string;
  generationId?: number;
  marketMode?: MarketMode;
  source?: DataSource;
  generatedBy?: GeneratedBy;
  exchangeLatencyMs?: number | null;
  latencyConfidence?: LatencyConfidence;
};

export type BestQuote = {
  exchange: ExchangeName;
  symbol: TradingSymbol;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  exchangeTimestamp: number;
  backendReceivedAt: number;
  normalizedAt: number;
  latencyMs: number;
  adapterId?: string;
  generationId?: number;
  marketMode?: MarketMode;
  source?: DataSource;
  generatedBy?: GeneratedBy;
  exchangeLatencyMs?: number | null;
  latencyConfidence?: LatencyConfidence;
};

export type ExchangeConnectionStatus = {
  exchange: ExchangeName;
  status: ConnectionStatus;
  mode: MarketMode;
  symbols: TradingSymbol[];
  lastMessageAt?: number;
  error?: string;
};

export type LatencyMetrics = {
  exchangeTimestamp: number;
  backendReceivedAt: number;
  normalizedAt: number;
  detectedAt: number;
  emittedToFrontendAt: number;
  frontendReceivedAt?: number;
  exchangeToBackendMs: number;
  normalizationMs: number;
  detectionLatencyMs: number;
  processingMs?: number;
  backendToFrontendMs?: number;
  endToEndLatencyMs?: number;
  exchangeLatencyMs?: number | null;
  latencyConfidence?: LatencyConfidence;
};

export type OpportunityScore = {
  profitScore: number;
  liquidityScore: number;
  latencyScore: number;
  slippageScore: number;
  riskPenalty: number;
  confidence: number;
  recommendation: Recommendation;
};

export type CostBreakdown = {
  grossSpread: number;
  grossSpreadPercent: number;
  grossProfit: number;
  buyCost: number;
  buyFee: number;
  sellRevenue: number;
  sellFee: number;
  withdrawalFee: number;
  slippageCost: number;
  netProfit: number;
  netProfitPercent: number;
  buySlippage: number;
  buySlippagePercent: number;
  sellSlippage: number;
  sellSlippagePercent: number;
};

export type ArbitrageOpportunity = {
  id: string;
  symbol: TradingSymbol;
  buyExchange: ExchangeName;
  sellExchange: ExchangeName;
  buyPrice: number;
  sellPrice: number;
  executionBuyPrice: number;
  executionSellPrice: number;
  volume: number;
  requestedVolume?: number;
  grossSpread: number;
  grossSpreadPercent: number;
  grossProfit: number;
  netProfit: number;
  netProfitPercent: number;
  buyFee: number;
  sellFee: number;
  withdrawalFee: number;
  slippageCost: number;
  latencyMs: number;
  confidence: number;
  score: OpportunityScore;
  status: OpportunityStatus;
  rejectionReason?: RejectionReason;
  rejectionMessage?: string;
  recommendation: Recommendation;
  detectedAt: string;
  latency: LatencyMetrics;
  generationId?: number;
  marketMode?: MarketMode;
  source?: DataSource;
  generatedBy?: GeneratedBy;
  backendGenerated?: boolean;
  scenarioId?: string;
};

export type ExecutionTimelineStep = {
  label: string;
  timestamp: string;
  durationMs: number;
  status: "completed" | "skipped" | "failed";
  detail?: string;
};

export type SimulatedTrade = {
  id: string;
  opportunityId: string;
  symbol: TradingSymbol;
  buyExchange: ExchangeName;
  sellExchange: ExchangeName;
  volume: number;
  requestedVolume: number;
  buyCost: number;
  sellRevenue: number;
  /** True gross profit = (bestBid − bestAsk) × volume. Does NOT include slippage or fees. */
  grossProfit: number;
  totalFees: number;
  withdrawalFee: number;
  /**
   * Slippage cost = (vwapBuy − bestAsk + bestBid − vwapSell) × volume.
   * Already embedded in buyCost/sellRevenue (via VWAP prices), stored here
   * for informational breakdown only — do NOT subtract from netProfit again.
   */
  slippageCost: number;
  /** netProfit = sellRevenue − buyCost − totalFees (slippage already in VWAP prices) */
  netProfit: number;
  status: "SIMULATED" | "PARTIAL" | "FAILED";
  timeline: ExecutionTimelineStep[];
  createdAt: string;
};

export type WalletBalance = {
  exchange: ExchangeName;
  asset: string;
  balance: number;
  estimatedUsdValue: number;
  updatedAt: string;
  lastTradeId?: string;
};

export type WalletLedgerEntry = {
  id: string;
  exchange: ExchangeName;
  asset: string;
  change: number;
  balanceAfter: number;
  reason: string;
  tradeId?: string;
  createdAt: string;
};

export type RiskConfig = {
  minNetProfitPercent: number;
  maxTradeSize: number;
  maxLatencyMs: number;
  maxOrderBookAgeMs: number;
  maxSlippagePercent: number;
  allowPartialFills: boolean;
  autoSimulationEnabled: boolean;
  circuitBreakerEnabled: boolean;
  maxRejectedOpportunitiesPerMinute: number;
  maxNegativePnLBeforeStop: number;
  minLiquidityScore: number;
};

export type RiskStatus = {
  circuitBreakerActive: boolean;
  reason?: string;
  lastTriggeredAt?: string;
  currentRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  config: RiskConfig;
  currentHighestLatencyMs: number;
};

export type RiskEvent = {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type LatencyExchangeStats = {
  exchange: ExchangeName;
  latencyMs: number;
  p50: number;
  p95: number;
  max: number;
  avg: number;
  samples: number;
};

export type AnalyticsSummary = {
  totalOpportunities: number;
  executedOpportunities: number;
  rejectedOpportunities: number;
  expiredOpportunities: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  totalFeesPaid: number;
  totalSlippageCost: number;
  averageDetectionLatencyMs: number;
  bestOpportunity?: ArbitrageOpportunity;
  worstRejectedOpportunity?: ArbitrageOpportunity;
  cumulativePnl: Array<{ time: string; pnl: number; gross: number; net: number }>;
  opportunitiesOverTime: Array<{ time: string; observed: number; executed: number; rejected: number }>;
  rejectionReasons: Array<{ reason: RejectionReason; count: number }>;
  latencyByExchange: LatencyExchangeStats[];
  volumeByPair: Array<{ symbol: TradingSymbol; volume: number }>;
  volumeByExchange: Array<{ exchange: ExchangeName; volume: number; notional: number }>;
  sharpeRatio?: number;
};

export type OrderBookDepthSnapshot = {
  exchange: ExchangeName;
  symbol: TradingSymbol;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  exchangeTimestamp: number;
  normalizedAt: number;
  ageMs: number;
};

export type BotConfig = RiskConfig & {
  marketMode: MarketMode;
  enabledExchanges: ExchangeName[];
  fees: Record<string, ExchangeFeeConfig>;
};

export type ExchangeFeeConfig = {
  tradingFeeRate: number;
  /** Legacy flat withdrawal fee in quote currency. Used only when asset-specific fees are absent. */
  withdrawalFee: number;
  /** Withdrawal fee charged in base-asset units before conversion to quote currency. */
  withdrawalFeesByAsset?: Partial<Record<"BTC" | "ETH" | "SOL", number>>;
};

export type MarketSnapshot = BestQuote & {
  spread: number;
  liquidity: number;
  status: ConnectionStatus | "STALE";
  lastUpdate: string;
};

export function splitSymbol(symbol: TradingSymbol): { base: string; quote: string } {
  const [base, quote] = symbol.split("/");
  if (!base || !quote) {
    throw new Error(`Invalid symbol ${symbol}`);
  }
  return { base, quote };
}

export function uid(prefix = "arbix"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
