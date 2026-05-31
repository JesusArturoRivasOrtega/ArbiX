"use client";

import { create } from "zustand";
import type { AnalyticsSummary, RiskStatus, SimulatedTrade } from "@arbix/shared";

type AnalyticsStore = {
  summary: AnalyticsSummary;
  risk: RiskStatus;
  lastTrade: SimulatedTrade | undefined;
  setSummary: (summary: AnalyticsSummary) => void;
  setRisk: (risk: RiskStatus) => void;
  setLastTrade: (trade?: SimulatedTrade) => void;
};

const emptySummary: AnalyticsSummary = {
  totalOpportunities: 0,
  executedOpportunities: 0,
  rejectedOpportunities: 0,
  expiredOpportunities: 0,
  totalGrossProfit: 0,
  totalNetProfit: 0,
  totalFeesPaid: 0,
  totalSlippageCost: 0,
  averageDetectionLatencyMs: 0,
  cumulativePnl: [],
  opportunitiesOverTime: [],
  rejectionReasons: [],
  latencyByExchange: [],
  volumeByPair: [],
  volumeByExchange: []
};

const emptyRisk: RiskStatus = {
  circuitBreakerActive: false,
  currentRiskLevel: "LOW",
  currentHighestLatencyMs: 0,
  config: {
    minNetProfitPercent: 0.05,
    maxTradeSize: 0.25,
    maxLatencyMs: 1000,
    maxOrderBookAgeMs: 3000,
    maxSlippagePercent: 0.1,
    allowPartialFills: true,
    autoSimulationEnabled: true,
    circuitBreakerEnabled: true,
    maxRejectedOpportunitiesPerMinute: 1000,
    maxNegativePnLBeforeStop: -250,
    minLiquidityScore: 40
  }
};

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  summary: emptySummary,
  risk: emptyRisk,
  lastTrade: undefined,
  setSummary: (summary) => set({ summary }),
  setRisk: (risk) => set({ risk }),
  setLastTrade: (lastTrade) => set({ lastTrade })
}));
