import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MockExchangeAdapter } from "./adapters/mock-exchange.adapter.js";

describe("MockExchangeAdapter — demo scenarios", () => {
  let adapter: MockExchangeAdapter;
  const emittedOrderBooks: unknown[] = [];

  beforeEach(async () => {
    adapter = new MockExchangeAdapter("BINANCE");
    adapter.onOrderBook((ob) => emittedOrderBooks.push(ob));
    adapter.onQuote(() => undefined); // suppress quote events
    emittedOrderBooks.length = 0;
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await adapter.disconnect();
    vi.useRealTimers();
  });

  it("connects and immediately publishes order books for each symbol", async () => {
    await adapter.connect(["BTC/USDT", "ETH/USDT"]);
    // Initial tick fires synchronously on connect
    expect(emittedOrderBooks.length).toBeGreaterThanOrEqual(2);
  });

  it("profitable scenario generates a significant BTC spread on BINANCE (asks lower)", async () => {
    adapter.setScenario("profitable");
    await adapter.connect(["BTC/USDT"]);

    // With profitable scenario active, BINANCE mid drops by ~180
    const btcBook = emittedOrderBooks.find(
      (ob: unknown) => (ob as { symbol: string }).symbol === "BTC/USDT"
    ) as { asks: Array<{ price: number }>; symbol: string } | undefined;

    expect(btcBook).toBeDefined();
    // BINANCE asks should be below the neutral base price (68250)
    expect(btcBook!.asks[0]!.price).toBeLessThan(68200);
  });

  it("liquidity scenario caps order book depth on OKX/KRAKEN adapters", async () => {
    // The liquidity cap only applies to OKX and KRAKEN (not BINANCE)
    const okxAdapter = new MockExchangeAdapter("OKX");
    const okxBooks: Array<{ asks: Array<{ quantity: number }> }> = [];
    okxAdapter.onOrderBook((ob) => okxBooks.push(ob as never));
    okxAdapter.onQuote(() => undefined);

    okxAdapter.setScenario("liquidity");
    await okxAdapter.connect(["BTC/USDT"]);

    const btcBook = okxBooks.find(() => true);
    expect(btcBook).toBeDefined();
    // All ask quantities should be capped to ≤ 0.035
    btcBook!.asks.forEach((level) => {
      expect(level.quantity).toBeLessThanOrEqual(0.035 + 1e-9);
    });

    await okxAdapter.disconnect();
  });

  it("fees scenario generates ETH/USDT order books", async () => {
    adapter.setScenario("fees");
    await adapter.connect(["ETH/USDT"]);

    const ethBook = emittedOrderBooks.find(
      (ob: unknown) => (ob as { symbol: string }).symbol === "ETH/USDT"
    );
    expect(ethBook).toBeDefined();
  });

  it("latency scenario injects high latency into KRAKEN adapter", async () => {
    const krakenAdapter = new MockExchangeAdapter("KRAKEN");
    const books: Array<{ exchange: string; exchangeTimestamp: number; backendReceivedAt: number }> = [];
    krakenAdapter.onOrderBook((ob) => books.push(ob as never));
    krakenAdapter.onQuote(() => undefined);

    krakenAdapter.setScenario("latency");
    await krakenAdapter.connect(["BTC/USDT"]);

    const book = books.find((b) => b.exchange === "KRAKEN");
    expect(book).toBeDefined();
    // Latency scenario sets offset to 1500ms for KRAKEN
    const latencyMs = book!.backendReceivedAt - book!.exchangeTimestamp;
    expect(latencyMs).toBeGreaterThanOrEqual(1400);

    await krakenAdapter.disconnect();
  });

  it("adapter status is CONNECTED after connect and DISCONNECTED after disconnect", async () => {
    await adapter.connect(["BTC/USDT"]);
    expect(adapter.getStatus().status).toBe("CONNECTED");

    await adapter.disconnect();
    expect(adapter.getStatus().status).toBe("DISCONNECTED");
  });

  it("publishes new order books on each tick interval", async () => {
    await adapter.connect(["BTC/USDT"]);
    const countAfterConnect = emittedOrderBooks.length;

    vi.advanceTimersByTime(900); // one tick
    expect(emittedOrderBooks.length).toBeGreaterThan(countAfterConnect);
  });

  it("does not publish after disconnect", async () => {
    await adapter.connect(["BTC/USDT"]);
    await adapter.disconnect();
    const countAtDisconnect = emittedOrderBooks.length;

    vi.advanceTimersByTime(2000);
    expect(emittedOrderBooks.length).toBe(countAtDisconnect);
  });
});
