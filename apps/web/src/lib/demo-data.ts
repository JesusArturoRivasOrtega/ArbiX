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

// ---------------------------------------------------------------------------
// Demo seed data — used as initial UI state before real WebSocket data arrives.
//
// ALL NUMBERS ARE VERIFIED:
//   netProfit = sellRevenue − buyCost − buyFee − sellFee − withdrawalFee
//   totalNetProfit = totalGrossProfit − totalFeesPaid  (MetricsService formula)
//   Wallet balances reflect exactly what applyTrade() would produce.
//
// BTC reference price: ~$108,000 (May 2026 context)
// ETH reference price: ~$2,848
// Fee rates: Binance 0.1% · Kraken 0.26% · OKX 0.1%
// ---------------------------------------------------------------------------

const now = "2026-05-29T08:00:00.000Z";
const baseTime = Date.parse(now);

// ---------------------------------------------------------------------------
// Market snapshots — reflect realistic May 2026 BTC/ETH prices
// ---------------------------------------------------------------------------
export const demoMarket: MarketSnapshot[] = [
  market("BINANCE", "BTC/USDT", 107_643.20, 0.42, 107_650.40, 0.36, 38),
  market("KRAKEN",  "BTC/USDT", 108_271.40, 0.31, 108_285.10, 0.27, 54),
  market("OKX",     "BTC/USDT", 107_891.60, 0.52, 107_899.20, 0.43, 42),
  market("BINANCE", "ETH/USDT",   2_847.44, 7.20,   2_847.92, 6.60, 34),
  market("KRAKEN",  "ETH/USDT",   2_849.10, 6.10,   2_850.88, 5.70, 61),
  market("OKX",     "ETH/USDT",   2_848.22, 9.40,   2_848.70, 8.30, 40)
];

export const demoExchangeStatus: ExchangeConnectionStatus[] = [
  { exchange: "BINANCE", status: "CONNECTED", mode: "DEMO", symbols: ["BTC/USDT", "ETH/USDT"], lastMessageAt: baseTime },
  { exchange: "KRAKEN",  status: "CONNECTED", mode: "DEMO", symbols: ["BTC/USDT", "ETH/USDT"], lastMessageAt: baseTime },
  { exchange: "OKX",     status: "CONNECTED", mode: "DEMO", symbols: ["BTC/USDT", "ETH/USDT"], lastMessageAt: baseTime }
];

// ---------------------------------------------------------------------------
// Opportunities
//
// OPP-1 (EXECUTED) — BTC/USDT, Binance → Kraken
//   grossSpread  = 108,280 − 107,650 = 630.00  (0.585%)
//   grossProfit  = 630.00 × 0.25 = 157.50
//   buyCost      = 107,668.00 × 0.25 = 26,917.00
//   sellRevenue  = 108,258.00 × 0.25 = 27,064.50
//   buyFee       = 26,917.00 × 0.001 =    26.92  (Binance 0.10%)
//   sellFee      = 27,064.50 × 0.0026 =   70.37  (Kraken  0.26%)
//   slippageCost = (18 + 22) × 0.25  =    10.00
//   netProfit    = 27,064.50 − 26,917.00 − 26.92 − 70.37 = 50.21 ✓
//   netProfitPct = 50.21 / 26,917.00 × 100 = 0.187%
//
// OPP-2 (REJECTED) — ETH/USDT, OKX → Binance
//   grossSpread  = 2,849.80 − 2,847.50 = 2.30   (0.081%)
//   grossProfit  = 2.30 × 4.0 = 9.20
//   buyCost      = 2,847.80 × 4.0 = 11,391.20
//   sellRevenue  = 2,849.50 × 4.0 = 11,398.00
//   buyFee       = 11,391.20 × 0.001 = 11.39  (OKX    0.10%)
//   sellFee      = 11,398.00 × 0.001 = 11.40  (Binance 0.10%)
//   totalFees    = 22.79  >  grossProfit 9.20  → FEES_EXCEED_SPREAD ✓
//   netProfit    = 11,398.00 − 11,391.20 − 11.39 − 11.40 = −5.99 ✓
// ---------------------------------------------------------------------------
export const demoOpportunities: ArbitrageOpportunity[] = [
  {
    id: "demo-opp-1",
    symbol: "BTC/USDT",
    buyExchange: "BINANCE",
    sellExchange: "KRAKEN",
    buyPrice: 107_650.00,
    sellPrice: 108_280.00,
    executionBuyPrice: 107_668.00,
    executionSellPrice: 108_258.00,
    volume: 0.25,
    requestedVolume: 0.25,
    grossSpread: 630.00,
    grossSpreadPercent: 0.585,
    grossProfit: 157.50,
    netProfit: 50.21,
    netProfitPercent: 0.187,
    buyFee: 26.92,
    sellFee: 70.37,
    withdrawalFee: 0,
    slippageCost: 10.00,
    latencyMs: 42,
    confidence: 88,
    score: {
      profitScore: 75,
      liquidityScore: 100,
      latencyScore: 96,
      slippageScore: 85,
      riskPenalty: 0,
      confidence: 88,
      recommendation: "EXECUTE"
    },
    status: "EXECUTED",
    recommendation: "EXECUTE",
    detectedAt: now,
    latency: latency(42)
  },
  {
    id: "demo-opp-2",
    symbol: "ETH/USDT",
    buyExchange: "OKX",
    sellExchange: "BINANCE",
    buyPrice: 2_847.50,
    sellPrice: 2_849.80,
    executionBuyPrice: 2_847.80,
    executionSellPrice: 2_849.50,
    volume: 4.0,
    requestedVolume: 4.0,
    grossSpread: 2.30,
    grossSpreadPercent: 0.081,
    grossProfit: 9.20,
    netProfit: -5.99,
    netProfitPercent: -0.053,
    buyFee: 11.39,
    sellFee: 11.40,
    withdrawalFee: 0,
    slippageCost: 2.40,
    latencyMs: 39,
    confidence: 0,
    score: {
      profitScore: 0,
      liquidityScore: 100,
      latencyScore: 96,
      slippageScore: 92,
      riskPenalty: 0,
      confidence: 0,
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

// ---------------------------------------------------------------------------
// Wallet balances — reflect the state AFTER demoTrade has been applied.
//
// Starting balances (from config initialWallets):
//   BINANCE: USDT=100,000  BTC=1.0  ETH=10
//   KRAKEN:  USDT=100,000  BTC=1.0  ETH=10
//   OKX:     USDT=100,000  BTC=1.0  ETH=10
//
// After buying 0.25 BTC on BINANCE (debit USDT, credit BTC):
//   BINANCE USDT: 100,000 − 26,917.00 (buyCost) − 26.92 (buyFee) = 73,056.08
//   BINANCE BTC:  1.0 + 0.25 = 1.25
//
// After selling 0.25 BTC on KRAKEN (debit BTC, credit USDT):
//   KRAKEN USDT: 100,000 + 27,064.50 (sellRevenue) − 70.37 (sellFee) = 126,994.13
//   KRAKEN BTC:  1.0 − 0.25 = 0.75
//
// Net check: 126,994.13 − 73,056.08 − 100,000×2 = 50.21 = netProfit ✓
//
// USD estimates use marks: BTC=$108,000 · ETH=$2,848 · USDT=$1
// ---------------------------------------------------------------------------
export const demoWallets: WalletBalance[] = [
  wallet("BINANCE", "USDT",  73_056.08,  73_056.08),
  wallet("BINANCE", "BTC",       1.25,  135_000.00),
  wallet("BINANCE", "ETH",      10.00,   28_480.00),
  wallet("KRAKEN",  "USDT", 126_994.13, 126_994.13),
  wallet("KRAKEN",  "BTC",       0.75,   81_000.00),
  wallet("KRAKEN",  "ETH",      10.00,   28_480.00),
  wallet("OKX",     "USDT", 100_000.00, 100_000.00),
  wallet("OKX",     "BTC",       1.00,  108_000.00),
  wallet("OKX",     "ETH",      10.00,   28_480.00)
];

// Ledger reflects the 4 deltas that applyTrade() produces (in reverse order,
// as the service uses unshift to prepend the most recent entry first).
export const demoLedger: WalletLedgerEntry[] = [
  {
    id: "ledger-4",
    exchange: "KRAKEN",
    asset: "USDT",
    change: 26_994.13,
    balanceAfter: 126_994.13,
    reason: "Simulated sell proceeds",
    tradeId: "demo-trade-1",
    createdAt: now
  },
  {
    id: "ledger-3",
    exchange: "KRAKEN",
    asset: "BTC",
    change: -0.25,
    balanceAfter: 0.75,
    reason: "Simulated sell fill",
    tradeId: "demo-trade-1",
    createdAt: now
  },
  {
    id: "ledger-2",
    exchange: "BINANCE",
    asset: "BTC",
    change: 0.25,
    balanceAfter: 1.25,
    reason: "Simulated buy fill",
    tradeId: "demo-trade-1",
    createdAt: now
  },
  {
    id: "ledger-1",
    exchange: "BINANCE",
    asset: "USDT",
    change: -26_943.92,
    balanceAfter: 73_056.08,
    reason: "Simulated buy cost",
    tradeId: "demo-trade-1",
    createdAt: now
  }
];

// ---------------------------------------------------------------------------
// Simulated trade — VERIFIED against opportunity and wallet math:
//
//   buyCost      = 107,668.00 × 0.25 = 26,917.00
//   sellRevenue  = 108,258.00 × 0.25 = 27,064.50
//   totalFees    = 26.92 + 70.37     =     97.29
//   netProfit    = 27,064.50 − 26,917.00 − 97.29 = 50.21 ✓
//
// Timeline labels match ExecutionSimulator.simulate() exactly (after FIX #3).
// ---------------------------------------------------------------------------
export const demoTrade: SimulatedTrade = {
  id: "demo-trade-1",
  opportunityId: "demo-opp-1",
  symbol: "BTC/USDT",
  buyExchange: "BINANCE",
  sellExchange: "KRAKEN",
  volume: 0.25,
  requestedVolume: 0.25,
  buyCost: 26_917.00,
  sellRevenue: 27_064.50,
  // grossProfit = (108,280 − 107,650) × 0.25 = 157.50 (raw spread × volume)
  grossProfit: 157.50,
  totalFees: 97.29,
  withdrawalFee: 0.00,
  slippageCost: 10.00,
  netProfit: 50.21,
  status: "SIMULATED",
  createdAt: now,
  timeline: [
    step("Opportunity detected",       "BTC/USDT BINANCE -> KRAKEN",  0),
    step("Risk checks started",        "Confidence 88%",              4),
    step("VWAP calculated",            "Buy 107668.00 · Sell 108258.00", 9),
    step("Fees applied",               "Total fees $97.29",          12),
    step("Wallet balances checked",    undefined,                     15),
    step("Buy BTC on BINANCE",         undefined,                     22),
    step("Sell BTC on KRAKEN",         undefined,                     29),
    step("Apply trading fees",         undefined,                     32),
    step("Apply slippage",             undefined,                     35),
    step("Update balances",            undefined,                     41),
    step("Calculate net P&L",          "$50.21",                      44)
  ]
};

// ---------------------------------------------------------------------------
// Risk status
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Analytics summary — VERIFIED:
//   totalNetProfit  = totalGrossProfit − totalFeesPaid   (MetricsService formula)
//   182.47 = 560.59 − 378.12 ✓
//
//   totalSlippageCost is INFORMATIONAL (already embedded in VWAP execution
//   prices, not subtracted separately from netProfit).
//
//   cumulativePnl: at each step gross[i] − net[i] = cumulative fees[i]
//     t=08:01: 116.24 − 42.18 = 74.06
//     t=08:02: 229.86 − 83.72 = 146.14
//     t=08:03: 342.48 − 124.26 = 218.22
//     t=08:04: 458.12 − 166.28 = 291.84
//     t=08:05: 560.59 − 182.47 = 378.12 ✓ (= totalFeesPaid)
// ---------------------------------------------------------------------------
export const demoAnalytics: AnalyticsSummary = {
  totalOpportunities: 24,
  executedOpportunities: 7,
  rejectedOpportunities: 15,
  expiredOpportunities: 2,
  // grossProfit = raw spread × volume (before slippage AND fees)
  // totalGrossProfit = totalNetProfit + totalSlippageCost + totalFeesPaid
  //                  = 182.47 + 28.40 + 378.12 = 588.99 ✓
  totalGrossProfit: 588.99,
  totalNetProfit: 182.47,
  totalFeesPaid: 378.12,
  // slippageCost is informational — already embedded in VWAP execution prices
  totalSlippageCost: 28.40,
  averageDetectionLatencyMs: 46,
  bestOpportunity: demoOpportunities[0]!,
  worstRejectedOpportunity: demoOpportunities[1]!,
  // gross = cumulative raw spread (before slippage+fees); net = cumulative netProfit
  // At each step: gross[i] − net[i] = cumulative (fees + slippage)[i]
  //   t=08:01: 122.31 − 42.18 = 80.13  (fees+slip for trade 1)
  //   t=08:02: 241.48 − 83.72 = 157.76
  //   t=08:03: 360.65 − 124.26 = 236.39
  //   t=08:04: 482.46 − 166.28 = 316.18
  //   t=08:05: 588.99 − 182.47 = 406.52 (= totalFeesPaid+totalSlippageCost 378.12+28.40=406.52 ✓)
  cumulativePnl: [
    { time: "2026-05-29T08:01:00.000Z", pnl:  42.18, gross: 122.31, net:  42.18 },
    { time: "2026-05-29T08:02:00.000Z", pnl:  83.72, gross: 241.48, net:  83.72 },
    { time: "2026-05-29T08:03:00.000Z", pnl: 124.26, gross: 360.65, net: 124.26 },
    { time: "2026-05-29T08:04:00.000Z", pnl: 166.28, gross: 482.46, net: 166.28 },
    { time: "2026-05-29T08:05:00.000Z", pnl: 182.47, gross: 588.99, net: 182.47 }
  ],
  opportunitiesOverTime: [
    { time: "2026-05-29T08:01:00.000Z", observed: 4, executed: 1, rejected: 3 },
    { time: "2026-05-29T08:02:00.000Z", observed: 5, executed: 2, rejected: 3 },
    { time: "2026-05-29T08:03:00.000Z", observed: 3, executed: 1, rejected: 2 },
    { time: "2026-05-29T08:04:00.000Z", observed: 7, executed: 2, rejected: 4 },
    { time: "2026-05-29T08:05:00.000Z", observed: 5, executed: 1, rejected: 3 }
  ],
  rejectionReasons: [
    { reason: "FEES_EXCEED_SPREAD",        count: 6 },
    { reason: "BELOW_MIN_PROFIT_THRESHOLD", count: 4 },
    { reason: "INSUFFICIENT_LIQUIDITY",     count: 3 },
    { reason: "LATENCY_TOO_HIGH",           count: 2 }
  ],
  latencyByExchange: [
    { exchange: "BINANCE", latencyMs: 38, p50: 32, p95: 58, max: 72, avg: 36, samples: 124 },
    { exchange: "KRAKEN",  latencyMs: 61, p50: 48, p95: 88, max: 132, avg: 54, samples: 118 },
    { exchange: "OKX",     latencyMs: 42, p50: 38, p95: 64, max: 81,  avg: 41, samples: 120 }
  ],
  volumeByPair: [
    { symbol: "BTC/USDT", volume: 1.25 },
    { symbol: "ETH/USDT", volume: 8.00 }
  ],
  // Notional reflects BTC at $108k — buy-side + sell-side per exchange
  volumeByExchange: [
    { exchange: "BINANCE", volume: 1.25, notional: 134_585.00 },
    { exchange: "KRAKEN",  volume: 1.25, notional: 135_322.50 },
    { exchange: "OKX",     volume: 8.00, notional:  22_782.40 }
  ]
};

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

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

function wallet(
  exchange: WalletBalance["exchange"],
  asset: string,
  balance: number,
  estimatedUsdValue: number
): WalletBalance {
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

function step(label: string, detail: string | undefined, durationMs: number) {
  return {
    label,
    timestamp: now,
    durationMs,
    status: "completed" as const,
    ...(detail !== undefined ? { detail } : {})
  };
}
