import { Injectable } from "@nestjs/common";
import type { BestQuote, ExchangeName, MarketSnapshot, NormalizedOrderBook, OrderBookDepthSnapshot, TradingSymbol } from "@arbix/shared";

@Injectable()
export class OrderBookStore {
  private readonly orderBooks = new Map<string, NormalizedOrderBook>();
  private readonly quotes = new Map<string, BestQuote>();

  upsertOrderBook(orderBook: NormalizedOrderBook) {
    this.orderBooks.set(this.key(orderBook.exchange, orderBook.symbol), orderBook);
  }

  upsertQuote(quote: BestQuote) {
    this.quotes.set(this.key(quote.exchange, quote.symbol), quote);
  }

  getOrderBook(exchange: ExchangeName, symbol: TradingSymbol) {
    return this.orderBooks.get(this.key(exchange, symbol));
  }

  getQuote(exchange: ExchangeName, symbol: TradingSymbol) {
    return this.quotes.get(this.key(exchange, symbol));
  }

  getQuotesBySymbol(symbol: TradingSymbol): BestQuote[] {
    return [...this.quotes.values()].filter((quote) => quote.symbol === symbol);
  }

  getSnapshots(staleThresholdMs = 3000): MarketSnapshot[] {
    const now = Date.now();
    return [...this.quotes.values()].map((quote) => ({
      ...quote,
      spread: quote.askPrice - quote.bidPrice,
      liquidity: quote.bidQty + quote.askQty,
      status: now - quote.normalizedAt > staleThresholdMs ? "STALE" : "CONNECTED",
      lastUpdate: new Date(quote.normalizedAt).toISOString()
    }));
  }

  getOrderBookSnapshots(): OrderBookDepthSnapshot[] {
    const now = Date.now();
    return [...this.orderBooks.values()].map((book) => ({
      exchange: book.exchange,
      symbol: book.symbol,
      bids: book.bids,
      asks: book.asks,
      exchangeTimestamp: book.exchangeTimestamp,
      normalizedAt: book.normalizedAt,
      ageMs: now - book.normalizedAt
    }));
  }

  clear() {
    this.orderBooks.clear();
    this.quotes.clear();
  }

  private key(exchange: ExchangeName, symbol: TradingSymbol) {
    return `${exchange}:${symbol}`;
  }
}
