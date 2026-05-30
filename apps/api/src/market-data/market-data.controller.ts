import { Controller, Get, Post, Param, NotFoundException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ExchangeName, OrderBookDepthSnapshot, TradingSymbol } from "@arbix/shared";
import { MarketDataService } from "./market-data.service.js";
import { OrderBookStore } from "./order-book.store.js";

@ApiTags("market")
@Controller()
export class MarketDataController {
  constructor(
    private readonly marketData: MarketDataService,
    private readonly orderBookStore: OrderBookStore
  ) {}

  @Get("exchanges/status")
  getExchangeStatus() {
    return this.marketData.getExchangeStatus();
  }

  @Get("market/snapshots")
  getSnapshots() {
    return this.marketData.getSnapshots();
  }

  @Get("market/orderbooks")
  getOrderbooks(): OrderBookDepthSnapshot[] {
    return this.orderBookStore.getOrderBookSnapshots();
  }

  @Get("market/orderbook/:exchange/:base/:quote")
  getOrderbook(
    @Param("exchange") exchange: string,
    @Param("base") base: string,
    @Param("quote") quote: string
  ): OrderBookDepthSnapshot {
    const symbol = `${base}/${quote}` as TradingSymbol;
    const book = this.orderBookStore.getOrderBook(exchange.toUpperCase() as ExchangeName, symbol);
    if (!book) {
      throw new NotFoundException(`No order book for ${exchange} ${symbol}`);
    }
    return {
      exchange: book.exchange,
      symbol: book.symbol,
      bids: book.bids,
      asks: book.asks,
      exchangeTimestamp: book.exchangeTimestamp,
      normalizedAt: book.normalizedAt,
      ageMs: Date.now() - book.normalizedAt
    };
  }

  @Post("bot/start")
  startBot() {
    return this.marketData.start();
  }

  @Post("bot/stop")
  stopBot() {
    return this.marketData.stop();
  }

  @Post("bot/pause")
  pauseBot() {
    return this.marketData.pause();
  }

  @Post("bot/reset")
  resetBot() {
    return this.marketData.reset();
  }

  @Post("replay/start")
  startReplay() {
    return this.marketData.runScenario("profitable");
  }

  @Post("replay/scenario/:scenarioName")
  startScenario(@Param("scenarioName") scenarioName: string) {
    return this.marketData.runScenario(scenarioName);
  }
}
