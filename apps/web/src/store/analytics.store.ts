"use client";

import { create } from "zustand";
import type { AnalyticsSummary, RiskStatus, SimulatedTrade } from "@arbix/shared";
import { demoAnalytics, demoRisk, demoTrade } from "@/lib/demo-data";

type AnalyticsStore = {
  summary: AnalyticsSummary;
  risk: RiskStatus;
  lastTrade: SimulatedTrade | undefined;
  setSummary: (summary: AnalyticsSummary) => void;
  setRisk: (risk: RiskStatus) => void;
  setLastTrade: (trade?: SimulatedTrade) => void;
};

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  summary: demoAnalytics,
  risk: demoRisk,
  lastTrade: demoTrade,
  setSummary: (summary) => set({ summary }),
  setRisk: (risk) => set({ risk }),
  setLastTrade: (lastTrade) => set({ lastTrade })
}));
