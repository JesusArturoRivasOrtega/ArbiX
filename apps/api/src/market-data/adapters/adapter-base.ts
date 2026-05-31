import type {
  BestQuote,
  ConnectionStatus,
  ExchangeConnectionStatus,
  ExchangeName,
  GeneratedBy,
  MarketMode,
  NormalizedOrderBook,
  TradingSymbol
} from "@arbix/shared";
import { uid } from "@arbix/shared";
import type { ExchangeAdapter } from "../interfaces/exchange-adapter.interface.js";

// Exponential-backoff bounds for automatic WebSocket reconnection.
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export abstract class AdapterBase implements ExchangeAdapter {
  abstract readonly name: ExchangeName;
  readonly mode: MarketMode;
  protected status: ConnectionStatus = "DISCONNECTED";
  protected symbols: TradingSymbol[] = [];
  protected lastMessageAt?: number;
  protected error?: string;
  private readonly adapterId = uid("adapter");
  private generationId = 0;
  private readonly quoteCallbacks: Array<(quote: BestQuote) => void> = [];
  private readonly orderBookCallbacks: Array<(orderBook: NormalizedOrderBook) => void> = [];
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;

  protected constructor(mode: MarketMode) {
    this.mode = mode;
  }

  abstract connect(symbols: TradingSymbol[]): Promise<void>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.status === "CONNECTED";
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle helpers shared by every live WebSocket adapter.
  //
  // Adapters call these from their socket event handlers so that resilience
  // (auto-reconnect with exponential backoff) lives in one place instead of
  // being duplicated — or missing — in each exchange adapter.
  // -------------------------------------------------------------------------

  /** Call at the very start of connect() so a fresh cycle is not treated as a teardown. */
  protected beginConnection(): void {
    this.manualDisconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      delete this.reconnectTimer;
    }
  }

  /** Call from the socket "open" handler once the stream is live. */
  protected onConnected(): void {
    this.status = "CONNECTED";
    this.reconnectAttempts = 0;
  }

  /**
   * Call from the socket "close" handler. Schedules an automatic reconnect
   * with exponential backoff unless disconnect() requested the teardown.
   */
  protected onDisconnected(): void {
    if (this.status !== "ERROR") {
      this.status = "DISCONNECTED";
    }
    if (this.manualDisconnect) return;
    this.scheduleReconnect();
  }

  /** Call from each adapter's disconnect() to suppress auto-reconnect. */
  protected markManualDisconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      delete this.reconnectTimer;
    }
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect || this.reconnectTimer) return;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      delete this.reconnectTimer;
      if (this.manualDisconnect) return;
      this.status = "CONNECTING";
      void this.connect(this.symbols).catch((error) => {
        this.setError(error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  getAdapterId(): string {
    return this.adapterId;
  }

  getGenerationId(): number {
    return this.generationId;
  }

  setGenerationId(generationId: number): void {
    this.generationId = generationId;
  }

  onQuote(callback: (quote: BestQuote) => void): void {
    this.quoteCallbacks.push(callback);
  }

  onOrderBook(callback: (orderBook: NormalizedOrderBook) => void): void {
    this.orderBookCallbacks.push(callback);
  }

  getStatus(): ExchangeConnectionStatus {
    return {
      exchange: this.name,
      status: this.status,
      mode: this.mode,
      symbols: [...this.symbols],
      ...(this.lastMessageAt ? { lastMessageAt: this.lastMessageAt } : {}),
      ...(this.error ? { error: this.error } : {})
    };
  }

  protected emitOrderBook(orderBook: NormalizedOrderBook) {
    this.lastMessageAt = Date.now();
    const exchangeLatencyMs =
      typeof orderBook.exchangeLatencyMs === "number" && Number.isFinite(orderBook.exchangeLatencyMs)
        ? Math.max(0, orderBook.exchangeLatencyMs)
        : typeof orderBook.exchangeTimestamp === "number" && orderBook.exchangeTimestamp > 0
          ? Math.max(0, orderBook.backendReceivedAt - orderBook.exchangeTimestamp)
        : null;
    const latencyConfidence = orderBook.latencyConfidence ?? (exchangeLatencyMs === null ? "UNKNOWN" : "HIGH");
    const adapterId = orderBook.adapterId ?? this.adapterId;
    const generationId = orderBook.generationId ?? this.generationId;
    const marketMode = orderBook.marketMode ?? this.mode;
    const source = orderBook.source ?? this.mode;
    const generatedBy = orderBook.generatedBy ?? this.getGeneratedBy();
    const enrichedOrderBook: NormalizedOrderBook = {
      ...orderBook,
      adapterId,
      generationId,
      marketMode,
      source,
      generatedBy,
      exchangeLatencyMs,
      latencyConfidence
    };
    this.orderBookCallbacks.forEach((callback) => callback(enrichedOrderBook));
    const bestBid = orderBook.bids[0];
    const bestAsk = orderBook.asks[0];
    if (!bestBid || !bestAsk) {
      return;
    }

    const quote: BestQuote = {
      exchange: enrichedOrderBook.exchange,
      symbol: enrichedOrderBook.symbol,
      bidPrice: bestBid.price,
      bidQty: bestBid.quantity,
      askPrice: bestAsk.price,
      askQty: bestAsk.quantity,
      exchangeTimestamp: enrichedOrderBook.exchangeTimestamp,
      backendReceivedAt: enrichedOrderBook.backendReceivedAt,
      normalizedAt: enrichedOrderBook.normalizedAt,
      latencyMs: exchangeLatencyMs ?? 0,
      adapterId,
      generationId,
      marketMode,
      source,
      generatedBy,
      exchangeLatencyMs,
      latencyConfidence
    };
    this.quoteCallbacks.forEach((callback) => callback(quote));
  }

  protected setError(error: unknown) {
    this.status = "ERROR";
    this.error = error instanceof Error ? error.message : String(error);
  }

  private getGeneratedBy(): GeneratedBy {
    if (this.mode === "DEMO") return "mock-adapter";
    if (this.mode === "REPLAY") return "replay-adapter";
    return "live-adapter";
  }
}
