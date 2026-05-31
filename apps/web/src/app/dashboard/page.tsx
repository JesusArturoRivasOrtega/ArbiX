"use client";

import { Activity, BadgeDollarSign, CheckCircle2, Clock3, Gauge, Info, MonitorPlay, RadioTower, ShieldAlert, ShieldOff, TrendingUp, X } from "lucide-react";
import { BotStatusCard } from "@/components/dashboard/bot-status-card";
import { DemoControlPanel } from "@/components/dashboard/demo-control-panel";
import { LatencyPanel } from "@/components/dashboard/latency-panel";
import { MarketMatrix } from "@/components/dashboard/market-matrix";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OpportunityFeed } from "@/components/dashboard/opportunity-feed";
import { OpportunityHighlights } from "@/components/dashboard/opportunity-highlights";
import { PnlChart } from "@/components/dashboard/pnl-chart";
import { ValidationGuide } from "@/components/dashboard/validation-guide";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { currency, ms } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";

export default function DashboardPage() {
  const summary = useAnalyticsStore((state) => state.summary);
  const risk = useAnalyticsStore((state) => state.risk);
  const exchanges = useMarketStore((state) => state.exchanges);
  const snapshots = useMarketStore((state) => state.snapshots);
  const bot = useMarketStore((state) => state.bot);
  const bestArb = computeBestCrossExchangeSpread(snapshots);
  const connectedExchanges = exchanges.filter((item) => item.status === "CONNECTED").length;
  const showLiveBanner = bot.mode === "LIVE" && summary.executedOpportunities === 0;

  const clearBreaker = async () => {
    try {
      await api.clearCircuitBreaker();
      window.dispatchEvent(new Event("arbix:refresh-risk"));
      toast.success("Circuit breaker cleared", "Risk engine resumed. The bot is scanning again.");
    } catch {
      toast.danger("Clear failed", "Could not reach the API.");
    }
  };

  return (
    <div className="space-y-5">
      {showLiveBanner && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <div>
            <span className="font-semibold text-blue-300">LIVE mode — market efficiency at work</span>
            <p className="mt-0.5 text-muted-foreground">
              The bot is detecting real spreads but rejecting them because fees consume the divergence. This is{" "}
              <span className="font-medium text-foreground">correct behavior</span> — retail-speed bots rarely capture live arbitrage.
              Switch to <span className="font-medium text-primary">DEMO</span> or press{" "}
              <span className="font-medium text-primary">Presentation Mode</span> below to see full execution with controlled data.
            </p>
          </div>
        </div>
      )}
      {risk.circuitBreakerActive && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <ShieldOff className="h-5 w-5 shrink-0 text-danger" />
          <div className="flex-1">
            <span className="font-semibold text-danger">CIRCUIT BREAKER ACTIVE</span>
            {risk.reason ? <span className="ml-2 text-muted-foreground">{risk.reason}</span> : null}
          </div>
          <Button size="sm" variant="danger" onClick={() => void clearBreaker()}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}
      <PageHeader
        eyebrow="Real-time market intelligence"
        title="ArbiX Command Center"
        description={bot.message}
        iconSrc="/brand/arbix-platform-icon-512.png"
        iconAlt="ArbiX platform icon"
      >
        <HeaderStat label="Data mode" value={bot.mode} tone={bot.mode === "LIVE" ? "blue" : bot.mode === "REPLAY" ? "violet" : "amber"} />
        <HeaderStat label="Net P&L" value={currency(summary.totalNetProfit)} tone={summary.totalNetProfit >= 0 ? "success" : "danger"} />
        <HeaderStat label="Detection latency" value={ms(summary.averageDetectionLatencyMs)} tone="blue" />
        <HeaderStat label="Evaluated" value={summary.totalOpportunities} tone="amber" />
        <HeaderStat label="Exchanges" value={`${connectedExchanges}/${exchanges.length}`} tone="teal" />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Net P&L" value={currency(summary.totalNetProfit)} helper="Simulated cumulative profit" icon={BadgeDollarSign} tone={summary.totalNetProfit >= 0 ? "success" : "danger"} />
        <MetricCard label="Opportunities Today" value={summary.totalOpportunities.toString()} helper="Detected and evaluated" icon={TrendingUp} tone="info" />
        <MetricCard label="Executed Simulations" value={summary.executedOpportunities.toString()} helper="Risk-approved executions" icon={CheckCircle2} tone="success" />
        <MetricCard label="Rejected Opportunities" value={summary.rejectedOpportunities.toString()} helper="Avoided after costs/risk" icon={ShieldAlert} tone="warning" />
        <MetricCard
          label="Current Best Arb Spread"
          value={currency(bestArb.spread)}
          helper={bestArb.spread > 0 ? `${bestArb.symbol} ${bestArb.buyExchange} -> ${bestArb.sellExchange}` : "No cross-exchange divergence"}
          icon={Gauge}
          tone={bestArb.spread > 0 ? "info" : "default"}
        />
        <MetricCard label="Avg Detection Latency" value={ms(summary.averageDetectionLatencyMs)} helper="Backend detection speed" icon={Clock3} />
        <MetricCard label="Active Exchanges" value={`${exchanges.filter((item) => item.status === "CONNECTED").length}/${exchanges.length}`} helper="Public market streams" icon={RadioTower} tone="success" />
        <MetricCard
          label="Notional Traded"
          value={currency(
            // Each executed trade appears on TWO exchange entries (buy + sell side),
            // so divide by 2 to get actual capital deployed per trade.
            summary.volumeByExchange.reduce((sum, item) => sum + item.notional, 0) / 2
          )}
          helper={
            summary.volumeByPair.length > 0
              ? summary.volumeByPair.map((p) => `${p.volume.toFixed(4)} ${p.symbol.split("/")[0]}`).join(" · ")
              : "Capital deployed across simulated trades"
          }
          icon={Activity}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <BotStatusCard />
        <OpportunityFeed compact />
      </div>
      {summary.totalOpportunities === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/8 px-4 py-3 text-sm">
          <MonitorPlay className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <span className="font-semibold text-foreground">Ready to demo</span>
            <span className="ml-2 text-muted-foreground">Hit <span className="font-semibold text-primary">Presentation Mode</span> below to reset state and start a profitable arbitrage scenario instantly.</span>
          </div>
        </div>
      )}
      <DemoControlPanel />
      <ValidationGuide />
      <OpportunityHighlights />
      <MarketMatrix />
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <PnlChart />
        <LatencyPanel />
      </div>
    </div>
  );
}

function computeBestCrossExchangeSpread(snapshots: ReturnType<typeof useMarketStore.getState>["snapshots"]) {
  let best: { symbol: string; buyExchange: string; sellExchange: string; spread: number } = {
    symbol: "",
    buyExchange: "",
    sellExchange: "",
    spread: 0
  };
  const bySymbol = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const existing = bySymbol.get(snapshot.symbol) ?? [];
    existing.push(snapshot);
    bySymbol.set(snapshot.symbol, existing);
  }
  for (const [symbol, rows] of bySymbol) {
    for (const buy of rows) {
      for (const sell of rows) {
        if (buy.exchange === sell.exchange) continue;
        const spread = sell.bidPrice - buy.askPrice;
        if (spread > best.spread) {
          best = { symbol, buyExchange: buy.exchange, sellExchange: sell.exchange, spread };
        }
      }
    }
  }
  return best;
}
