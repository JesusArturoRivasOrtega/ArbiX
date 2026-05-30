import type {
  BestQuote,
  ConnectionStatus,
  ExchangeConnectionStatus,
  ExchangeName,
  MarketMode,
  NormalizedOrderBook,
  TradingSymbol
} from "@arbix/shared";
import type { ExchangeAdapter } from "../interfaces/exchange-adapter.interface.js";

export abstract class AdapterBase implements ExchangeAdapter {
  abstract readonly name: ExchangeName;
  readonly mode: MarketMode;
  protected status: ConnectionStatus = "DISCONNECTED";
  protected symbols: TradingSymbol[] = [];
  protected lastMessageAt?: number;
  protected error?: string;
  private readonly quoteCallbacks: Array<(quote: BestQuote) => void> = [];
  private readonly orderBookCallbacks: Array<(orderBook: NormalizedOrderBook) => void> = [];

  protected constructor(mode: MarketMode) {
    this.mode = mode;
  }

  abstract connect(symbols: TradingSymbol[]): Promise<void>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.status === "CONNECTED";
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
    this.orderBookCallbacks.forEach((callback) => callback(orderBook));
    const bestBid = orderBook.bids[0];
    const bestAsk = orderBook.asks[0];
    if (!bestBid || !bestAsk) {
      return;
    }

    const quote: BestQuote = {
      exchange: orderBook.exchange,
      symbol: orderBook.symbol,
      bidPrice: bestBid.price,
      bidQty: bestBid.quantity,
      askPrice: bestAsk.price,
      askQty: bestAsk.quantity,
      exchangeTimestamp: orderBook.exchangeTimestamp,
      backendReceivedAt: orderBook.backendReceivedAt,
      normalizedAt: orderBook.normalizedAt,
      latencyMs: orderBook.backendReceivedAt - orderBook.exchangeTimestamp
    };
    this.quoteCallbacks.forEach((callback) => callback(quote));
  }

  protected setError(error: unknown) {
    this.status = "ERROR";
    this.error = error instanceof Error ? error.message : String(error);
  }
}
