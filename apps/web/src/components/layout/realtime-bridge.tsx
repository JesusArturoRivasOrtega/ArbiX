"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { useUiStore } from "@/store/ui.store";
import { useWalletStore } from "@/store/wallets.store";
import { hydrateFromStorage } from "@/store/tutorial.store";

export function RealtimeBridge() {
  useEffect(() => {
    connectSocket();

    hydrateFromStorage();

    const hydrate = async () => {
      useUiStore.getState().setHydrationStatus("loading");
      const results = await Promise.allSettled([
        api.marketSnapshots(),
        api.exchangeStatus(),
        api.opportunities(),
        api.wallets(),
        api.analytics(),
        api.risk(),
        api.lastTrade()
      ]);
      const [snapshots, exchanges, opportunities, wallets, analytics, risk, lastTrade] = results;

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

      const failedCritical = results.slice(0, 6).filter((result) => result.status === "rejected");
      if (failedCritical.length === 0) {
        useUiStore.getState().setHydrationStatus("ready");
      } else if (failedCritical.length === 6) {
        useUiStore.getState().setHydrationStatus("failed", "Backend data could not be hydrated.");
      } else {
        useUiStore.getState().setHydrationStatus("partial", `${failedCritical.length} backend request(s) failed during hydration.`);
      }
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
