import WebSocket from "ws";
import type { NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";
import { normalizeExchangeSymbol } from "../symbol-registry.js";

type CoinbaseTicker = {
  type: string;
  product_id?: string;
  best_bid?: string;
  best_bid_size?: string;
  best_ask?: string;
  best_ask_size?: string;
  time?: string;
};

export class CoinbaseAdapter extends AdapterBase {
  readonly name = "COINBASE" as const;
  private socket?: WebSocket;

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.symbols = symbols;
    this.status = "CONNECTING";

    const productIds = symbols.map(toCoinbaseSymbol);
    this.socket = new WebSocket("wss://ws-feed.exchange.coinbase.com");

    this.socket.on("open", () => {
      this.status = "CONNECTED";
      this.socket?.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: productIds,
          channels: ["ticker"]
        })
      );
    });

    this.socket.on("message", (raw) => this.handleMessage(raw.toString()));
    this.socket.on("error", (error) => this.setError(error));
    this.socket.on("close", () => {
      this.status = "DISCONNECTED";
    });
  }

  async disconnect() {
    this.socket?.close();
    this.status = "DISCONNECTED";
  }

  private handleMessage(raw: string) {
    let msg: CoinbaseTicker;
    try {
      msg = JSON.parse(raw) as CoinbaseTicker;
    } catch {
      return;
    }

    if (msg.type !== "ticker" || !msg.product_id || !msg.best_bid || !msg.best_ask) return;

    const symbol = normalizeExchangeSymbol(msg.product_id);
    if (!symbol || !this.symbols.includes(symbol)) return;

    const bid = Number(msg.best_bid);
    const ask = Number(msg.best_ask);
    if (!bid || !ask || bid <= 0 || ask <= 0) return;

    const bidQty = Number(msg.best_bid_size) || 0.5;
    const askQty = Number(msg.best_ask_size) || 0.5;
    const now = Date.now();
    const exchangeTimestamp = msg.time ? new Date(msg.time).getTime() : now;
    const step = Math.max((ask - bid) * 0.5, ask * 0.0001);

    const orderBook: NormalizedOrderBook = {
      exchange: this.name,
      symbol,
      bids: buildLevels(bid, bidQty, step, "bid"),
      asks: buildLevels(ask, askQty, step, "ask"),
      exchangeTimestamp,
      backendReceivedAt: now,
      normalizedAt: now
    };

    this.emitOrderBook(orderBook);
  }
}

function toCoinbaseSymbol(symbol: TradingSymbol): string {
  return symbol.replace("/", "-");
}

function buildLevels(anchor: number, topQty: number, step: number, side: "bid" | "ask"): OrderBookLevel[] {
  return Array.from({ length: 8 }, (_, i) => ({
    price: side === "bid" ? anchor - i * step : anchor + i * step,
    quantity: topQty * (1 + i * 0.4)
  }));
}
