import type { ExchangeName, NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";

type Scenario = "profitable" | "fees" | "liquidity" | "latency" | "neutral";

// Small per-exchange price offsets that simulate normal market fragmentation.
// Kept minimal so neutral-mode divergences are realistic and near-zero net.
const EXCHANGE_OFFSETS: Record<ExchangeName, number> = {
  BINANCE:  -1,
  KRAKEN:    1,
  OKX:       0,
  COINBASE:  0,
  BYBIT:    -0.5,
  MOCK:      0
};

// ---------------------------------------------------------------------------
// Scenario offset design (verified against fee structure):
//
// PROFITABLE — BTC/USDT  (Binance 0.1% + Kraken 0.26% = 0.36% total fees)
//   Need spread > fees + minNetProfitPercent (0.05%) = 0.41%
//   At $108k: 0.41% × 108,000 = $442.80 minimum spread
//   Offsets: BINANCE −270, KRAKEN +310 → combined $580 spread ✓ ($50+ net)
//
// FEES — ETH/USDT  (OKX 0.1% + Binance 0.1% = 0.2% total fees)
//   Need spread < fees to demonstrate rejection
//   Offsets: OKX −1.7, BINANCE +1.9 → $2.50 spread on 0.25 ETH = $0.625 gross
//   Fees on 0.25 ETH ≈ $1.42 > $0.625 → FEES_EXCEED_SPREAD ✓
//
// LIQUIDITY — BTC/USDT  (creates a profitable spread, then caps per-level qty)
//   Offsets: OKX −270, KRAKEN +310 (same as profitable to ensure spread exists)
//   Cap per level: 0.012 BTC → max liquidity = 8 × 0.012 = 0.096 BTC
//   liquidityScore = 0.096/0.25 × 100 = 38.4 < minLiquidityScore (40) → REJECTED ✓
// ---------------------------------------------------------------------------

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
    // Base prices reflect May 2026 market levels (BTC ≈ $108k, ETH ≈ $2,848, SOL ≈ $162).
    const isBtc = symbol.startsWith("BTC");
    const isSol = symbol.startsWith("SOL");
    const basePrice = isBtc ? 108_000 : isSol ? 162 : 2_848;
    const wave = Math.sin(this.tick / 4) * (isBtc ? 18 : isSol ? 0.4 : 3.5);
    const exchangeOffset = EXCHANGE_OFFSETS[this.name] ?? 0;
    // Scale exchange offset for SOL (smaller prices)
    const scaledOffset = isSol ? exchangeOffset * 0.0015 : exchangeOffset;
    let mid = basePrice + wave + scaledOffset;
    let spread = isBtc ? 12 : isSol ? 0.08 : 1.2;
    let latencyOffset = 18 + Math.abs(exchangeOffset) * 2;
    let liquidityCapBtc: number | null = null;

    // ------------------------------------------------------------------
    // PROFITABLE scenario: engineered spread guaranteed to yield net profit
    // after Binance (0.1%) + Kraken (0.26%) fees and slippage.
    //   Neutral mode auto-fires every 6 ticks so there are periodic
    //   profitable bursts without requiring manual scenario activation.
    // ------------------------------------------------------------------
    const profitableBurst =
      this.scenario === "profitable" ||
      (this.scenario === "neutral" && isBtc && this.tick % 6 <= 1);

    if (profitableBurst && isBtc) {
      if (this.name === "BINANCE") mid -= 270;
      if (this.name === "KRAKEN") mid += 310;
      spread = 8;
    }

    // ------------------------------------------------------------------
    // FEES scenario: tiny ETH spread guaranteed to be eaten by fees.
    // OKX → Binance, both 0.10% → combined 0.20% fee.
    // Gross spread ≈ $2.50/ETH at 0.25 ETH = $0.625 gross, fees ≈ $1.42.
    // ------------------------------------------------------------------
    if (this.scenario === "fees" && !isBtc) {
      if (this.name === "OKX")     mid -= 1.7;
      if (this.name === "BINANCE") mid += 1.9;
      spread = 1.1;
    }

    // ------------------------------------------------------------------
    // LIQUIDITY scenario: large profitable spread but severely capped
    // order-book depth so available volume < maxTradeSize.
    // liquidityScore = 0.096/0.25 × 100 = 38.4 < minLiquidityScore (40)
    // → rejected for INSUFFICIENT_LIQUIDITY even though spread is good.
    // ------------------------------------------------------------------
    if (this.scenario === "liquidity" && isBtc) {
      if (this.name === "OKX")    mid -= 270;
      if (this.name === "KRAKEN") mid += 310;
      spread = 8;
      liquidityCapBtc = 0.012; // 8 levels × 0.012 = 0.096 BTC max per side
    }

    // ------------------------------------------------------------------
    // LATENCY scenario: Kraken simulated as very high latency (1500ms).
    // Triggers circuit breaker via LATENCY_TOO_HIGH rejection.
    // ------------------------------------------------------------------
    if (this.scenario === "latency") {
      latencyOffset = this.name === "KRAKEN" ? 1500 : latencyOffset;
    }

    const now = Date.now();
    const exchangeTimestamp = now - latencyOffset;
    const asks = this.depth(mid + spread / 2, "ask", symbol, liquidityCapBtc);
    const bids = this.depth(mid - spread / 2, "bid", symbol, liquidityCapBtc);

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

  /**
   * Generate 8 order-book levels spreading away from `anchor`.
   * @param liquidityCap - optional per-level quantity cap (BTC only, for liquidity scenario)
   */
  private depth(
    anchor: number,
    side: "bid" | "ask",
    symbol: TradingSymbol,
    liquidityCap: number | null = null
  ): OrderBookLevel[] {
    const isBtc = symbol.startsWith("BTC");
    const isSol = symbol.startsWith("SOL");
    const step    = isBtc ? 7.5  : isSol ? 0.03 : 0.7;
    const baseQty = isBtc ? 0.16 : isSol ? 18.0 : 2.8;
    return Array.from({ length: 8 }, (_, index) => {
      const direction = side === "ask" ? 1 : -1;
      let quantity = round(baseQty + index * (isBtc ? 0.04 : isSol ? 2.5 : 0.7), 6);
      if (liquidityCap !== null) {
        quantity = Math.min(quantity, liquidityCap);
      }
      return {
        price: round(anchor + direction * index * step, isBtc ? 2 : 3),
        quantity
      };
    });
  }
}

function round(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}
