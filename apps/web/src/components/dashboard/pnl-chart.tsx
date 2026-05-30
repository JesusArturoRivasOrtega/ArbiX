"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTime, currency } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

export function PnlChart() {
  const [mounted, setMounted] = useState(false);
  const data = useAnalyticsStore((state) => state.summary.cumulativePnl);
  useEffect(() => setMounted(true), []);

  const hasData = data.length > 0;

  return (
    <Card data-tour="pnl-chart">
      <CardHeader>
        <CardTitle>Cumulative P&L</CardTitle>
        <div className="text-xs text-muted-foreground">Gross profit vs fees paid vs net simulated return</div>
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
                <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={chartTime} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                  formatter={(value, name) => [currency(Number(value)), name === "pnl" ? "Net P&L" : name === "gross" ? "Gross profit" : "Fees paid"]}
                />
                <Legend
                  formatter={(value) => value === "pnl" ? "Net P&L" : value === "gross" ? "Gross profit" : "Fees paid"}
                  wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                />
                {data[0] && "gross" in data[0] && (
                  <Area isAnimationActive={false} type="monotone" dataKey="gross" stroke="#60a5fa" fill="url(#pnlGross)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                )}
                <Area isAnimationActive={false} type="monotone" dataKey="pnl" stroke="#2dd4bf" fill="url(#pnlNet)" strokeWidth={2} dot={false} />
                {data[0] && "fees" in data[0] && (
                  <Area isAnimationActive={false} type="monotone" dataKey="fees" stroke="#f87171" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
