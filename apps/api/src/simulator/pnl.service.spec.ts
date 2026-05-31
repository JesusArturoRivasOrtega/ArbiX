import { describe, expect, it, vi } from "vitest";
import type { SimulatedTrade } from "@arbix/shared";
import { PnlService } from "./pnl.service.js";

function tradeFixture(netProfit: number): SimulatedTrade {
  return {
    id: `trade_${netProfit}`,
    opportunityId: "opp_1",
    symbol: "BTC/USDT",
    buyExchange: "BINANCE",
    sellExchange: "KRAKEN",
    volume: 0.1,
    requestedVolume: 0.1,
    buyCost: 6800,
    sellRevenue: 6830,
    grossProfit: 30,
    totalFees: 13.6,
    withdrawalFee: 0,
    slippageCost: 1,
    netProfit,
    status: "SIMULATED",
    timeline: [],
    createdAt: new Date().toISOString()
  };
}

function makePersistence(trades: SimulatedTrade[] = []) {
  return {
    loadRecentTrades: vi.fn(async () => trades),
    clearSimulationHistory: vi.fn(),
    saveTrade: vi.fn(),
    saveOpportunity: vi.fn()
  };
}

describe("PnlService persistence recovery", () => {
  it("restores persisted trades on module init so P&L survives a restart", async () => {
    const persisted = [tradeFixture(10), tradeFixture(5)];
    const persistence = makePersistence(persisted);
    const pnl = new PnlService(persistence as never);

    await pnl.onModuleInit();

    expect(pnl.getTrades()).toHaveLength(2);
    expect(pnl.getTotals().netProfit).toBeCloseTo(15);
    expect(persistence.loadRecentTrades).toHaveBeenCalled();
  });

  it("starts empty when persistence has no trades", async () => {
    const persistence = makePersistence([]);
    const pnl = new PnlService(persistence as never);

    await pnl.onModuleInit();

    expect(pnl.getTrades()).toHaveLength(0);
    expect(pnl.getTotals().netProfit).toBe(0);
  });

  it("wipes persisted history on reset so a restart after reset stays clean", () => {
    const persistence = makePersistence([tradeFixture(10)]);
    const pnl = new PnlService(persistence as never);

    pnl.reset();

    expect(persistence.clearSimulationHistory).toHaveBeenCalled();
    expect(pnl.getTrades()).toHaveLength(0);
  });
});
