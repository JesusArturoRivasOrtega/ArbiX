"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsStore } from "@/store/analytics.store";

export function RejectionReasonsChart() {
  const [mounted, setMounted] = useState(false);
  const data = useAnalyticsStore((state) => state.summary.rejectionReasons);
  useEffect(() => setMounted(true), []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rejection Reasons</CardTitle>
        <div className="text-xs text-muted-foreground">The bot avoids bad executions explicitly</div>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.07)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="reason"
                  type="category"
                  width={170}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }} />
                <Bar isAnimationActive={false} dataKey="count" fill="#fb923c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
