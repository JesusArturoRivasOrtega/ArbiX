"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeDollarSign, Clock3, Gauge, ReceiptText, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OpportunityHighlights } from "@/components/dashboard/opportunity-highlights";
import { VolumeByExchangeChart } from "@/components/dashboard/volume-by-exchange-chart";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { RejectionReasonsChart } from "@/components/risk/rejection-reasons-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { chartTime, currency, ms } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

type TimeRange = "5min" | "1h" | "all";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "5min": "5 min",
  "1h": "1 hour",
  "all": "All time",
};

const TIME_RANGE_MS: Record<TimeRange, number> = {
  "5min": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "all": Infinity,
};

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const summary = useAnalyticsStore((state) => state.summary);
  useEffect(() => setMounted(true), []);

  const cutoffMs = Date.now() - TIME_RANGE_MS[timeRange];

  const filteredOpportunitiesOverTime = useMemo(
    () =>
      timeRange === "all"
        ? summary.opportunitiesOverTime
        : summary.opportunitiesOverTime.filter(
            (item) => new Date(item.time).getTime() >= cutoffMs
          ),
    [summary.opportunitiesOverTime, timeRange, cutoffMs]
  );

  const filteredCumulativePnl = useMemo(
    () =>
      timeRange === "all"
        ? summary.cumulativePnl
        : summary.cumulativePnl.filter(
            (item) => new Date(item.time).getTime() >= cutoffMs
          ),
    [summary.cumulativePnl, timeRange, cutoffMs]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Performance intelligence"
        title="Analytics"
        description="P&L, opportunity quality, rejection analysis, latency and simulated volume."
        iconSrc="/brand/module-analytics.png"
        iconAlt="Analytics module icon"
        tone="blue"
      >
        <HeaderStat label="Gross profit" value={currency(summary.totalGrossProfit)} tone="blue" />
        <HeaderStat label="Net profit" value={currency(summary.totalNetProfit)} tone={summary.totalNetProfit >= 0 ? "success" : "danger"} />
        <HeaderStat label="Fees paid" value={currency(summary.totalFeesPaid)} tone="amber" />
        <HeaderStat label="Average latency" value={ms(summary.averageDetectionLatencyMs)} tone="teal" />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gross Profit" value={currency(summary.totalGrossProfit)} icon={BadgeDollarSign} tone="info" />
        <MetricCard label="Net Profit" value={currency(summary.totalNetProfit)} icon={BadgeDollarSign} tone={summary.totalNetProfit >= 0 ? "success" : "danger"} />
        <MetricCard label="Fees Paid" value={currency(summary.totalFeesPaid)} icon={ReceiptText} tone="warning" />
        <MetricCard label="Slippage Cost" value={currency(summary.totalSlippageCost)} icon={TrendingUp} tone="warning" />
        <MetricCard label="Average Latency" value={ms(summary.averageDetectionLatencyMs)} icon={Clock3} />
        <MetricCard label="Executed / Rejected" value={`${summary.executedOpportunities} / ${summary.rejectedOpportunities}`} icon={TrendingUp} tone="info" />
        <MetricCard label="Total Opportunities" value={summary.totalOpportunities.toString()} icon={TrendingUp} />
        <MetricCard label="Expired" value={summary.expiredOpportunities.toString()} icon={Clock3} tone="warning" />
        <MetricCard
          label="Sharpe Ratio"
          value={summary.sharpeRatio !== undefined ? summary.sharpeRatio.toFixed(4) : "—"}
          helper={
            summary.sharpeRatio !== undefined
              ? "Per-trade · mean(r)/σ(r) · r = netProfit/buyCost · rf = 0"
              : "Need ≥ 2 executed trades"
          }
          icon={Gauge}
          tone={
            summary.sharpeRatio === undefined ? "default"
            : summary.sharpeRatio >= 1 ? "success"
            : summary.sharpeRatio >= 0 ? "warning"
            : "danger"
          }
        />
      </div>
      <OpportunityHighlights />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
        <span className="text-xs text-muted-foreground">Chart range:</span>
        {(["5min", "1h", "all"] as TimeRange[]).map((range) => (
          <Button
            key={range}
            size="sm"
            variant={timeRange === range ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            onClick={() => setTimeRange(range)}
          >
            {TIME_RANGE_LABELS[range]}
          </Button>
        ))}
        {timeRange !== "all" && (
          <span className="text-xs text-muted-foreground">
            Totals and Sharpe always reflect the full session.
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <ExportButton
            data={[{
              exportedAt: new Date().toISOString(),
              totalOpportunities: summary.totalOpportunities,
              executedOpportunities: summary.executedOpportunities,
              rejectedOpportunities: summary.rejectedOpportunities,
              expiredOpportunities: summary.expiredOpportunities,
              totalGrossProfit: summary.totalGrossProfit,
              totalNetProfit: summary.totalNetProfit,
              totalFeesPaid: summary.totalFeesPaid,
              totalSlippageCost: summary.totalSlippageCost,
              averageDetectionLatencyMs: summary.averageDetectionLatencyMs,
              sharpeRatio: summary.sharpeRatio ?? "n/a",
            }]}
            filename={`arbix-analytics-summary-${Date.now()}`}
            format="csv"
            label="Export summary"
          />
          <ExportButton
            data={filteredCumulativePnl.map((p) => ({ time: p.time, gross: p.gross, net: p.net }))}
            filename={`arbix-pnl-${Date.now()}`}
            format="csv"
            label="Export P&L"
          />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opportunities Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredOpportunitiesOverTime}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={chartTime} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
                  <Legend />
                  <Line isAnimationActive={false} type="monotone" dataKey="observed" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line isAnimationActive={false} type="monotone" dataKey="executed" stroke="#34d399" strokeWidth={2} dot={false} />
                  <Line isAnimationActive={false} type="monotone" dataKey="rejected" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
        <Card data-tour="pnl-chart">
          <CardHeader>
            <CardTitle>Gross vs Net Profit</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] min-w-0">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredCumulativePnl}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={chartTime} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
                  <Legend />
                  <Line isAnimationActive={false} type="monotone" dataKey="gross" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line isAnimationActive={false} type="monotone" dataKey="net" stroke="#34d399" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
        <RejectionReasonsChart />
        <VolumeByExchangeChart />
        <Card>
          <CardHeader>
            <CardTitle>Volume by Pair</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] min-w-0">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.volumeByPair}>
                  <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="symbol" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
                  <Bar isAnimationActive={false} dataKey="volume" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
