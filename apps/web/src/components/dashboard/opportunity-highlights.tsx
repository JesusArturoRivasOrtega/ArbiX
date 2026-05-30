"use client";

import { useMemo } from "react";
import { ArrowRight, Sparkles, TriangleAlert } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ArbitrageOpportunity } from "@arbix/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, ms, percent } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";

export function OpportunityHighlights() {
  const summary = useAnalyticsStore((state) => state.summary);
  const select = useOpportunitiesStore((state) => state.select);
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const executedOpportunities = useMemo(
    () => opportunities.filter((o) => o.status === "EXECUTED").slice(0, 20),
    [opportunities]
  );

  const sparklineData = executedOpportunities
    .slice()
    .reverse()
    .map((o, i) => ({ i, v: o.netProfit }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <HighlightCard
        title="Best Executed Opportunity"
        tone="success"
        icon={Sparkles}
        opportunity={summary.bestOpportunity}
        sparklineData={sparklineData}
        onSelect={(id) => select(id)}
        emptyHint="No simulated executions yet. Run a profitable replay or wait for live divergence."
      />
      <HighlightCard
        title="Worst Rejected Opportunity"
        tone="danger"
        icon={TriangleAlert}
        opportunity={summary.worstRejectedOpportunity}
        sparklineData={[]}
        onSelect={(id) => select(id)}
        emptyHint="No rejections recorded. The risk engine reports here when fees or latency kill an opportunity."
      />
    </div>
  );
}

function HighlightCard({
  title,
  tone,
  icon: Icon,
  opportunity,
  sparklineData,
  onSelect,
  emptyHint
}: {
  title: string;
  tone: "success" | "danger";
  icon: typeof Sparkles;
  opportunity: ArbitrageOpportunity | undefined;
  sparklineData: Array<{ i: number; v: number }>;
  onSelect: (id: string | undefined) => void;
  emptyHint: string;
}) {
  const valueColor = tone === "success" ? "text-success" : "text-danger";
  const borderColor = tone === "success" ? "border-success/30" : "border-danger/30";
  const bgColor = tone === "success" ? "bg-success/10" : "bg-danger/10";
  const chartColor = tone === "success" ? "#2dd4bf" : "#f87171";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={tone === "success" ? "h-4 w-4 text-success" : "h-4 w-4 text-danger"} />
          {title}
        </CardTitle>
        {opportunity ? <Badge variant={tone}>{opportunity.status}</Badge> : null}
      </CardHeader>
      <CardContent>
        {!opportunity ? (
          <div className="rounded-md border border-dashed border-white/10 p-6 text-sm text-muted-foreground">{emptyHint}</div>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(opportunity.id)}
            className={`block w-full rounded-lg border ${borderColor} ${bgColor} p-4 text-left transition-all duration-200 hover:scale-[1.005]`}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="neutral">{opportunity.symbol}</Badge>
              <span className="font-medium">{opportunity.buyExchange}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{opportunity.sellExchange}</span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className={`mt-3 text-3xl font-semibold tabular-nums ${valueColor}`}>{currency(opportunity.netProfit)}</div>
                <div className="text-xs text-muted-foreground">{percent(opportunity.netProfitPercent)} net - {opportunity.volume.toFixed(4)} volume</div>
              </div>
              {tone === "success" && sparklineData.length >= 3 ? (
                <div className="h-10 w-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                      <defs>
                        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ display: "none" }}
                        cursor={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={chartColor}
                        strokeWidth={1.5}
                        fill="url(#sparkGrad)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Gross spread" value={percent(opportunity.grossSpreadPercent)} />
              <Stat label="Confidence" value={`${opportunity.confidence.toFixed(0)}%`} />
              <Stat label="Detected in" value={ms(opportunity.latencyMs)} />
            </div>
            {opportunity.rejectionMessage ? (
              <p className="mt-3 text-xs text-danger">{opportunity.rejectionMessage}</p>
            ) : null}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}
