import WebSocket from "ws";
import type { NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";
import { closeSocket, safeJsonParse } from "./safe-json.js";
import { fromBybitSymbol, toBybitSymbol } from "../symbol-registry.js";

type BybitBookData = {
  s: string;
  b: string[][];
  a: string[][];
  u: number;
  seq?: number;
};

type BybitMessage = {
  topic?: string;
  type?: string;
  ts?: number;
  data?: BybitBookData;
  op?: string;
  success?: boolean;
};

/**
 * Bybit V5 public spot WebSocket adapter.
 * Subscribes to orderbook.50 for each symbol.
 * Handles snapshot (full book) + delta (incremental) updates.
 *
 * Protocol: wss://stream.bybit.com/v5/public/spot
 * Message types:
 *   - snapshot: full order book on subscribe
 *   - delta: only changed levels; quantity "0" = remove level
 */
export class BybitAdapter extends AdapterBase {
  readonly name = "BYBIT" as const;
  private socket?: WebSocket;

  // In-memory order books keyed by symbol
  private readonly books = new Map<
    TradingSymbol,
    { bids: Map<number, number>; asks: Map<number, number> }
  >();

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.beginConnection();
    this.symbols = symbols;
    this.status = "CONNECTING";

    for (const sym of symbols) {
      this.books.set(sym, { bids: new Map(), asks: new Map() });
    }

    this.socket = new WebSocket("wss://stream.bybit.com/v5/public/spot");

    this.socket.on("open", () => {
      this.onConnected();
      const args = symbols.map((s) => `orderbook.50.${toBybitSymbol(s)}`);
      this.socket?.send(JSON.stringify({ op: "subscribe", args }));
    });

    this.socket.on("message", (raw) => this.handleMessage(raw.toString()));
    this.socket.on("error", (error) => this.setError(error));
    this.socket.on("close", () => this.onDisconnected());
  }

  async disconnect() {
    this.markManualDisconnect();
    await closeSocket(this.socket);
    delete this.socket;
    this.status = "DISCONNECTED";
    this.books.clear();
  }

  private handleMessage(raw: string) {
    const msg = safeJsonParse<BybitMessage>(raw);
    if (!msg) return;

    // Subscription confirmation — ignore
    if (msg.op === "subscribe") return;
    if (!msg.topic || !msg.data || !msg.type) return;

    const data = msg.data;
    const symbol = fromBybitSymbol(data.s);
    if (!symbol || !this.symbols.includes(symbol)) return;

    const book = this.books.get(symbol);
    if (!book) return;

    if (msg.type === "snapshot") {
      // Full book — reset and populate
      book.bids.clear();
      book.asks.clear();
      for (const [price, qty] of data.b) {
        const p = Number(price);
        const q = Number(qty);
        if (p > 0 && q > 0) book.bids.set(p, q);
      }
      for (const [price, qty] of data.a) {
        const p = Number(price);
        const q = Number(qty);
        if (p > 0 && q > 0) book.asks.set(p, q);
      }
    } else if (msg.type === "delta") {
      // Incremental update — apply changes
      for (const [price, qty] of data.b) {
        const p = Number(price);
        const q = Number(qty);
        if (q === 0) book.bids.delete(p);
        else book.bids.set(p, q);
      }
      for (const [price, qty] of data.a) {
        const p = Number(price);
        const q = Number(qty);
        if (q === 0) book.asks.delete(p);
        else book.asks.set(p, q);
      }
    } else {
      return;
    }

    const now = Date.now();
    const eventTimestamp = msg.ts;
    const hasExchangeTimestamp = typeof eventTimestamp === "number" && Number.isFinite(eventTimestamp);
    const exchangeTimestamp = hasExchangeTimestamp ? eventTimestamp : now;

    const bids: OrderBookLevel[] = [...book.bids.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 10)
      .map(([price, quantity]) => ({ price, quantity }));

    const asks: OrderBookLevel[] = [...book.asks.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, 10)
      .map(([price, quantity]) => ({ price, quantity }));

    if (bids.length === 0 || asks.length === 0) return;

    const orderBook: NormalizedOrderBook = {
      exchange: this.name,
      symbol,
      bids,
      asks,
      exchangeTimestamp,
      backendReceivedAt: now,
      normalizedAt: Date.now(),
      exchangeLatencyMs: hasExchangeTimestamp ? now - exchangeTimestamp : null,
      latencyConfidence: hasExchangeTimestamp ? "HIGH" : "UNKNOWN"
    };

    this.emitOrderBook(orderBook);
  }
}
