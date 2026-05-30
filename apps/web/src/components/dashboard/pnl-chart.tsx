"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

export function PnlChart() {
  const [mounted, setMounted] = useState(false);
  const data = useAnalyticsStore((state) => state.summary.cumulativePnl);
  useEffect(() => setMounted(true), []);

  const hasData = data.length > 0;

  const origin = hasData ? new Date(data[0]!.time).getTime() : 0;

  const relativeTime = useMemo(() => (isoStr: string): string => {
    const diffMs = new Date(isoStr).getTime() - origin;
    if (diffMs < 0) return "0s";
    const s = Math.round(diffMs / 1000);
    if (s < 60) return `+${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem === 0 ? `+${m}m` : `+${m}m${rem}s`;
  }, [origin]);

  return (
    <Card data-tour="pnl-chart">
      <CardHeader>
        <CardTitle>Cumulative P&L</CardTitle>
        <div className="text-xs text-muted-foreground">Gross profit vs net simulated return over time</div>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] min-w-0">
          {!hasData ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/10 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No trade data yet</p>
              <p className="text-xs text-muted-foreground/70">Run a scenario or wait for the bot to execute a trade</p>
            </div>
          ) : mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="pnlGross" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pnlNet" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={relativeTime} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                  formatter={(value, name) => [currency(Number(value)), name === "Net" ? "Net P&L" : "Gross profit"]}
                  labelFormatter={(label) => relativeTime(String(label))}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                <Area isAnimationActive={false} type="monotone" dataKey="gross" stroke="#60a5fa" fill="url(#pnlGross)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Gross" />
                <Area isAnimationActive={false} type="monotone" dataKey="pnl" stroke="#2dd4bf" fill="url(#pnlNet)" strokeWidth={2} dot={false} name="Net" />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
