"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ms } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

export function LatencyPanel() {
  const [mounted, setMounted] = useState(false);
  const data = useAnalyticsStore((state) => state.summary.latencyByExchange);
  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency Panel</CardTitle>
        <div className="text-xs text-muted-foreground">p50 / p95 / max per exchange</div>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="exchange" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}ms`} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                  formatter={(value) => ms(Number(value))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar isAnimationActive={false} dataKey="p50" name="p50" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="p95" name="p95" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="max" name="max" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
          {data.map((row) => (
            <div key={row.exchange} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="font-semibold">{row.exchange}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.samples > 0 ? `avg ${ms(row.avg)} - ${row.samples} samples` : "no samples"}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
