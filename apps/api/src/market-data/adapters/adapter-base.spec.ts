import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingSymbol } from "@arbix/shared";
import { AdapterBase } from "./adapter-base.js";

/**
 * Concrete test double that drives the reconnection lifecycle exposed by
 * AdapterBase without opening a real WebSocket. `drop()` simulates the socket
 * "close" event firing unexpectedly.
 */
class TestAdapter extends AdapterBase {
  readonly name = "BINANCE" as const;
  connectCalls = 0;
  shouldFail = false;

  constructor() {
    super("LIVE");
  }

  async connect(symbols: TradingSymbol[]) {
    this.beginConnection();
    this.symbols = symbols;
    this.connectCalls += 1;
    if (this.shouldFail) throw new Error("connect failed");
    this.onConnected();
  }

  async disconnect() {
    this.markManualDisconnect();
    this.status = "DISCONNECTED";
  }

  /** Simulate an unexpected socket close (what each adapter wires to onDisconnected). */
  drop() {
    this.onDisconnected();
  }
}

describe("AdapterBase reconnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks CONNECTED on a successful connect", async () => {
    const adapter = new TestAdapter();
    await adapter.connect(["BTC/USDT"]);
    expect(adapter.isConnected()).toBe(true);
    expect(adapter.connectCalls).toBe(1);
  });

  it("auto-reconnects after an unexpected drop", async () => {
    const adapter = new TestAdapter();
    await adapter.connect(["BTC/USDT"]);

    adapter.drop(); // schedules a reconnect at the 1s base delay
    expect(adapter.connectCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.connectCalls).toBe(2);
    expect(adapter.isConnected()).toBe(true);
  });

  it("backs off exponentially across consecutive failures", async () => {
    const adapter = new TestAdapter();
    await adapter.connect(["BTC/USDT"]); // calls = 1, connected
    adapter.shouldFail = true;

    adapter.drop(); // attempt 0 -> retry in 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.connectCalls).toBe(2); // retried, failed -> attempt 1 -> retry in 2000ms

    await vi.advanceTimersByTimeAsync(1000); // only 1000 of the needed 2000 elapsed
    expect(adapter.connectCalls).toBe(2);

    await vi.advanceTimersByTimeAsync(1000); // now 2000ms elapsed
    expect(adapter.connectCalls).toBe(3); // retried, failed -> attempt 2 -> retry in 4000ms

    await vi.advanceTimersByTimeAsync(4000);
    expect(adapter.connectCalls).toBe(4);
  });

  it("resets the backoff after a recovery", async () => {
    const adapter = new TestAdapter();
    await adapter.connect(["BTC/USDT"]);

    adapter.shouldFail = true;
    adapter.drop();
    await vi.advanceTimersByTimeAsync(1000); // failed reconnect -> backoff grows
    await vi.advanceTimersByTimeAsync(2000); // failed reconnect again

    adapter.shouldFail = false;
    await vi.advanceTimersByTimeAsync(4000); // this one succeeds, attempts reset to 0
    expect(adapter.isConnected()).toBe(true);

    const callsBeforeFinalDrop = adapter.connectCalls;
    adapter.drop(); // should schedule at the 1s base delay again, not the grown one
    await vi.advanceTimersByTimeAsync(1000);
    expect(adapter.connectCalls).toBe(callsBeforeFinalDrop + 1);
  });

  it("does not reconnect after an intentional disconnect()", async () => {
    const adapter = new TestAdapter();
    await adapter.connect(["BTC/USDT"]);

    adapter.drop(); // schedule a reconnect...
    await adapter.disconnect(); // ...then tear down on purpose

    await vi.advanceTimersByTimeAsync(30_000);
    expect(adapter.connectCalls).toBe(1); // the scheduled reconnect was cancelled
    expect(adapter.isConnected()).toBe(false);
  });
});
