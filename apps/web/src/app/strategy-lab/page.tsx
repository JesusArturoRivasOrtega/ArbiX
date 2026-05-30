"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, BookOpen, TrendingDown, Zap } from "lucide-react";
import { OpportunityFeed } from "@/components/dashboard/opportunity-feed";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { TriangularArbitrageFlow } from "@/components/strategy-lab/triangular-arbitrage-flow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STORAGE_KEY = "arbix:strategy-lab:tab";

export default function StrategyLabPage() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) ?? "cross";
    }
    return "cross";
  });

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    localStorage.setItem(STORAGE_KEY, value);
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Strategy research"
        title="Strategy Lab"
        description="Primary cross-exchange strategy plus a visible experimental triangular module."
        iconSrc="/brand/module-arbitrage.png"
        iconAlt="Strategy module icon"
        tone="violet"
      >
        <HeaderStat label="Primary" value="Cross-exchange" tone="teal" />
        <HeaderStat label="Experimental" value="Triangular" tone="violet" />
        <HeaderStat label="Data" value="Live + demo" tone="blue" />
        <HeaderStat label="Trades" value="Simulated" tone="neutral" />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Cross-exchange (primary)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Buy on the cheaper exchange, sell simultaneously on the more expensive one. The bot evaluates every
            pair combination in real time, accounting for VWAP slippage, fees, and latency before executing.
            This is the <span className="font-medium text-foreground">core strategy</span> running 24/7.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
              Triangular (experimental)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Three-leg cycle: <span className="font-medium text-foreground">USDT → BTC → ETH → USDT</span>.
            Each leg crosses the bid/ask spread and pays its own fee. Three 0.1% fees on a $10k notional
            consume ~$30 before any slippage — the profit window must exceed this cost to execute.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-danger" />
              Why triangular mostly loses
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Major exchanges arbitrage their own cross-rates in milliseconds. By the time an API consumer
            detects the imbalance, it is already gone. Triangular opportunities on Binance/Kraken/OKX
            exist for <span className="font-medium text-foreground">{"<"} 50 ms</span> — well below any
            HTTP-based detection cycle. This module demonstrates the math, not a viable live strategy.
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-4 py-2.5 text-xs text-warning">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        The triangular module is <strong>watch-only</strong> — it displays the live profit calculation but executes only
        when the net return is positive after three rounds of fees. In practice this rarely occurs.
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="cross">Cross-Exchange Arbitrage</TabsTrigger>
          <TabsTrigger value="triangular">Triangular Arbitrage</TabsTrigger>
        </TabsList>
        <TabsContent value="cross">
          <OpportunityFeed />
        </TabsContent>
        <TabsContent value="triangular">
          <TriangularArbitrageFlow />
        </TabsContent>
      </Tabs>
    </div>
  );
}
