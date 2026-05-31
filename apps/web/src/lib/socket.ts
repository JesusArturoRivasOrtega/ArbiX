"use client";

import { io, type Socket } from "socket.io-client";
import type {
  AnalyticsSummary,
  ArbitrageOpportunity,
  BestQuote,
  ExchangeConnectionStatus,
  RiskStatus,
  SimulatedTrade,
  WalletBalance,
  WalletLedgerEntry
} from "@arbix/shared";
import { toast } from "@/components/ui/toast";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { useUiStore } from "@/store/ui.store";
import { useWalletStore } from "@/store/wallets.store";

let socket: Socket | undefined;

export function connectSocket() {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";
  socket = io(url, {
    transports: ["websocket"],
    reconnection: true
  });

  socket.on("connect", () => {
    useMarketStore.getState().setBot({
      connected: true,
      message: "ArbiX realtime channel connected."
    });
    (window as unknown as Record<string, unknown>)["__arbix_socket_connected__"] = true;
    // Defer so the dispatch never fires synchronously inside a React render cycle
    setTimeout(() => window.dispatchEvent(new Event("arbix:socket-status")), 0);
  });

  socket.on("disconnect", () => {
    useMarketStore.getState().setBot({
      connected: false,
      message: "Frontend connection to backend is temporarily unavailable."
    });
    (window as unknown as Record<string, unknown>)["__arbix_socket_connected__"] = false;
    setTimeout(() => window.dispatchEvent(new Event("arbix:socket-status")), 0);
  });

  socket.on("bot.status.updated", (payload: { status?: never; mode?: never; message?: string }) => {
    useMarketStore.getState().setBot(payload as never);
  });

  // Batch quote updates — deduplicate by exchange:symbol, flush every 150ms
  const quotePending = new Map<string, BestQuote>();
  let quoteFlushPending = false;
  socket.on("market.quote.updated", (quote: BestQuote) => {
    quotePending.set(`${quote.exchange}:${quote.symbol}`, quote);
    if (!quoteFlushPending) {
      quoteFlushPending = true;
      setTimeout(() => {
        quoteFlushPending = false;
        const store = useMarketStore.getState();
        for (const q of quotePending.values()) store.upsertQuote(q);
        quotePending.clear();
      }, 150);
    }
  });

  socket.on("exchanges.status.updated", (exchanges: ExchangeConnectionStatus[]) => {
    useMarketStore.getState().setExchangeStatus(exchanges);
  });

  socket.on("opportunity.detected", (opportunity: ArbitrageOpportunity) => {
    const enriched = withFrontendLatency(opportunity);
    useOpportunitiesStore.getState().upsertOpportunity(enriched);
    socket?.emit("latency.ack", {
      opportunityId: enriched.id,
      exchange: enriched.buyExchange,
      symbol: enriched.symbol,
      latency: enriched.latency
    });
  });

  socket.on("opportunity.rejected", (opportunity: ArbitrageOpportunity) => {
    useOpportunitiesStore.getState().upsertOpportunity(withFrontendLatency(opportunity));
  });

  socket.on("opportunity.executed", (opportunity: ArbitrageOpportunity) => {
    useOpportunitiesStore.getState().upsertOpportunity(withFrontendLatency(opportunity));
  });

  socket.on("opportunities.updated", (opportunities: ArbitrageOpportunity[]) => {
    useOpportunitiesStore.getState().setOpportunities(opportunities.map(withFrontendLatency));
  });

  socket.on("trade.simulated", (trade: SimulatedTrade) => {
    useAnalyticsStore.getState().setLastTrade(trade);
    const profit = trade.netProfit;
    const direction = `${trade.symbol} - ${trade.buyExchange} -> ${trade.sellExchange}`;
    const isPartial = (trade.requestedVolume ?? trade.volume) > trade.volume + 1e-9;
    if (isPartial) {
      toast.warning(
        `Partial fill: ${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}`,
        `${direction} - ${trade.volume.toFixed(4)}/${(trade.requestedVolume ?? trade.volume).toFixed(4)} executed`
      );
    } else if (profit >= 0) {
      toast.success(`Trade executed: +$${profit.toFixed(2)}`, direction);
    } else {
      toast.danger(`Trade executed: $${profit.toFixed(2)}`, direction);
    }
  });

  socket.on("wallet.updated", (balances: WalletBalance[] | { balances: WalletBalance[]; ledger: WalletLedgerEntry[] }) => {
    if (Array.isArray(balances)) {
      useWalletStore.getState().setWallets({ balances, ledger: useWalletStore.getState().ledger });
      return;
    }
    useWalletStore.getState().setWallets(balances);
  });

  // pnl.updated fires immediately after each trade is simulated.
  // The RealtimeBroadcaster responds with a full analytics.updated push
  // (triggered by PnlService.onTradeRecorded callback), so we no longer
  // need a separate REST round-trip here. We still dispatch the event
  // for any other listeners that may depend on it (e.g. risk refresh).
  socket.on("pnl.updated", () => {
    // analytics.updated will arrive from the broadcaster within milliseconds.
    // Dispatch risk refresh only (analytics handled by analytics.updated handler).
    window.dispatchEvent(new Event("arbix:refresh-risk"));
  });

  socket.on("risk.circuit_breaker.triggered", (event: { message?: string }) => {
    window.dispatchEvent(new Event("arbix:refresh-risk"));
    toast.warning("Circuit breaker triggered", event?.message ?? "Simulated execution paused.");
  });

  // Throttle analytics updates to at most once per 800ms
  let analyticsThrottleTimer: number | null = null;
  let pendingAnalytics: AnalyticsSummary | null = null;
  socket.on("analytics.updated", (summary: AnalyticsSummary) => {
    pendingAnalytics = summary;
    if (!analyticsThrottleTimer) {
      analyticsThrottleTimer = window.setTimeout(() => {
        analyticsThrottleTimer = null;
        if (pendingAnalytics) {
          useAnalyticsStore.getState().setSummary(pendingAnalytics);
          pendingAnalytics = null;
        }
      }, 800);
    }
  });

  socket.on("risk.status.updated", (risk: RiskStatus) => {
    useAnalyticsStore.getState().setRisk(risk);
  });

  socket.on("risk.circuit_breaker.cleared", () => {
    window.dispatchEvent(new Event("arbix:refresh-risk"));
    toast.success("Circuit breaker cleared", "Simulated execution available again.");
  });

  socket.on("replay.started", (payload: { scenario?: string; message?: string; fallback?: boolean }) => {
    useUiStore.getState().setActiveReplay(payload?.scenario ?? "scenario");
    if (payload?.fallback) {
      toast.warning("Replay fallback", payload.message ?? "Buffer empty - showing a synthetic scenario instead.");
    } else if (payload?.message) {
      toast.info("Replay started", payload.message);
    }
  });

  socket.on("replay.finished", () => {
    useUiStore.getState().setActiveReplay(null);
    toast.info("Replay finished", "Mock adapter returned to neutral scenario.");
  });

  return socket;
}

function withFrontendLatency(opportunity: ArbitrageOpportunity): ArbitrageOpportunity {
  const frontendReceivedAt = Date.now();
  const backendToFrontendMs = Math.max(0, frontendReceivedAt - opportunity.latency.emittedToFrontendAt);
  const endToEndLatencyMs = Math.max(0, frontendReceivedAt - opportunity.latency.exchangeTimestamp);
  return {
    ...opportunity,
    latency: {
      ...opportunity.latency,
      frontendReceivedAt,
      backendToFrontendMs,
      endToEndLatencyMs
    }
  };
}
