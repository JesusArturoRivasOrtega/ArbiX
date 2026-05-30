"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { useUiStore } from "@/store/ui.store";
import { useWalletStore } from "@/store/wallets.store";

export function RealtimeBridge() {
  useEffect(() => {
    connectSocket();

    const hydrate = async () => {
      const [snapshots, exchanges, opportunities, wallets, analytics, risk, lastTrade] = await Promise.allSettled([
        api.marketSnapshots(),
        api.exchangeStatus(),
        api.opportunities(),
        api.wallets(),
        api.analytics(),
        api.risk(),
        api.lastTrade()
      ]);

      if (snapshots.status === "fulfilled" && Array.isArray(snapshots.value)) {
        useMarketStore.getState().setSnapshots(snapshots.value as never);
      }
      if (exchanges.status === "fulfilled" && Array.isArray(exchanges.value)) {
        useMarketStore.getState().setExchangeStatus(exchanges.value as never);
      }
      if (opportunities.status === "fulfilled" && Array.isArray(opportunities.value)) {
        useOpportunitiesStore.getState().setOpportunities(opportunities.value as never);
      }
      if (wallets.status === "fulfilled" && wallets.value) {
        useWalletStore.getState().setWallets(wallets.value as never);
      }
      if (analytics.status === "fulfilled" && analytics.value) {
        useAnalyticsStore.getState().setSummary(analytics.value as never);
      }
      if (risk.status === "fulfilled" && risk.value) {
        useAnalyticsStore.getState().setRisk(risk.value as never);
      }
      if (lastTrade.status === "fulfilled") {
        useAnalyticsStore.getState().setLastTrade((lastTrade.value ?? undefined) as never);
      }
      useUiStore.getState().setHydrated(true);
    };

    const refreshAnalytics = () => {
      api.analytics().then((summary) => useAnalyticsStore.getState().setSummary(summary as never)).catch(() => undefined);
    };
    const refreshRisk = () => {
      api.risk().then((risk) => useAnalyticsStore.getState().setRisk(risk as never)).catch(() => undefined);
    };

    void hydrate();
    window.addEventListener("arbix:refresh-analytics", refreshAnalytics);
    window.addEventListener("arbix:refresh-risk", refreshRisk);
    const interval = window.setInterval(() => {
      refreshAnalytics();
      refreshRisk();
    }, 10000);

    return () => {
      window.removeEventListener("arbix:refresh-analytics", refreshAnalytics);
      window.removeEventListener("arbix:refresh-risk", refreshRisk);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
