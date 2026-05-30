import type { ExchangeName, NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";

type Scenario = "profitable" | "fees" | "liquidity" | "latency" | "neutral";

const EXCHANGE_OFFSETS: Record<ExchangeName, number> = {
  BINANCE: -1,
  KRAKEN: 1,
  OKX: 0,
  COINBASE: 0,
  MOCK: 0
};

export class MockExchangeAdapter extends AdapterBase {
  readonly name: ExchangeName;
  private timer?: NodeJS.Timeout;
  private tick = 0;
  private scenario: Scenario = "neutral";

  constructor(name: ExchangeName) {
    super("DEMO");
    this.name = name;
  }

  async connect(symbols: TradingSymbol[]) {
    this.symbols = symbols;
    this.status = "CONNECTED";
    this.timer = setInterval(() => this.publishTick(), 900);
    this.publishTick();
  }

  async disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.status = "DISCONNECTED";
  }

  setScenario(scenario: Scenario) {
    this.scenario = scenario;
    this.tick = 0;
  }

  private publishTick() {
    this.tick += 1;
    for (const symbol of this.symbols) {
      this.emitOrderBook(this.createOrderBook(symbol));
    }
  }

  private createOrderBook(symbol: TradingSymbol): NormalizedOrderBook {
    const basePrice = symbol.startsWith("BTC") ? 68250 : 3740;
    const wave = Math.sin(this.tick / 4) * (symbol.startsWith("BTC") ? 18 : 3.5);
    const exchangeOffset = EXCHANGE_OFFSETS[this.name] ?? 0;
    let mid = basePrice + wave + exchangeOffset;
    let spread = symbol.startsWith("BTC") ? 12 : 1.2;
    let latencyOffset = 18 + Math.abs(exchangeOffset) * 2;

    const profitableBurst = this.scenario === "profitable" || (this.scenario === "neutral" && symbol === "BTC/USDT" && this.tick % 6 <= 1);
    if (profitableBurst && symbol === "BTC/USDT") {
      if (this.name === "BINANCE") mid -= 180;
      if (this.name === "KRAKEN") mid += 220;
      spread = 8;
    }

    if (this.scenario === "fees" && symbol === "ETH/USDT") {
      if (this.name === "OKX") mid -= 1.7;
      if (this.name === "BINANCE") mid += 1.9;
      spread = 1.1;
    }

    if (this.scenario === "liquidity" && symbol === "BTC/USDT") {
      if (this.name === "OKX") mid -= 25;
      if (this.name === "KRAKEN") mid += 33;
      spread = 7;
    }

    if (this.scenario === "latency") {
      latencyOffset = this.name === "KRAKEN" ? 1500 : latencyOffset;
    }

    const now = Date.now();
    const exchangeTimestamp = now - latencyOffset;
    const asks = this.depth(mid + spread / 2, "ask", symbol);
    const bids = this.depth(mid - spread / 2, "bid", symbol);
    if (this.scenario === "liquidity" && (this.name === "OKX" || this.name === "KRAKEN")) {
      asks.forEach((level) => {
        level.quantity = Math.min(level.quantity, 0.035);
      });
      bids.forEach((level) => {
        level.quantity = Math.min(level.quantity, 0.03);
      });
    }

    return {
      exchange: this.name,
      symbol,
      bids,
      asks,
      exchangeTimestamp,
      backendReceivedAt: now,
      normalizedAt: Date.now(),
      sequence: this.tick
    };
  }

  private depth(anchor: number, side: "bid" | "ask", symbol: TradingSymbol): OrderBookLevel[] {
    const isBtc = symbol.startsWith("BTC");
    const step = isBtc ? 7.5 : 0.7;
    const baseQty = isBtc ? 0.16 : 2.8;
    return Array.from({ length: 8 }, (_, index) => {
      const direction = side === "ask" ? 1 : -1;
      return {
        price: round(anchor + direction * index * step, isBtc ? 2 : 3),
        quantity: round(baseQty + index * (isBtc ? 0.04 : 0.7), 6)
      };
    });
  }
}

function round(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}
