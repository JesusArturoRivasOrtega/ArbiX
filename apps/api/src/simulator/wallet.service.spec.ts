import { describe, expect, it, vi, beforeEach } from "vitest";
import { WalletService } from "./wallet.service.js";

const mockRealtime = { publish: vi.fn() };
const mockPersistence = {
  upsertWallet: vi.fn(),
  saveLedger: vi.fn(),
  loadWalletRecords: vi.fn().mockResolvedValue([]),
  saveReplayEvent: vi.fn(),
  saveMarketSnapshot: vi.fn(),
  saveLatencyMetric: vi.fn(),
  saveOrderBookSnapshot: vi.fn(),
  saveExchangeStatus: vi.fn(),
  saveRiskEvent: vi.fn(),
  loadRecentMarketSnapshots: vi.fn().mockResolvedValue([])
};

function makeService() {
  return new WalletService(mockRealtime as never, mockPersistence as never);
}

// Shared minimal opportunity fixture
function makeOpp(overrides: Partial<{
  buyExchange: string;
  sellExchange: string;
  symbol: string;
  executionBuyPrice: number;
  executionSellPrice: number;
  volume: number;
  buyFee: number;
  sellFee: number;
  withdrawalFee: number;
}> = {}) {
  return {
    buyExchange: "BINANCE",
    sellExchange: "KRAKEN",
    symbol: "BTC/USDT",
    executionBuyPrice: 68000,
    executionSellPrice: 68400,
    volume: 0.1,
    buyFee: 6.8,
    sellFee: 6.84,
    withdrawalFee: 0,
    ...overrides
  } as never;
}

describe("WalletService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds wallets with initial balances on construction", () => {
    const svc = makeService();
    const balances = svc.getBalances();
    expect(balances.length).toBeGreaterThan(0);
    const btcBalance = balances.find((b) => b.asset === "BTC" && b.exchange === "BINANCE");
    expect(btcBalance).toBeDefined();
    expect(btcBalance!.balance).toBeGreaterThan(0);
    const usdtBalance = balances.find((b) => b.asset === "USDT" && b.exchange === "BINANCE");
    expect(usdtBalance).toBeDefined();
    expect(usdtBalance!.balance).toBeGreaterThan(0);
  });

  it("hasBalance returns true when exchange has sufficient funds", () => {
    const svc = makeService();
    // Seed is 100_000 USDT on BINANCE
    expect(svc.hasBalance("BINANCE", "USDT", 1000)).toBe(true);
  });

  it("hasBalance returns false when balance is insufficient", () => {
    const svc = makeService();
    expect(svc.hasBalance("BINANCE", "USDT", 999_999_999)).toBe(false);
  });

  it("canSimulate returns true when both sides have sufficient balance", () => {
    const svc = makeService();
    // Buy 0.1 BTC at 68000 = 6800 USDT + 6.8 fee = 6806.8 USDT needed on BINANCE
    // Sell 0.1 BTC on KRAKEN — needs 0.1 BTC on KRAKEN
    const opp = makeOpp();
    expect(svc.canSimulate(opp)).toBe(true);
  });

  it("canSimulate returns false when buy exchange has insufficient quote balance", () => {
    const svc = makeService();
    // Request an enormous trade that exceeds seed balance
    const opp = makeOpp({ executionBuyPrice: 68000, volume: 2000, buyFee: 0 });
    expect(svc.canSimulate(opp)).toBe(false);
  });

  it("canSimulate includes withdrawal fees in required quote balance", () => {
    const svc = makeService();
    const opp = makeOpp({
      executionBuyPrice: 99990,
      volume: 1,
      buyFee: 5,
      withdrawalFee: 10
    });
    expect(svc.canSimulate(opp)).toBe(false);
  });

  it("reset restores seed balances and clears ledger", async () => {
    const svc = makeService();
    // Apply a trade first
    const opp = makeOpp();
    const trade = { id: "t1", symbol: "BTC/USDT", volume: 0.1 } as never;
    svc.applyTrade(trade, opp);
    const ledgerBefore = svc.getLedger();
    expect(ledgerBefore.length).toBeGreaterThan(0);

    // Reset
    svc.reset();
    const ledgerAfter = svc.getLedger();
    expect(ledgerAfter.length).toBe(0);

    // Balances should be back to seed
    const btc = svc.getBalances().find((b) => b.asset === "BTC" && b.exchange === "BINANCE");
    expect(btc!.balance).toBeGreaterThan(0.9); // seed is 1 BTC
  });

  it("applyTrade debits buy exchange and credits sell exchange", () => {
    const svc = makeService();
    const opp = makeOpp({ executionBuyPrice: 68000, executionSellPrice: 68400, volume: 0.1, buyFee: 6.8, sellFee: 6.84 });
    const trade = { id: "t1", symbol: "BTC/USDT", volume: 0.1 } as never;

    const btcBefore = svc.getBalances().find((b) => b.asset === "BTC" && b.exchange === "BINANCE")!.balance;
    const usdtBefore = svc.getBalances().find((b) => b.asset === "USDT" && b.exchange === "BINANCE")!.balance;

    svc.applyTrade(trade, opp);

    const btcAfter = svc.getBalances().find((b) => b.asset === "BTC" && b.exchange === "BINANCE")!.balance;
    const usdtAfter = svc.getBalances().find((b) => b.asset === "USDT" && b.exchange === "BINANCE")!.balance;

    // BINANCE gained 0.1 BTC from the buy fill
    expect(btcAfter).toBeCloseTo(btcBefore + 0.1, 5);
    // BINANCE lost (68000 * 0.1 + 6.8) = 6806.8 USDT
    expect(usdtAfter).toBeCloseTo(usdtBefore - 6806.8, 1);
  });

  it("applyTrade records withdrawal fees as a wallet debit", () => {
    const svc = makeService();
    const opp = makeOpp({ withdrawalFee: 25 });
    const trade = { id: "t1", symbol: "BTC/USDT", volume: 0.1 } as never;
    const usdtBefore = svc.getBalances().find((b) => b.asset === "USDT" && b.exchange === "BINANCE")!.balance;

    svc.applyTrade(trade, opp);

    const usdtAfter = svc.getBalances().find((b) => b.asset === "USDT" && b.exchange === "BINANCE")!.balance;
    const ledger = svc.getLedger();
    expect(usdtAfter).toBeCloseTo(usdtBefore - 6831.8, 1);
    expect(ledger.some((entry) => entry.reason === "Simulated withdrawal fee" && entry.change === -25)).toBe(true);
  });

  it("ledger records entries for each trade", () => {
    const svc = makeService();
    const opp = makeOpp();
    const trade = { id: "t1", symbol: "BTC/USDT", volume: 0.1 } as never;
    svc.applyTrade(trade, opp);

    const ledger = svc.getLedger();
    // Each trade produces 4 ledger entries (buy debit, buy credit, sell debit, sell credit)
    expect(ledger.length).toBe(4);
    expect(ledger.some((e) => e.tradeId === "t1")).toBe(true);
  });
});
