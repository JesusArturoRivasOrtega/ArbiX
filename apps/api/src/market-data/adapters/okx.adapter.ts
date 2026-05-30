import WebSocket from "ws";
import type { NormalizedOrderBook, OrderBookLevel, TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";
import { normalizeExchangeSymbol, toOkxSymbol } from "../symbol-registry.js";

type OkxBookMessage = {
  arg?: { instId?: string };
  data?: Array<{
    asks?: string[][];
    bids?: string[][];
    ts?: string;
  }>;
};

export class OkxAdapter extends AdapterBase {
  readonly name = "OKX" as const;
  private socket?: WebSocket;

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.symbols = symbols;
    this.status = "CONNECTING";
    this.socket = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");
    this.socket.on("open", () => {
      this.status = "CONNECTED";
      this.socket?.send(
        JSON.stringify({
          op: "subscribe",
          args: symbols.map((symbol) => ({ channel: "books5", instId: toOkxSymbol(symbol) }))
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
    const payload = JSON.parse(raw) as OkxBookMessage;
    const instId = payload.arg?.instId;
    const data = payload.data?.[0];
    const symbol = instId ? normalizeExchangeSymbol(instId) : undefined;
    if (!symbol || !data?.asks || !data.bids || !this.symbols.includes(symbol)) return;

    const now = Date.now();
    const orderBook: NormalizedOrderBook = {
      exchange: this.name,
      symbol,
      bids: mapLevels(data.bids),
      asks: mapLevels(data.asks),
      exchangeTimestamp: Number(data.ts ?? now),
      backendReceivedAt: now,
      normalizedAt: Date.now()
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
