import type {
  AnalyticsSummary,
  ArbitrageOpportunity,
  ExchangeConnectionStatus,
  MarketSnapshot,
  RiskStatus,
  SimulatedTrade,
  WalletBalance,
  WalletLedgerEntry
} from "@arbix/shared";

const now = "2026-05-29T08:00:00.000Z";
const baseTime = Date.parse(now);

export const demoMarket: MarketSnapshot[] = [
  market("BINANCE", "BTC/USDT", 68241.2, 0.42, 68248.7, 0.36, 38),
  market("KRAKEN", "BTC/USDT", 68318.6, 0.31, 68328.4, 0.27, 54),
  market("OKX", "BTC/USDT", 68271.4, 0.52, 68280.1, 0.43, 42),
  market("BINANCE", "ETH/USDT", 3737.88, 7.2, 3738.72, 6.6, 34),
  market("KRAKEN", "ETH/USDT", 3740.16, 6.1, 3741.24, 5.7, 61),
  market("OKX", "ETH/USDT", 3738.94, 9.4, 3739.68, 8.3, 40)
];

export const demoExchangeStatus: ExchangeConnectionStatus[] = [
  { exchange: "BINANCE", status: "CONNECTED", mode: "DEMO", symbols: ["BTC/USDT", "ETH/USDT"], lastMessageAt: baseTime },
  { exchange: "KRAKEN", status: "CONNECTED", mode: "DEMO", symbols: ["BTC/USDT", "ETH/USDT"], lastMessageAt: baseTime },
  { exchange: "OKX", status: "CONNECTED", mode: "DEMO", symbols: ["BTC/USDT", "ETH/USDT"], lastMessageAt: baseTime }
];

export const demoOpportunities: ArbitrageOpportunity[] = [
  {
    id: "demo-opp-1",
    symbol: "BTC/USDT",
    buyExchange: "BINANCE",
    sellExchange: "KRAKEN",
    buyPrice: 68248.7,
    sellPrice: 68318.6,
    executionBuyPrice: 68251.42,
    executionSellPrice: 68314.11,
    volume: 0.15,
    grossSpread: 69.9,
    grossSpreadPercent: 0.102,
    grossProfit: 10.49,
    netProfit: 6.82,
    netProfitPercent: 0.067,
    buyFee: 10.24,
    sellFee: 26.64,
    withdrawalFee: 0,
    slippageCost: 1.08,
    latencyMs: 47,
    confidence: 91,
    score: {
      profitScore: 78,
      liquidityScore: 96,
      latencyScore: 95,
      slippageScore: 88,
      riskPenalty: 0,
      confidence: 91,
      recommendation: "EXECUTE"
    },
    status: "EXECUTED",
    recommendation: "EXECUTE",
    detectedAt: now,
    latency: latency(47)
  },
  {
    id: "demo-opp-2",
    symbol: "ETH/USDT",
    buyExchange: "OKX",
    sellExchange: "BINANCE",
    buyPrice: 3738.22,
    sellPrice: 3741.05,
    executionBuyPrice: 3738.64,
    executionSellPrice: 3740.62,
    volume: 2.4,
    grossSpread: 2.83,
    grossSpreadPercent: 0.076,
    grossProfit: 6.79,
    netProfit: -2.22,
    netProfitPercent: -0.025,
    buyFee: 8.97,
    sellFee: 8.97,
    withdrawalFee: 0,
    slippageCost: 1.94,
    latencyMs: 39,
    confidence: 31,
    score: {
      profitScore: 0,
      liquidityScore: 82,
      latencyScore: 96,
      slippageScore: 77,
      riskPenalty: 0,
      confidence: 31,
      recommendation: "REJECT"
    },
    status: "REJECTED",
    rejectionReason: "FEES_EXCEED_SPREAD",
    rejectionMessage: "Rejected - fees exceeded spread",
    recommendation: "REJECT",
    detectedAt: now,
    latency: latency(39)
  }
];

export const demoWallets: WalletBalance[] = [
  wallet("BINANCE", "USDT", 89752.42, 89752.42),
  wallet("BINANCE", "BTC", 1.15, 78487.5),
  wallet("BINANCE", "ETH", 10, 37400),
  wallet("KRAKEN", "USDT", 110247.88, 110247.88),
  wallet("KRAKEN", "BTC", 0.85, 58012.5),
  wallet("KRAKEN", "ETH", 10, 37400),
  wallet("OKX", "USDT", 100000, 100000),
  wallet("OKX", "BTC", 1, 68250),
  wallet("OKX", "ETH", 10, 37400)
];

export const demoLedger: WalletLedgerEntry[] = [
  {
    id: "ledger-1",
    exchange: "KRAKEN",
    asset: "USDT",
    change: 10247.88,
    balanceAfter: 110247.88,
    reason: "Simulated sell proceeds",
    tradeId: "demo-trade-1",
    createdAt: now
  },
  {
    id: "ledger-2",
    exchange: "BINANCE",
    asset: "BTC",
    change: 0.15,
    balanceAfter: 1.15,
    reason: "Simulated buy fill",
    tradeId: "demo-trade-1",
    createdAt: now
  }
];

export const demoTrade: SimulatedTrade = {
  id: "demo-trade-1",
  opportunityId: "demo-opp-1",
  symbol: "BTC/USDT",
  buyExchange: "BINANCE",
  sellExchange: "KRAKEN",
  volume: 0.15,
  requestedVolume: 0.15,
  buyCost: 10237.71,
  sellRevenue: 10247.12,
  totalFees: 36.88,
  withdrawalFee: 0.0,
  slippageCost: 1.08,
  netProfit: 6.82,
  status: "SIMULATED",
  createdAt: now,
  timeline: [
    step("Opportunity detected", 0),
    step("Risk checks started", 6),
    step("VWAP calculated", 13),
    step("Fees applied", 18),
    step("Wallet balances checked", 24),
    step("Simulated buy executed", 31),
    step("Simulated sell executed", 38),
    step("Wallets updated", 44),
    step("P&L calculated", 47)
  ]
};

export const demoRisk: RiskStatus = {
  circuitBreakerActive: false,
  currentRiskLevel: "LOW",
  config: {
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
  },
  currentHighestLatencyMs: 61
};

export const demoAnalytics: AnalyticsSummary = {
  totalOpportunities: 24,
  executedOpportunities: 7,
  rejectedOpportunities: 15,
  expiredOpportunities: 2,
  totalGrossProfit: 184.22,
  totalNetProfit: 46.73,
  totalFeesPaid: 91.84,
  totalSlippageCost: 11.42,
  averageDetectionLatencyMs: 48,
  bestOpportunity: demoOpportunities[0]!,
  worstRejectedOpportunity: demoOpportunities[1]!,
  cumulativePnl: [
    { time: "10:00", pnl: 4.2, gross: 12, net: 4.2 },
    { time: "10:05", pnl: 12.8, gross: 32, net: 12.8 },
    { time: "10:10", pnl: 18.6, gross: 44, net: 18.6 },
    { time: "10:15", pnl: 33.4, gross: 71, net: 33.4 },
    { time: "10:20", pnl: 46.73, gross: 94, net: 46.73 }
  ],
  opportunitiesOverTime: [
    { time: "10:00", observed: 4, executed: 1, rejected: 3 },
    { time: "10:05", observed: 5, executed: 2, rejected: 3 },
    { time: "10:10", observed: 3, executed: 1, rejected: 2 },
    { time: "10:15", observed: 7, executed: 2, rejected: 4 },
    { time: "10:20", observed: 5, executed: 1, rejected: 3 }
  ],
  rejectionReasons: [
    { reason: "FEES_EXCEED_SPREAD", count: 6 },
    { reason: "BELOW_MIN_PROFIT_THRESHOLD", count: 4 },
    { reason: "INSUFFICIENT_LIQUIDITY", count: 3 },
    { reason: "LATENCY_TOO_HIGH", count: 2 }
  ],
  latencyByExchange: [
    { exchange: "BINANCE", latencyMs: 38, p50: 32, p95: 58, max: 72, avg: 36, samples: 124 },
    { exchange: "KRAKEN", latencyMs: 61, p50: 48, p95: 88, max: 132, avg: 54, samples: 118 },
    { exchange: "OKX", latencyMs: 42, p50: 38, p95: 64, max: 81, avg: 41, samples: 120 }
  ],
  volumeByPair: [
    { symbol: "BTC/USDT", volume: 1.24 },
    { symbol: "ETH/USDT", volume: 18.6 }
  ],
  volumeByExchange: [
    { exchange: "BINANCE", volume: 0.62, notional: 42_322 },
    { exchange: "KRAKEN", volume: 0.62, notional: 42_438 },
    { exchange: "OKX", volume: 0.3, notional: 20_475 }
  ]
};

function market(
  exchange: MarketSnapshot["exchange"],
  symbol: MarketSnapshot["symbol"],
  bidPrice: number,
  bidQty: number,
  askPrice: number,
  askQty: number,
  latencyMs: number
): MarketSnapshot {
  return {
    exchange,
    symbol,
    bidPrice,
    bidQty,
    askPrice,
    askQty,
    exchangeTimestamp: baseTime - latencyMs,
    backendReceivedAt: baseTime,
    normalizedAt: baseTime,
    latencyMs,
    spread: askPrice - bidPrice,
    liquidity: bidQty + askQty,
    status: "CONNECTED",
    lastUpdate: now
  };
}

function wallet(exchange: WalletBalance["exchange"], asset: string, balance: number, estimatedUsdValue: number): WalletBalance {
  return { exchange, asset, balance, estimatedUsdValue, updatedAt: now, lastTradeId: "demo-trade-1" };
}

function latency(value: number) {
  const current = baseTime;
  return {
    exchangeTimestamp: current - value,
    backendReceivedAt: current - 12,
    normalizedAt: current - 4,
    detectedAt: current,
    emittedToFrontendAt: current + 1,
    exchangeToBackendMs: value,
    normalizationMs: 8,
    detectionLatencyMs: 4
  };
}

function step(label: string, durationMs: number) {
  return {
    label,
    timestamp: now,
    durationMs,
    status: "completed" as const
  };
}
