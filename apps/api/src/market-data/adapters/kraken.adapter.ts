import WebSocket from "ws";
import type { NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";
import { closeSocket, safeJsonParse } from "./safe-json.js";
import { normalizeExchangeSymbol, toKrakenSymbol } from "../symbol-registry.js";

type KrakenBookMessage = {
  channel?: string;
  type?: string;
  data?: Array<{
    symbol: string;
    bids: Array<{ price: number; qty: number }>;
    asks: Array<{ price: number; qty: number }>;
    timestamp?: string;
  }>;
};

export class KrakenAdapter extends AdapterBase {
  readonly name = "KRAKEN" as const;
  private socket?: WebSocket;

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.beginConnection();
    this.symbols = symbols;
    this.status = "CONNECTING";
    this.socket = new WebSocket("wss://ws.kraken.com/v2");
    this.socket.on("open", () => {
      this.onConnected();
      this.socket?.send(
        JSON.stringify({
          method: "subscribe",
          params: {
            channel: "book",
            depth: 10,
            symbol: symbols.map(toKrakenSymbol)
          }
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
  }

  private handleMessage(raw: string) {
    const payload = safeJsonParse<KrakenBookMessage>(raw);
    if (!payload) return;
    if (payload.channel !== "book" || !payload.data) return;

    for (const item of payload.data) {
      const symbol = normalizeExchangeSymbol(item.symbol);
      if (!symbol || !this.symbols.includes(symbol)) continue;
      const now = Date.now();
      const parsedTimestamp = item.timestamp ? new Date(item.timestamp).getTime() : Number.NaN;
      const hasExchangeTimestamp = Number.isFinite(parsedTimestamp);
      const exchangeTimestamp = hasExchangeTimestamp ? parsedTimestamp : now;
      const orderBook: NormalizedOrderBook = {
        exchange: this.name,
        symbol,
        bids: item.bids.map(mapKrakenLevel),
        asks: item.asks.map(mapKrakenLevel),
        exchangeTimestamp,
        backendReceivedAt: now,
        normalizedAt: Date.now(),
        exchangeLatencyMs: hasExchangeTimestamp ? now - exchangeTimestamp : null,
        latencyConfidence: hasExchangeTimestamp ? "HIGH" : "UNKNOWN"
      };
      this.emitOrderBook(orderBook);
    }
  }
}

function mapKrakenLevel(level: { price: number; qty: number }): OrderBookLevel {
  return {
    price: Number(level.price),
    quantity: Number(level.qty)
  };
}
