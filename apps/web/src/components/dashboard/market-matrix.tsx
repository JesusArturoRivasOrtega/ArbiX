"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, ms, percent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market.store";

export function MarketMatrix() {
  const [now, setNow] = useState<number | null>(null);
  const { snapshots, symbolFilter } = useMarketStore();
  const rows = symbolFilter === "ALL" ? snapshots : snapshots.filter((snapshot) => snapshot.symbol === symbolFilter);
  const bestBySymbol = computeBestBySymbol(rows);
  const arbSignals = computeArbSignals(rows);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Card className="overflow-hidden" data-tour="market-matrix">
      <CardHeader>
        <CardTitle>Market Matrix</CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{rows.length} live normalized quotes</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success/20 ring-1 ring-success/35" />best bid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-info/20 ring-1 ring-info/35" />best ask
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success/8 ring-1 ring-success/20" />strong arb signal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning/5 ring-1 ring-warning/20" />marginal signal
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Exchange</th>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-right">Bid</th>
                <th className="px-4 py-3 text-right">Bid Qty</th>
                <th className="px-4 py-3 text-right">Ask</th>
                <th className="px-4 py-3 text-right">Ask Qty</th>
                <th className="px-4 py-3 text-right">Spread</th>
                <th
                  className="cursor-help px-4 py-3 text-right"
                  title="BUY = best bid on other exchanges is higher than this ask (buy here, sell elsewhere). SELL = this bid is higher than the best ask elsewhere (buy elsewhere, sell here). % = potential gross spread before fees."
                >
                  Arb Signal ⓘ
                </th>
                <th className="px-4 py-3 text-right">Liquidity</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => {
                const best = bestBySymbol.get(row.symbol);
                const isBestBid = best?.bid.exchange === row.exchange;
                const isBestAsk = best?.ask.exchange === row.exchange;
                const ageMs = now === null ? 0 : Math.max(0, now - new Date(row.lastUpdate).getTime());
                const stale = row.status === "STALE" || ageMs > 3000;
                const signal = arbSignals.get(`${row.exchange}:${row.symbol}`);
                const strongSignal = signal && (signal.buyPct >= 0.1 || signal.sellPct >= 0.1);
                const marginalSignal = !strongSignal && signal && (signal.buyPct >= 0.03 || signal.sellPct >= 0.03);
                return (
                <tr
                  key={`${row.exchange}-${row.symbol}`}
                  className={cn(
                    "transition-all duration-200 hover:bg-primary/10",
                    stale && "bg-warning/5",
                    !stale && strongSignal && "bg-success/8",
                    !stale && marginalSignal && "bg-warning/5"
                  )}
                >
                  <td className="px-4 py-3 font-medium">{row.exchange}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.symbol}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">
                    <span className={cn("rounded px-2 py-1", isBestBid ? "bg-success/20 ring-1 ring-success/35" : "bg-success/10")}>
                      {currency(row.bidPrice)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.bidQty.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger">
                    <span className={cn("rounded px-2 py-1", isBestAsk ? "bg-info/20 text-info ring-1 ring-info/35" : "bg-danger/10")}>
                      {currency(row.askPrice)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.askQty.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{currency(row.spread)}</td>
                  <td className="px-4 py-3 text-right">
                    <ArbSignalCell signal={signal} exchange={row.exchange} symbol={row.symbol} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className="ml-auto flex w-24 flex-col gap-1">
                      <span>{row.liquidity.toFixed(3)}</span>
                      <span className="h-1 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.liquidity * 28)}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{ms(row.latencyMs)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={!stale && row.status === "CONNECTED" ? "success" : "warning"}>
                      {/* Always render a span to avoid React DOM reconciliation insertBefore crash */}
                      <span className={!stale && row.status === "CONNECTED" ? "pulse-dot" : "h-1.5 w-1.5 rounded-full bg-warning"} />
                      {stale ? "STALE" : row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{row.lastUpdate.slice(11, 19)}</span>
                      <span className={cn("rounded border px-1.5 py-0.5 text-[10px] tabular-nums", stale ? "border-warning/35 text-warning" : "border-white/10")}>
                        {ms(ageMs)}
                      </span>
                      <Link
                        href={`/simulator?exchange=${row.exchange}&symbol=${encodeURIComponent(row.symbol)}`}
                        className="rounded border border-primary/20 px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:bg-primary/10"
                      >
                        Depth
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

type ArbSignal = { buyPct: number; sellPct: number; buyDelta: number; sellDelta: number };

function ArbSignalCell({ signal, exchange, symbol }: { signal: ArbSignal | undefined; exchange: string; symbol: string }) {
  if (!signal) return <span className="text-muted-foreground">-</span>;

  const bestPct = Math.max(signal.buyPct, signal.sellPct);
  const isBuy = signal.buyPct >= signal.sellPct;
  const isSell = signal.sellPct > signal.buyPct;

  if (bestPct < 0.01) return <span className="text-muted-foreground text-xs">-</span>;

  const tooltipText = isBuy && signal.buyPct > 0
    ? `Buy ${symbol} on ${exchange} (ask), sell on exchange with higher bid. Gross spread: +${signal.buyDelta.toFixed(2)} USD (${signal.buyPct.toFixed(3)}%)`
    : `Sell ${symbol} on ${exchange} (bid), buy on exchange with lower ask. Gross spread: +${signal.sellDelta.toFixed(2)} USD (${signal.sellPct.toFixed(3)}%)`;

  const strong = bestPct >= 0.1;
  const marginal = bestPct >= 0.03;

  return (
    <div className="flex items-center justify-end gap-1.5 tabular-nums" title={tooltipText}>
      {isBuy && signal.buyPct > 0 ? (
        <TrendingUp className={cn("h-3 w-3 shrink-0", strong ? "text-success" : "text-warning")} />
      ) : isSell && signal.sellPct > 0 ? (
        <TrendingDown className={cn("h-3 w-3 shrink-0", strong ? "text-success" : "text-warning")} />
      ) : null}
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-xs font-semibold",
          strong && "bg-success/20 text-success ring-1 ring-success/30",
          marginal && !strong && "bg-warning/20 text-warning ring-1 ring-warning/30",
          !marginal && "text-muted-foreground"
        )}
      >
        {isBuy && signal.buyPct > 0 ? `BUY ${percent(signal.buyPct, 3)}` : isSell && signal.sellPct > 0 ? `SELL ${percent(signal.sellPct, 3)}` : `${percent(bestPct, 3)}`}
      </span>
    </div>
  );
}

function computeArbSignals(rows: ReturnType<typeof useMarketStore.getState>["snapshots"]): Map<string, ArbSignal> {
  const bySymbol = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = bySymbol.get(row.symbol) ?? [];
    group.push(row);
    bySymbol.set(row.symbol, group);
  }

  const signals = new Map<string, ArbSignal>();
  for (const [, group] of bySymbol) {
    for (const row of group) {
      const others = group.filter((r) => r.exchange !== row.exchange);
      if (others.length === 0) {
        signals.set(`${row.exchange}:${row.symbol}`, { buyPct: 0, sellPct: 0, buyDelta: 0, sellDelta: 0 });
        continue;
      }
      const bestBidElsewhere = Math.max(...others.map((r) => r.bidPrice));
      const bestAskElsewhere = Math.min(...others.map((r) => r.askPrice));
      const buyDelta = bestBidElsewhere - row.askPrice;
      const sellDelta = row.bidPrice - bestAskElsewhere;
      signals.set(`${row.exchange}:${row.symbol}`, {
        buyDelta,
        sellDelta,
        buyPct: row.askPrice > 0 ? (buyDelta / row.askPrice) * 100 : 0,
        sellPct: bestAskElsewhere > 0 ? (sellDelta / bestAskElsewhere) * 100 : 0
      });
    }
  }
  return signals;
}

function computeBestBySymbol(rows: ReturnType<typeof useMarketStore.getState>["snapshots"]) {
  const best = new Map<string, { bid: { exchange: string; price: number }; ask: { exchange: string; price: number } }>();
  for (const row of rows) {
    const current = best.get(row.symbol) ?? {
      bid: { exchange: row.exchange, price: row.bidPrice },
      ask: { exchange: row.exchange, price: row.askPrice }
    };
    if (row.bidPrice > current.bid.price) {
      current.bid = { exchange: row.exchange, price: row.bidPrice };
    }
    if (row.askPrice < current.ask.price) {
      current.ask = { exchange: row.exchange, price: row.askPrice };
    }
    best.set(row.symbol, current);
  }
  return best;
}
