"use client";

import { useMemo } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currency } from "@/lib/formatters";
import { useWalletStore } from "@/store/wallets.store";

const PRECISION: Record<string, number> = {
  BTC: 6,
  ETH: 4,
  USDT: 2,
  USD: 2
};

export function ExchangePortfolioCards() {
  const balances = useWalletStore((state) => state.balances);
  const initialTotals = useWalletStore((state) => state.initialTotals);

  const grouped = useMemo(() => {
    const byExchange = new Map<string, { total: number; assets: { asset: string; balance: number; estimatedUsdValue: number }[] }>();
    for (const wallet of balances) {
      const bucket = byExchange.get(wallet.exchange) ?? { total: 0, assets: [] };
      bucket.total += wallet.estimatedUsdValue;
      bucket.assets.push({ asset: wallet.asset, balance: wallet.balance, estimatedUsdValue: wallet.estimatedUsdValue });
      byExchange.set(wallet.exchange, bucket);
    }
    return [...byExchange.entries()].map(([exchange, bucket]) => ({
      exchange,
      total: bucket.total,
      initial: initialTotals[exchange],
      assets: bucket.assets.sort((a, b) => b.estimatedUsdValue - a.estimatedUsdValue)
    }));
  }, [balances, initialTotals]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {grouped.map((entry) => {
        const delta = entry.initial !== undefined ? entry.total - entry.initial : undefined;
        const deltaPercent = entry.initial !== undefined && entry.initial > 0 ? ((entry.total - entry.initial) / entry.initial) * 100 : undefined;
        const isPositive = delta !== undefined && delta >= 0;

        return (
          <Card key={entry.exchange} className="metric-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4 text-primary" />
                  {entry.exchange}
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase text-muted-foreground">Portfolio</div>
                  <div className="text-sm font-semibold tabular-nums">{currency(entry.total)}</div>
                  {delta !== undefined && deltaPercent !== undefined && (
                    <div
                      className={cn(
                        "text-[10px] tabular-nums font-medium",
                        isPositive ? "text-success" : "text-danger"
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {currency(delta)} ({isPositive ? "+" : ""}
                      {deltaPercent.toFixed(3)}%)
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {entry.assets.map((asset) => {
                  const precision = PRECISION[asset.asset] ?? 4;
                  return (
                    <div key={asset.asset} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{asset.asset}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-medium">{asset.balance.toFixed(precision)}</span>
                        <span className="text-muted-foreground">{currency(asset.estimatedUsdValue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
