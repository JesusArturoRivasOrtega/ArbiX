"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Calculator } from "lucide-react";
import type { SimulatedTrade } from "@arbix/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useAnalyticsStore } from "@/store/analytics.store";

export function TradeBreakdown() {
  const trade = useAnalyticsStore((state) => state.lastTrade);
  if (!trade) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Waiting for simulated execution. Once the engine approves an opportunity, you will see VWAP execution, fees, slippage and net P&L here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Trade Breakdown
        </CardTitle>
        <Badge variant={trade.status === "SIMULATED" ? "success" : trade.status === "PARTIAL" ? "warning" : "danger"}>{trade.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <RouteHeader trade={trade} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SideCard direction="buy" trade={trade} />
          <SideCard direction="sell" trade={trade} />
        </div>
        <PnlSummary trade={trade} />
      </CardContent>
    </Card>
  );
}

function RouteHeader({ trade }: { trade: SimulatedTrade }) {
  const isPartial = trade.requestedVolume > trade.volume + 1e-9;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Badge variant="neutral">{trade.symbol}</Badge>
        <span>{trade.buyExchange}</span>
        <ArrowRight className="h-4 w-4 text-primary" />
        <span>{trade.sellExchange}</span>
        {isPartial ? <Badge variant="warning">PARTIAL</Badge> : null}
      </div>
      <div className="text-right tabular-nums">
        <div className="text-[11px] uppercase text-muted-foreground">Volume</div>
        {isPartial ? (
          <div>
            <div className="text-sm font-semibold text-warning">{trade.volume.toFixed(6)}</div>
            <div className="text-[10px] text-muted-foreground">of {trade.requestedVolume.toFixed(6)} req.</div>
          </div>
        ) : (
          <div className="font-semibold">{trade.volume.toFixed(6)}</div>
        )}
      </div>
    </div>
  );
}

function SideCard({ direction, trade }: { direction: "buy" | "sell"; trade: SimulatedTrade }) {
  const isBuy = direction === "buy";
  const exchange = isBuy ? trade.buyExchange : trade.sellExchange;
  const amount = isBuy ? trade.buyCost : trade.sellRevenue;
  const Icon = isBuy ? ArrowDownRight : ArrowUpRight;
  const accent = isBuy ? "text-danger" : "text-success";
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">{isBuy ? "Buy leg" : "Sell leg"}</div>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <div className="mt-1 text-sm font-semibold">{exchange}</div>
      <div className="mt-3 grid gap-1 text-xs">
        <Row label={isBuy ? "Buy cost" : "Sell revenue"} value={currency(amount)} bold />
        <Row label="Avg execution price" value={currency(amount / Math.max(1e-9, trade.volume))} />
        <Row label="Volume" value={trade.volume.toFixed(6)} />
      </div>
    </div>
  );
}

function PnlSummary({ trade }: { trade: SimulatedTrade }) {
  const profitable = trade.netProfit >= 0;
  const tradingFees = trade.totalFees - trade.withdrawalFee;
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="grid gap-2 text-xs">
        <Row label="Trading fees (buy + sell)" value={currency(tradingFees)} tone="warning" />
        <Row label="Withdrawal fee" value={currency(trade.withdrawalFee)} tone="warning" />
        <Row label="Slippage" value={currency(trade.slippageCost)} tone="warning" />
        <div className="my-1 border-t border-white/10" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Net P&L</span>
          <span className={cn("text-base font-semibold tabular-nums", profitable ? "text-success" : "text-danger")}>{currency(trade.netProfit)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone = "default", bold = false }: { label: string; value: string; tone?: "default" | "warning"; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold", tone === "warning" && "text-warning")}>{value}</span>
    </div>
  );
}
