import type { BotConfig, ExchangeFeeConfig, ExchangeName, RiskConfig, TradingSymbol } from "@arbix/shared";

export type SymbolConfig = {
  base: "BTC" | "ETH" | "SOL";
  quote: "USDT" | "USD";
  normalizedSymbol: TradingSymbol;
  enabled: boolean;
};

export const symbols: SymbolConfig[] = [
  { base: "BTC", quote: "USDT", normalizedSymbol: "BTC/USDT", enabled: true },
  { base: "ETH", quote: "USDT", normalizedSymbol: "ETH/USDT", enabled: true },
  { base: "SOL", quote: "USDT", normalizedSymbol: "SOL/USDT", enabled: true }
];

export const defaultFees: Record<ExchangeName, ExchangeFeeConfig> = {
  BINANCE:  { tradingFeeRate: 0.001,  withdrawalFee: 0 },
  KRAKEN:   { tradingFeeRate: 0.0026, withdrawalFee: 0 },
  OKX:      { tradingFeeRate: 0.001,  withdrawalFee: 0 },
  COINBASE: { tradingFeeRate: 0.002,  withdrawalFee: 0 },
  BYBIT:    { tradingFeeRate: 0.001,  withdrawalFee: 0 },
  MOCK:     { tradingFeeRate: 0.001,  withdrawalFee: 0 }
};

export const defaultRiskConfig: RiskConfig = {
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
};

export const initialWallets: Record<ExchangeName, Record<string, number>> = {
  BINANCE:  { USDT: 100000, USD: 0,      BTC: 1, ETH: 10, SOL: 200 },
  KRAKEN:   { USDT: 100000, USD: 100000, BTC: 1, ETH: 10, SOL: 200 },
  OKX:      { USDT: 100000, USD: 0,      BTC: 1, ETH: 10, SOL: 200 },
  COINBASE: { USDT: 0,      USD: 100000, BTC: 1, ETH: 10, SOL: 200 },
  BYBIT:    { USDT: 100000, USD: 0,      BTC: 1, ETH: 10, SOL: 200 },
  MOCK:     { USDT: 100000, USD: 100000, BTC: 1, ETH: 10, SOL: 200 }
};

export const exchangeDisplayNames: Record<ExchangeName, string> = {
  BINANCE:  "Binance",
  KRAKEN:   "Kraken",
  OKX:      "OKX",
  COINBASE: "Coinbase",
  BYBIT:    "Bybit",
  MOCK:     "Mock"
};

export function buildDefaultBotConfig(): BotConfig {
  return {
    ...defaultRiskConfig,
    marketMode: (process.env.MARKET_MODE as BotConfig["marketMode"] | undefined) ?? "DEMO",
    enabledExchanges: enabledExchangesFromEnv(),
    fees: defaultFees
  };
}

export function enabledExchangesFromEnv(): ExchangeName[] {
  const pairs: Array<[ExchangeName, string | undefined, boolean]> = [
    ["BINANCE",  process.env.ENABLE_BINANCE,  true],
    ["KRAKEN",   process.env.ENABLE_KRAKEN,   true],
    ["OKX",      process.env.ENABLE_OKX,      true],
    ["COINBASE", process.env.ENABLE_COINBASE, false],
    ["BYBIT",    process.env.ENABLE_BYBIT,    true]
  ];

  const enabled = pairs
    .filter(([, value, defaultEnabled]) => (value === undefined ? defaultEnabled : value === "true"))
    .map(([name]) => name);
  return enabled.length > 0 ? enabled : ["BINANCE", "KRAKEN", "OKX", "BYBIT"];
}
