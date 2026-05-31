import WebSocket from "ws";
import type { NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";
import { closeSocket, safeJsonParse } from "./safe-json.js";
import { toBinanceSymbol } from "../symbol-registry.js";

export class BinanceAdapter extends AdapterBase {
  readonly name = "BINANCE" as const;
  private socket?: WebSocket;

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.beginConnection();
    this.symbols = symbols;
    this.status = "CONNECTING";
    const streams = symbols.map((symbol) => `${toBinanceSymbol(symbol)}@depth10@100ms`).join("/");
    this.socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    this.socket.on("open", () => this.onConnected());
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
    const payload = safeJsonParse<{
      stream?: string;
      data?: { lastUpdateId?: number; bids?: string[][]; asks?: string[][]; E?: number };
    }>(raw);
    if (!payload) return;
    const streamSymbol = payload.stream?.split("@")[0]?.toUpperCase();
    const symbol = this.symbols.find((item) => item.replace("/", "") === streamSymbol);
    if (!symbol || !payload.data?.bids || !payload.data.asks) return;

    const now = Date.now();
    const eventTimestamp = payload.data.E;
    const hasExchangeTimestamp = typeof eventTimestamp === "number" && Number.isFinite(eventTimestamp);
    const exchangeTimestamp = hasExchangeTimestamp ? eventTimestamp : now;
    const orderBook: NormalizedOrderBook = {
      exchange: this.name,
      symbol,
      bids: mapLevels(payload.data.bids),
      asks: mapLevels(payload.data.asks),
      exchangeTimestamp,
      backendReceivedAt: now,
      normalizedAt: Date.now(),
      exchangeLatencyMs: hasExchangeTimestamp ? now - exchangeTimestamp : null,
      latencyConfidence: hasExchangeTimestamp ? "HIGH" : "UNKNOWN",
      ...(payload.data.lastUpdateId ? { sequence: payload.data.lastUpdateId } : {})
    };
    this.emitOrderBook(orderBook);
  }
}

function mapLevels(levels: string[][]): OrderBookLevel[] {
  return levels.slice(0, 10).map(([price, quantity]) => ({
    price: Number(price),
    quantity: Number(quantity)
  }));
}
