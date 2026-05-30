import { describe, it, expect, beforeEach } from "vitest";
import { useOpportunitiesStore } from "./opportunities.store";
import type { ArbitrageOpportunity } from "@arbix/shared";

function makeOpp(id: string, status: ArbitrageOpportunity["status"] = "WATCHING"): ArbitrageOpportunity {
  return {
    id,
    symbol: "BTC/USDT",
    buyExchange: "BINANCE",
    sellExchange: "KRAKEN",
    buyPrice: 68000,
    sellPrice: 68400,
    executionBuyPrice: 68010,
    executionSellPrice: 68390,
    volume: 0.1,
    requestedVolume: 0.1,
    grossSpread: 400,
    grossSpreadPercent: 0.588,
    grossProfit: 40,
    netProfit: 25,
    netProfitPercent: 0.037,
    buyFee: 6.8,
    sellFee: 6.84,
    withdrawalFee: 0,
    slippageCost: 1.36,
    latencyMs: 45,
    confidence: 85,
    status,
    recommendation: "EXECUTE",
    detectedAt: new Date().toISOString(),
    latency: {
      exchangeTimestamp: Date.now() - 100,
      backendReceivedAt: Date.now() - 80,
      normalizedAt: Date.now() - 70,
      detectedAt: Date.now() - 50,
      emittedToFrontendAt: Date.now() - 20,
      exchangeToBackendMs: 20,
      normalizationMs: 10,
      detectionLatencyMs: 20
    },
    score: {
      profitScore: 85,
      liquidityScore: 90,
      latencyScore: 95,
      slippageScore: 88,
      riskPenalty: 0,
      confidence: 85,
      recommendation: "EXECUTE"
    }
  };
}

describe("opportunities.store", () => {
  beforeEach(() => {
    useOpportunitiesStore.setState({
      opportunities: [],
      selectedId: undefined,
      freshIds: {}
    });
  });

  it("starts with empty opportunities", () => {
    expect(useOpportunitiesStore.getState().opportunities).toHaveLength(0);
  });

  it("setOpportunities replaces the list", () => {
    const opps = [makeOpp("1"), makeOpp("2")];
    useOpportunitiesStore.getState().setOpportunities(opps);
    expect(useOpportunitiesStore.getState().opportunities).toHaveLength(2);
  });

  it("upsertOpportunity inserts new opportunity at the front", () => {
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("first"));
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("second"));
    const opps = useOpportunitiesStore.getState().opportunities;
    expect(opps[0]!.id).toBe("second");
    expect(opps[1]!.id).toBe("first");
  });

  it("upsertOpportunity updates existing opportunity in place", () => {
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("x", "WATCHING"));
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("x", "EXECUTED"));
    const opps = useOpportunitiesStore.getState().opportunities;
    expect(opps).toHaveLength(1);
    expect(opps[0]!.status).toBe("EXECUTED");
  });

  it("freshIds records the timestamp when opportunity is upserted", () => {
    const before = Date.now();
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("fresh"));
    const ts = useOpportunitiesStore.getState().freshIds["fresh"];
    expect(ts).toBeGreaterThanOrEqual(before);
  });

  it("select sets selectedId", () => {
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("sel"));
    useOpportunitiesStore.getState().select("sel");
    expect(useOpportunitiesStore.getState().selectedId).toBe("sel");
  });

  it("markStale removes entry from freshIds", () => {
    useOpportunitiesStore.getState().upsertOpportunity(makeOpp("stale-test"));
    expect(useOpportunitiesStore.getState().freshIds["stale-test"]).toBeDefined();
    useOpportunitiesStore.getState().markStale("stale-test");
    expect(useOpportunitiesStore.getState().freshIds["stale-test"]).toBeUndefined();
  });

  it("caps list at 60 opportunities", () => {
    for (let i = 0; i < 70; i++) {
      useOpportunitiesStore.getState().upsertOpportunity(makeOpp(`opp-${i}`));
    }
    expect(useOpportunitiesStore.getState().opportunities.length).toBeLessThanOrEqual(60);
  });
});
