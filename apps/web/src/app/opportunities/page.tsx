"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Search, X } from "lucide-react";
import type { ArbitrageOpportunity, OpportunityStatus, TradingSymbol } from "@arbix/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OpportunityFeed } from "@/components/dashboard/opportunity-feed";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { RejectionChecklist } from "@/components/risk/rejection-checklist";
import { currency, ms, percent } from "@/lib/formatters";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { useUiStore } from "@/store/ui.store";

type StatusFilter = "ALL" | OpportunityStatus;
type SymbolFilter = "ALL" | TradingSymbol;

const STATUS_TONE = {
  EXECUTED: "success",
  REJECTED: "danger",
  WATCHING: "info",
  EXPIRED: "neutral"
} as const;

export default function OpportunitiesPage() {
  const { opportunities, selectedId } = useOpportunitiesStore();
  const { symbolFilter } = useMarketStore();
  const hydrated = useUiStore((state) => state.hydrated);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const symbolFiltered: SymbolFilter = symbolFilter;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return opportunities.filter((opportunity) => {
      const matchesStatus = statusFilter === "ALL" || opportunity.status === statusFilter;
      const matchesSymbol = symbolFiltered === "ALL" || opportunity.symbol === symbolFiltered;
      const matchesSearch =
        q === "" ||
        opportunity.buyExchange.toLowerCase().includes(q) ||
        opportunity.sellExchange.toLowerCase().includes(q) ||
        opportunity.symbol.toLowerCase().includes(q) ||
        opportunity.id.toLowerCase().includes(q) ||
        (opportunity.rejectionReason ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSymbol && matchesSearch;
    });
  }, [opportunities, statusFilter, symbolFiltered, searchQuery]);

  const exportData = useMemo(
    () =>
      filtered.map((opp) => ({
        id: opp.id,
        detectedAt: opp.detectedAt,
        symbol: opp.symbol,
        buyExchange: opp.buyExchange,
        sellExchange: opp.sellExchange,
        status: opp.status,
        buyPrice: opp.buyPrice,
        sellPrice: opp.sellPrice,
        volume: opp.volume,
        grossSpreadPercent: opp.grossSpreadPercent,
        grossProfit: opp.grossProfit,
        netProfit: opp.netProfit,
        netProfitPercent: opp.netProfitPercent,
        buyFee: opp.buyFee,
        sellFee: opp.sellFee,
        slippageCost: opp.slippageCost,
        confidence: opp.confidence,
        latencyMs: opp.latencyMs,
        rejectionReason: opp.rejectionReason ?? ""
      })),
    [filtered]
  );

  const selected = filtered.find((opportunity) => opportunity.id === selectedId) ?? filtered[0];

  const stats = useMemo(() => summarize(filtered), [filtered]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Opportunity triage"
        title="Arbitrage Opportunities"
        description="Gross opportunities are accepted only after net profitability, liquidity, latency and wallet checks."
        iconSrc="/brand/module-arbitrage.png"
        iconAlt="Arbitrage signal module icon"
      >
        <HeaderStat label="Filtered" value={stats.total} tone="teal" />
        <HeaderStat label="Avg net" value={percent(stats.avgNetPercent)} tone="success" />
        <HeaderStat label="Rejected" value={stats.rejected} tone="danger" />
        <HeaderStat label="Watching" value={stats.watching} tone="warning" />
      </PageHeader>
      {!hydrated && opportunities.length === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-20" />)}
            <Skeleton className="ml-auto h-7 w-44" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      ) : null}
      {hydrated || opportunities.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
            {(["ALL", "EXECUTED", "REJECTED", "WATCHING", "EXPIRED"] as StatusFilter[]).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
              >
                {status === "ALL" ? "All" : status}
              </Button>
            ))}
            <div className="relative ml-auto flex min-w-[180px] items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search exchange, symbol, ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <ExportButton data={exportData} filename={`arbix-opportunities-${Date.now()}`} format="csv" label="CSV" />
              <ExportButton data={exportData} filename={`arbix-opportunities-${Date.now()}`} format="json" label="JSON" />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <OpportunityFeed filter={{ status: statusFilter, symbol: symbolFiltered, searchQuery }} />
            <Card data-tour="opportunity-detail">
              <CardHeader>
                <CardTitle>Opportunity Detail</CardTitle>
                {selected ? (
                  <Badge variant={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                ) : null}
              </CardHeader>
              <CardContent>
                {!selected ? (
                  <div className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Select an opportunity from the feed</p>
                    <p className="mt-1 text-xs">Click any row to see full price breakdown, VWAP execution, cost ledger and the 8-check risk audit.</p>
                  </div>
                ) : (
                  <OpportunityDetail opportunity={selected} />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function summarize(opportunities: ArbitrageOpportunity[]) {
  const total = opportunities.length;
  const sumNetPercent = opportunities.reduce((sum, opp) => sum + opp.netProfitPercent, 0);
  const avgNetPercent = total > 0 ? sumNetPercent / total : 0;
  return {
    total,
    avgNetPercent,
    rejected: opportunities.filter((opp) => opp.status === "REJECTED").length,
    watching: opportunities.filter((opp) => opp.status === "WATCHING").length
  };
}

function OpportunityDetail({ opportunity }: { opportunity: ArbitrageOpportunity }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {opportunity.symbol}
          <span className="text-muted-foreground">Buy {opportunity.buyExchange}</span>
          <ArrowRight className="h-4 w-4" />
          <span className="text-muted-foreground">Sell {opportunity.sellExchange}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <Badge variant={opportunity.recommendation === "EXECUTE" ? "success" : opportunity.recommendation === "WATCH" ? "warning" : "danger"}>
            {opportunity.recommendation}
          </Badge>
          <Badge variant="neutral">Confidence {opportunity.confidence.toFixed(0)}%</Badge>
        </div>
        {opportunity.rejectionMessage ? (
          <p className="mt-3 text-sm text-danger">{opportunity.rejectionMessage}</p>
        ) : null}
        {opportunity.status === "EXECUTED" && (
          <div className="mt-3">
            <Button asChild size="sm" variant="outline">
              <Link href="/simulator">
                <Activity className="h-3.5 w-3.5" />
                View in Simulator
              </Link>
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Buy price" value={currency(opportunity.buyPrice)} />
        <Metric label="Sell price" value={currency(opportunity.sellPrice)} />
        <Metric label="Volume" value={opportunity.volume.toFixed(6)} />
        <Metric label="Execution buy VWAP" value={currency(opportunity.executionBuyPrice)} />
        <Metric label="Execution sell VWAP" value={currency(opportunity.executionSellPrice)} />
        <Metric label="Gross spread" value={`${currency(opportunity.grossSpread)} / ${percent(opportunity.grossSpreadPercent)}`} />
        <Metric label="Gross profit" value={currency(opportunity.grossProfit)} />
        <Metric label="Buy fee" value={currency(opportunity.buyFee)} />
        <Metric label="Sell fee" value={currency(opportunity.sellFee)} />
        <Metric label="Withdrawal fee" value={currency(opportunity.withdrawalFee)} />
        <Metric label="Slippage estimated" value={currency(opportunity.slippageCost)} />
        <Metric label="Net profit" value={`${currency(opportunity.netProfit)} / ${percent(opportunity.netProfitPercent)}`} tone={opportunity.netProfit >= 0 ? "success" : "danger"} />
        <Metric label="Detected in" value={ms(opportunity.latencyMs)} />
        <Metric label="Exchange -> backend" value={ms(opportunity.latency.exchangeToBackendMs)} />
        <Metric label="Engine processing" value={ms(opportunity.latency.processingMs ?? 0)} />
        <Metric label="Backend -> frontend" value={ms(opportunity.latency.backendToFrontendMs ?? 0)} />
        <Metric label="End-to-end total" value={ms(opportunity.latency.endToEndLatencyMs ?? 0)} />
      </div>
      <ScoreBars score={opportunity.score} />
      <RejectionChecklist opportunity={opportunity} />
    </div>
  );
}

function ScoreBars({ score }: { score: ArbitrageOpportunity["score"] }) {
  const items = [
    { label: "Profit", weight: "35%", value: normalizeScore(score.profitScore), color: "#34d399" },
    { label: "Liquidity", weight: "25%", value: normalizeScore(score.liquidityScore), color: "#60a5fa" },
    { label: "Latency", weight: "25%", value: normalizeScore(score.latencyScore), color: "#fbbf24" },
    { label: "Slippage", weight: "15%", value: normalizeScore(score.slippageScore), color: "#a78bfa" }
  ];
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
        <span>Confidence components</span>
        <span className="normal-case font-normal text-[10px]">≥ 72 = auto-execute · 45–71 = watch · &lt; 45 = reject</span>
      </div>
      <div className="mb-3 text-[10px] text-muted-foreground">Weights: profit 35% · liquidity 25% · latency 25% · slippage 15%</div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[72px_1fr_56px_36px] items-center gap-3 text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <div className="h-1.5 rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, item.value))}%`, background: item.color }}
              />
            </div>
            <span className="text-right font-medium tabular-nums">{item.value.toFixed(0)}/100</span>
            <span className="text-right text-[10px] text-muted-foreground tabular-nums">{item.weight}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeScore(value: number) {
  return value <= 1 ? value * 100 : value;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={tone === "success" ? "mt-1 font-semibold text-success" : tone === "danger" ? "mt-1 font-semibold text-danger" : "mt-1 font-semibold"}>
        {value}
      </div>
    </div>
  );
}
