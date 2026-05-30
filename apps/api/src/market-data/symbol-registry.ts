import type { TradingSymbol } from "@arbix/shared";

export function toBinanceSymbol(symbol: TradingSymbol): string {
  return symbol.replace("/", "").toLowerCase();
}

export function toKrakenSymbol(symbol: TradingSymbol): string {
  const mapping: Record<TradingSymbol, string> = {
    "BTC/USDT": "BTC/USDT",
    "BTC/USD": "BTC/USD",
    "ETH/USDT": "ETH/USDT",
    "ETH/USD": "ETH/USD"
  };
  return mapping[symbol];
}

export function toOkxSymbol(symbol: TradingSymbol): string {
  return symbol.replace("/", "-");
}

export function normalizeExchangeSymbol(exchangeSymbol: string): TradingSymbol | undefined {
  const normalized = exchangeSymbol.toUpperCase().replace("-", "/");
  if (normalized === "XBT/USD") return "BTC/USD";
  if (normalized === "XBT/USDT") return "BTC/USDT";
  if (normalized === "BTC/USDT" || normalized === "BTC/USD" || normalized === "ETH/USDT" || normalized === "ETH/USD") {
    return normalized;
  }
  return undefined;
}
