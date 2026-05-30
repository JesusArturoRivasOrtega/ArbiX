"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChartArea, Table2 } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { OrderBookDepthSnapshot, OrderBookLevel } from "@arbix/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { currency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useMarketStore } from "@/store/market.store";

type ViewMode = "chart" | "table";

type DepthPoint = {
  price: number;
  bidA?: number;
  askA?: number;
  bidB?: number;
  askB?: number;
};

export function OrderbookDepthView() {
  const searchParams = useSearchParams();
  const requestedExchange = searchParams.get("exchange") ?? "";
  const requestedSymbol = searchParams.get("symbol") ?? "";
  const snapshots = useMarketStore((state) => state.snapshots);
  const symbolFilter = useMarketStore((state) => state.symbolFilter);

  const availableExchanges = useMemo(() => {
    const exchanges = new Set(snapshots.map((s) => s.exchange));
    return [...exchanges].sort();
  }, [snapshots]);

  const availableSymbols = useMemo(() => {
    const symbols = new Set(snapshots.map((s) => s.symbol));
    return [...symbols].sort();
  }, [snapshots]);

  const [exchangeA, setExchangeA] = useState<string>(() => requestedExchange);
  const [exchangeB, setExchangeB] = useState<string>("");
  const [symbol, setSymbol] = useState<string>(() => requestedSymbol);
  const [bookA, setBookA] = useState<OrderBookDepthSnapshot | null>(null);
  const [bookB, setBookB] = useState<OrderBookDepthSnapshot | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

  const exchangeOptionsKey = availableExchanges.join("|");
  const symbolOptionsKey = availableSymbols.join("|");

  useEffect(() => {
    if (requestedExchange && requestedExchange !== exchangeA) setExchangeA(requestedExchange);
  }, [requestedExchange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (requestedSymbol && requestedSymbol !== symbol) setSymbol(requestedSymbol);
  }, [requestedSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (availableExchanges.length === 0) return;
    if (!exchangeA || !availableExchanges.includes(exchangeA as never)) {
      setExchangeA(availableExchanges[0]!);
    }
  }, [exchangeA, exchangeOptionsKey, availableExchanges]);

  useEffect(() => {
    const preferred = symbolFilter !== "ALL" ? symbolFilter : availableSymbols[0];
    if (!preferred) return;
    if (symbol !== preferred && (!symbol || !availableSymbols.includes(symbol as never) || symbolFilter !== "ALL")) {
      setSymbol(preferred);
    }
  }, [symbol, symbolFilter, symbolOptionsKey, availableSymbols]);

  useEffect(() => {
    if (!exchangeA || !symbol) return;
    let cancelled = false;
    const load = () => {
      setLoadingA(true);
      api.orderbook(exchangeA, symbol)
        .then((p) => { if (!cancelled) setBookA(p as OrderBookDepthSnapshot); })
        .catch(() => { if (!cancelled) setBookA(null); })
        .finally(() => { if (!cancelled) setLoadingA(false); });
    };
    load();
    const id = window.setInterval(load, 1500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [exchangeA, symbol]);

  useEffect(() => {
    if (!exchangeB || !symbol) { setBookB(null); return; }
    let cancelled = false;
    const load = () => {
      api.orderbook(exchangeB, symbol)
        .then((p) => { if (!cancelled) setBookB(p as OrderBookDepthSnapshot); })
        .catch(() => { if (!cancelled) setBookB(null); });
    };
    load();
    const id = window.setInterval(load, 1500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [exchangeB, symbol]);

  const depthMax = useMemo(() => {
    let max = computeSideMax(bookA);
    if (bookB) max = Math.max(max, computeSideMax(bookB));
    return max;
  }, [bookA, bookB]);

  const chartData = useMemo(() => buildChartData(bookA, bookB), [bookA, bookB]);

  // Cross-exchange spread for comparison badge
  const arbSpread = useMemo(() => {
    if (!bookA || !bookB) return null;
    const bestAskA = bookA.asks[0]?.price ?? Infinity;
    const bestBidB = bookB.bids[0]?.price ?? 0;
    const bestAskB = bookB.asks[0]?.price ?? Infinity;
    const bestBidA = bookA.bids[0]?.price ?? 0;
    const spreadAB = bestBidB - bestAskA;
    const spreadBA = bestBidA - bestAskB;
    const best = Math.max(spreadAB, spreadBA);
    return { value: best, direction: spreadAB >= spreadBA ? `Buy ${exchangeA}, Sell ${exchangeB}` : `Buy ${exchangeB}, Sell ${exchangeA}` };
  }, [bookA, bookB, exchangeA, exchangeB]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Book Depth</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={exchangeA} onChange={(e) => setExchangeA(e.target.value)} aria-label="Exchange A">
            {availableExchanges.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
          </Select>
          <Select
            value={exchangeB}
            onChange={(e) => setExchangeB(e.target.value)}
            aria-label="Compare with"
          >
            <option value="">- Compare with -</option>
            {availableExchanges.filter((ex) => ex !== exchangeA).map((ex) => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </Select>
          <Select value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Symbol">
            {availableSymbols.map((sym) => <option key={sym} value={sym}>{sym}</option>)}
          </Select>
          <div className="flex rounded-md border border-white/10 p-0.5">
            <Button
              size="sm"
              variant={viewMode === "chart" ? "default" : "ghost"}
              onClick={() => setViewMode("chart")}
              className="h-7 px-3 text-xs"
            >
              <ChartArea className="h-3.5 w-3.5" />
              Chart
            </Button>
            <Button
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              onClick={() => setViewMode("table")}
              className="h-7 px-3 text-xs"
            >
              <Table2 className="h-3.5 w-3.5" />
              Table
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {arbSpread !== null ? (
          <div className={cn(
            "mb-4 flex items-center justify-between rounded-md border p-3",
            arbSpread.value > 0 ? "border-success/35 bg-success/10" : "border-white/10 bg-white/5"
          )}>
            <div className="text-sm">
              <span className="text-muted-foreground">Cross-exchange spread: </span>
              <span className={cn("font-semibold tabular-nums", arbSpread.value > 0 ? "text-success" : "text-muted-foreground")}>
                {currency(arbSpread.value)}
              </span>
              {arbSpread.value > 0 ? (
                <span className="ml-2 text-xs text-muted-foreground">{arbSpread.direction}</span>
              ) : null}
            </div>
            <Badge variant={arbSpread.value > 0 ? "success" : "neutral"}>
              {arbSpread.value > 0 ? "Arb opportunity" : "No spread"}
            </Badge>
          </div>
        ) : null}

        {!bookA && loadingA ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : !bookA ? (
          <div className="rounded-md border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
            No order book for {exchangeA} {symbol}. The adapter may still be warming up.
          </div>
        ) : viewMode === "chart" ? (
          <DepthChart data={chartData} bookA={bookA} bookB={bookB} exchangeA={exchangeA} exchangeB={exchangeB} />
        ) : (
          <TableView bookA={bookA} bookB={bookB} depthMax={depthMax} exchangeA={exchangeA} exchangeB={exchangeB} />
        )}
      </CardContent>
    </Card>
  );
}

function DepthChart({
  data,
  bookA,
  bookB,
  exchangeA,
  exchangeB
}: {
  data: DepthPoint[];
  bookA: OrderBookDepthSnapshot;
  bookB: OrderBookDepthSnapshot | null;
  exchangeA: string;
  exchangeB: string;
}) {
  const midA = getMidPrice(bookA);
  const midB = bookB ? getMidPrice(bookB) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        <LegendItem color="#34d399" label={`${exchangeA} bids`} />
        <LegendItem color="#fb7185" label={`${exchangeA} asks`} />
        {bookB ? (
          <>
            <LegendItem color="#34d399" label={`${exchangeB} bids`} dashed />
            <LegendItem color="#fb7185" label={`${exchangeB} asks`} dashed />
          </>
        ) : null}
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="price"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v as number).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              scale="linear"
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v as number).toFixed(2)}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }}
              contentStyle={{ background: "#0d0f12", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }}
              formatter={(value, name) => [(value as number).toFixed(4), name as string]}
              labelFormatter={(label) => `$${(label as number).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            />
            <Area
              type="stepAfter"
              dataKey="bidA"
              name={`${exchangeA} bid depth`}
              stroke="#34d399"
              fill="#34d399"
              fillOpacity={0.18}
              strokeWidth={1.5}
              connectNulls={false}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="stepBefore"
              dataKey="askA"
              name={`${exchangeA} ask depth`}
              stroke="#fb7185"
              fill="#fb7185"
              fillOpacity={0.18}
              strokeWidth={1.5}
              connectNulls={false}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {bookB ? (
              <>
                <Line
                  type="stepAfter"
                  dataKey="bidB"
                  name={`${exchangeB} bid depth`}
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="stepBefore"
                  dataKey="askB"
                  name={`${exchangeB} ask depth`}
                  stroke="#fb7185"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </>
            ) : null}
            <ReferenceLine x={midA} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" label={{ value: exchangeA, fill: "#9ca3af", fontSize: 9 }} />
            {midB ? (
              <ReferenceLine x={midB} stroke="rgba(251,191,36,0.4)" strokeDasharray="3 3" label={{ value: exchangeB, fill: "#fbbf24", fontSize: 9 }} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{bookA.bids.length + bookA.asks.length} levels - age {Math.round(bookA.ageMs)}ms</span>
        {bookB ? <span>{bookB.bids.length + bookB.asks.length} levels - age {Math.round(bookB.ageMs)}ms</span> : null}
      </div>
    </div>
  );
}

function TableView({
  bookA,
  bookB,
  depthMax,
  exchangeA,
  exchangeB
}: {
  bookA: OrderBookDepthSnapshot;
  bookB: OrderBookDepthSnapshot | null;
  depthMax: number;
  exchangeA: string;
  exchangeB: string;
}) {
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{exchangeA} - {bookA.symbol} - {bookA.bids.length + bookA.asks.length} levels - age {Math.round(bookA.ageMs)}ms</span>
      </div>
      <div className={cn("grid gap-3", bookB ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2")}>
        <DepthSide title={`${exchangeA} Bids`} levels={bookA.bids} side="bid" maxQuantity={depthMax} />
        <DepthSide title={`${exchangeA} Asks`} levels={bookA.asks} side="ask" maxQuantity={depthMax} />
        {bookB ? (
          <>
            <DepthSide title={`${exchangeB} Bids`} levels={bookB.bids} side="bid" maxQuantity={depthMax} />
            <DepthSide title={`${exchangeB} Asks`} levels={bookB.asks} side="ask" maxQuantity={depthMax} />
          </>
        ) : null}
      </div>
    </>
  );
}

function DepthSide({ title, levels, side, maxQuantity }: { title: string; levels: OrderBookLevel[]; side: "bid" | "ask"; maxQuantity: number }) {
  const sorted = side === "bid" ? [...levels].sort((a, b) => b.price - a.price) : [...levels].sort((a, b) => a.price - b.price);
  let cumulative = 0;
  const rows = sorted.map((level) => { cumulative += level.quantity; return { ...level, cumulative }; });
  const accent = side === "bid" ? "bg-success/35" : "bg-danger/35";
  const text = side === "bid" ? "text-success" : "text-danger";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase text-muted-foreground">
        <span>{title}</span>
        <span>qty / cumulative</span>
      </div>
      <div className="grid gap-1 text-[11px]">
        {rows.length === 0 ? <div className="text-muted-foreground">No levels</div> : null}
        {rows.map((level, index) => {
          const width = maxQuantity > 0 ? (level.cumulative / maxQuantity) * 100 : 0;
          return (
            <div key={`${side}-${level.price}-${index}`} className="relative overflow-hidden rounded-sm">
              <div className={`absolute inset-y-0 ${side === "bid" ? "right-0" : "left-0"} ${accent}`} style={{ width: `${width}%` }} />
              <div className="relative flex items-center justify-between px-2 py-1 tabular-nums">
                <span className={text}>{currency(level.price)}</span>
                <span className="text-muted-foreground">{level.quantity.toFixed(4)} <span className="opacity-60">/ {level.cumulative.toFixed(4)}</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="16" height="8" viewBox="0 0 16 8">
        {dashed ? (
          <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
        ) : (
          <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" />
        )}
      </svg>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function getMidPrice(book: OrderBookDepthSnapshot): number {
  const bestBid = book.bids[0]?.price ?? 0;
  const bestAsk = book.asks[0]?.price ?? bestBid;
  return (bestBid + bestAsk) / 2;
}

function computeSideMax(book: OrderBookDepthSnapshot | null): number {
  if (!book) return 0;
  const bidTotal = book.bids.reduce((s, l) => s + l.quantity, 0);
  const askTotal = book.asks.reduce((s, l) => s + l.quantity, 0);
  return Math.max(bidTotal, askTotal);
}

function buildChartData(bookA: OrderBookDepthSnapshot | null, bookB: OrderBookDepthSnapshot | null): DepthPoint[] {
  const points = new Map<number, DepthPoint>();

  const addSide = (book: OrderBookDepthSnapshot, side: "bid" | "ask", keyA: "bidA" | "askA", keyB: "bidB" | "askB", isB: boolean) => {
    const key = isB ? keyB : keyA;
    const sorted = side === "bid"
      ? [...book.bids].sort((a, b) => b.price - a.price)
      : [...book.asks].sort((a, b) => a.price - b.price);
    let cum = 0;
    for (const level of sorted) {
      cum += level.quantity;
      const existing = points.get(level.price) ?? { price: level.price };
      (existing as Record<string, number>)[key] = cum;
      points.set(level.price, existing);
    }
  };

  if (bookA) {
    addSide(bookA, "bid", "bidA", "bidB", false);
    addSide(bookA, "ask", "askA", "askB", false);
  }
  if (bookB) {
    addSide(bookB, "bid", "bidA", "bidB", true);
    addSide(bookB, "ask", "askA", "askB", true);
  }

  return [...points.values()].sort((a, b) => a.price - b.price);
}
