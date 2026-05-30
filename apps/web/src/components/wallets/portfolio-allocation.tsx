"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import { useWalletStore } from "@/store/wallets.store";

const ASSET_COLORS: Record<string, string> = {
  USDT: "#34d399",
  USD: "#2dd4bf",
  BTC: "#fbbf24",
  ETH: "#60a5fa"
};

export function PortfolioAllocation() {
  const [mounted, setMounted] = useState(false);
  const balances = useWalletStore((state) => state.balances);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const byAsset = new Map<string, number>();
    for (const wallet of balances) {
      byAsset.set(wallet.asset, (byAsset.get(wallet.asset) ?? 0) + wallet.estimatedUsdValue);
    }
    return [...byAsset.entries()]
      .filter(([, value]) => value > 0)
      .map(([asset, value]) => ({ asset, value, color: ASSET_COLORS[asset] ?? "#a78bfa" }));
  }, [balances]);

  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Allocation</CardTitle>
        <div className="text-xs text-muted-foreground">By asset, all exchanges</div>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] min-w-0">
          {mounted && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="asset" innerRadius={60} outerRadius={92} stroke="rgba(0,0,0,0.4)" strokeWidth={2}>
                  {data.map((slice) => (
                    <Cell key={slice.asset} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                  formatter={(value, name) => [currency(Number(value)), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          {data.map((slice) => {
            const pct = total > 0 ? (slice.value / total) * 100 : 0;
            return (
              <div key={slice.asset} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: slice.color }} />
                  <span className="font-medium">{slice.asset}</span>
                </div>
                <div className="flex items-center gap-3 tabular-nums text-muted-foreground">
                  <span>{currency(slice.value)}</span>
                  <span className="text-foreground">{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
