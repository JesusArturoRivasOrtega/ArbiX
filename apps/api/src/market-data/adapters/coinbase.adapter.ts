import WebSocket from "ws";
import type { NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";
import { closeSocket, safeJsonParse } from "./safe-json.js";
import { normalizeExchangeSymbol } from "../symbol-registry.js";

type CoinbaseMessage = {
  type: string;
  product_id?: string;
  // snapshot fields
  bids?: string[][];
  asks?: string[][];
  // l2update fields
  changes?: Array<[string, string, string]>; // [side, price, new_size]
  time?: string;
  // error frame fields
  message?: string;
  reason?: string;
};

/**
 * Coinbase Exchange public WebSocket adapter.
 * Uses the level2 channel for real order book snapshots + incremental diffs.
 *
 * Protocol: wss://ws-feed.exchange.coinbase.com
 * Message types:
 *   - subscriptions: confirmation, ignored
 *   - snapshot: full order book
 *   - l2update: incremental update; size "0" = remove level
 */
export class CoinbaseAdapter extends AdapterBase {
  readonly name = "COINBASE" as const;
  private socket?: WebSocket;

  // In-memory order books keyed by Coinbase product_id
  private readonly books = new Map<
    string,
    { bids: Map<number, number>; asks: Map<number, number>; symbol: TradingSymbol }
  >();

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.symbols = symbols;
    this.status = "CONNECTING";

    const productIds = symbols.map(toCoinbaseSymbol);
    for (let i = 0; i < productIds.length; i++) {
      const sym = symbols[i];
      if (sym) {
        this.books.set(productIds[i]!, { bids: new Map(), asks: new Map(), symbol: sym });
      }
    }

    this.socket = new WebSocket("wss://ws-feed.exchange.coinbase.com");

    this.socket.on("open", () => {
      this.onConnected();
      this.socket?.send(
        JSON.stringify({
          type: "subscribe",
          product_ids: productIds,
          channels: ["level2"]
        })
      );
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
    const msg = safeJsonParse<CoinbaseMessage>(raw);
    if (!msg) return;

    // Surface subscription errors instead of silently staying CONNECTED with no
    // data. Coinbase replies with `{ type: "error", message, reason }` when a
    // product_id is invalid/unlisted (e.g. a pair this venue does not trade).
    if (msg.type === "error") {
      this.setError(new Error(msg.message ?? msg.reason ?? "Coinbase subscription error"));
      return;
    }

    if (msg.type === "subscriptions" || msg.type === "heartbeat") return;

    const productId = msg.product_id;
    if (!productId) return;

    const book = this.books.get(productId);
    if (!book) return;

    if (msg.type === "snapshot" && msg.bids && msg.asks) {
      // Full book snapshot — reset and populate
      book.bids.clear();
      book.asks.clear();
      for (const [price, qty] of msg.bids) {
        const p = Number(price);
        const q = Number(qty);
        if (p > 0 && q > 0) book.bids.set(p, q);
      }
      for (const [price, qty] of msg.asks) {
        const p = Number(price);
        const q = Number(qty);
        if (p > 0 && q > 0) book.asks.set(p, q);
      }
      this.emitBook(book, msg.time);
      return;
    }

    if (msg.type === "l2update" && msg.changes) {
      // Incremental update
      for (const [side, price, size] of msg.changes) {
        const p = Number(price);
        const q = Number(size);
        const map = side === "buy" ? book.bids : book.asks;
        if (q === 0) map.delete(p);
        else map.set(p, q);
      }
      this.emitBook(book, msg.time);
      return;
    }
  }

  private emitBook(
    book: { bids: Map<number, number>; asks: Map<number, number>; symbol: TradingSymbol },
    time?: string
  ) {
    const bids: OrderBookLevel[] = [...book.bids.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 10)
      .map(([price, quantity]) => ({ price, quantity }));

    const asks: OrderBookLevel[] = [...book.asks.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, 10)
      .map(([price, quantity]) => ({ price, quantity }));

    if (bids.length === 0 || asks.length === 0) return;

    const now = Date.now();
    const parsedTimestamp = time ? new Date(time).getTime() : Number.NaN;
    const hasExchangeTimestamp = Number.isFinite(parsedTimestamp);
    const exchangeTimestamp = hasExchangeTimestamp ? parsedTimestamp : now;

    const orderBook: NormalizedOrderBook = {
      exchange: this.name,
      symbol: book.symbol,
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

function toCoinbaseSymbol(symbol: TradingSymbol): string {
  // Coinbase uses BTC-USD, BTC-USDT, etc.
  return symbol.replace("/", "-");
}
