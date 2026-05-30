"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

export function VolumeByExchangeChart() {
  const [mounted, setMounted] = useState(false);
  const data = useAnalyticsStore((state) => state.summary.volumeByExchange);
  useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume by Exchange</CardTitle>
        <div className="text-xs text-muted-foreground">Simulated executions per venue (base asset)</div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
                <XAxis dataKey="exchange" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                  formatter={(value, name) => {
                    if (name === "notional") return [currency(Number(value)), "Notional"];
                    return [Number(value).toFixed(4), "Volume"];
                  }}
                />
                <Bar isAnimationActive={false} dataKey="volume" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
