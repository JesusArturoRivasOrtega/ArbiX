"use client";

import { memo, useEffect, type CSSProperties } from "react";
import { ArrowRight, ShieldCheck, TriangleAlert } from "lucide-react";
import type { ArbitrageOpportunity, OpportunityStatus, TradingSymbol } from "@arbix/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, ms, percent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useOpportunitiesStore } from "@/store/opportunities.store";

type FeedFilter = {
  status?: OpportunityStatus | "ALL";
  symbol?: TradingSymbol | "ALL";
};

const FRESH_WINDOW_MS = 1200;

export function OpportunityFeed({ compact = false, filter }: { compact?: boolean; filter?: FeedFilter }) {
  const { opportunities, select, selectedId, freshIds, markStale } = useOpportunitiesStore();

  useEffect(() => {
    const ids = Object.keys(freshIds);
    if (ids.length === 0) return;
    const timers = ids.map((id) => {
      const elapsed = Date.now() - (freshIds[id] ?? 0);
      const remaining = Math.max(0, FRESH_WINDOW_MS - elapsed);
      return window.setTimeout(() => markStale(id), remaining);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [freshIds, markStale]);

  const filtered = opportunities.filter((opportunity) => {
    if (filter?.status && filter.status !== "ALL" && opportunity.status !== filter.status) return false;
    if (filter?.symbol && filter.symbol !== "ALL" && opportunity.symbol !== filter.symbol) return false;
    return true;
  });

  return (
    <Card className="overflow-hidden" data-tour="opportunity-feed">
      <CardHeader>
        <CardTitle>Opportunity Feed</CardTitle>
        <div className="text-xs text-muted-foreground">{filtered.length} matching events</div>
      </CardHeader>
      <CardContent className="max-h-[560px] space-y-3 overflow-auto p-3 scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
            No opportunities match the current filter. The engine keeps scanning order books.
          </div>
        ) : (
          filtered.map((opportunity) => (
            <OpportunityItem
              key={opportunity.id}
              opportunity={opportunity}
              compact={compact}
              active={selectedId === opportunity.id}
              fresh={Boolean(freshIds[opportunity.id])}
              onClick={() => select(opportunity.id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

const OpportunityItem = memo(function OpportunityItem({
  opportunity,
  compact,
  active,
  fresh,
  onClick
}: {
  opportunity: ArbitrageOpportunity;
  compact: boolean;
  active: boolean;
  fresh: boolean;
  onClick: () => void;
}) {
  const executed = opportunity.status === "EXECUTED";
  const rejected = opportunity.status === "REJECTED";
  const rowAccent = executed ? "#34d399" : rejected ? "#fb7185" : "#fbbf24";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ "--row-accent": rowAccent } as CSSProperties}
      className={cn(
        "opportunity-row group w-full rounded-lg border border-white/10 p-3 pl-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_36px_rgba(0,0,0,0.24)]",
        active && "border-primary/45 bg-primary/10 shadow-[0_0_30px_rgba(45,212,191,0.08)]",
        fresh && "opportunity-row-enter"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {opportunity.symbol}
            <Badge variant={executed ? "success" : rejected ? "danger" : opportunity.status === "WATCHING" ? "info" : "neutral"}>{opportunity.status}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            Buy {opportunity.buyExchange}
            <ArrowRight className="h-3 w-3 text-primary transition-transform duration-200 group-hover:translate-x-0.5" />
            Sell {opportunity.sellExchange}
          </div>
        </div>
        <div className={cn("text-right tabular-nums", opportunity.netProfit >= 0 ? "text-success" : "text-danger")}>
          <div className="text-sm font-semibold">{currency(opportunity.netProfit)}</div>
          <div className="text-xs">{percent(opportunity.netProfitPercent)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <div className="text-muted-foreground">Gross spread</div>
          <div className="mt-1 font-semibold">{percent(opportunity.grossSpreadPercent)}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <div className="text-muted-foreground">Volume</div>
          <div className="mt-1 font-semibold">{opportunity.volume.toFixed(4)}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <div className="text-muted-foreground">Processed in</div>
          <div className="mt-1 font-semibold">{ms(opportunity.latency.processingMs ?? opportunity.latencyMs)}</div>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(4, opportunity.confidence)}%`, background: rowAccent }} />
      </div>
      {!compact ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={opportunity.confidence >= 70 ? "success" : opportunity.confidence >= 45 ? "warning" : "danger"}>
            <ShieldCheck className="h-3 w-3" />
            Confidence {opportunity.confidence.toFixed(0)}%
          </Badge>
          {opportunity.rejectionMessage ? (
            <span className="flex items-center gap-1 text-danger">
              <TriangleAlert className="h-3 w-3" />
              {opportunity.rejectionMessage}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}, (prev, next) =>
  prev.opportunity.id === next.opportunity.id &&
  prev.opportunity.status === next.opportunity.status &&
  prev.opportunity.netProfit === next.opportunity.netProfit &&
  prev.active === next.active &&
  prev.fresh === next.fresh
);
