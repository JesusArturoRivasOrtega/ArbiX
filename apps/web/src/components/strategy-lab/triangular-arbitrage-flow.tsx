"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, FlaskConical, Play, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { currency, percent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type TriangularSnapshot = {
  status: string;
  label: string;
  startingAsset: string;
  route: string[];
  startingAmount: number;
  estimatedReturn: number;
  fees: number;
  netReturn: number;
  netReturnPercent: number;
  liveData?: boolean;
  prices?: Record<string, number> | null;
};

type SimResult = {
  executed: boolean;
  id: string;
  route: string[];
  startingAmount: number;
  finalAmount: number;
  netReturn: number;
  netReturnPercent: number;
  fees: number;
  liveData: boolean;
  reason?: string;
  executedAt: string;
};

const FALLBACK: TriangularSnapshot = {
  status: "Live",
  label: "Triangular arbitrage",
  startingAsset: "USDT",
  route: ["USDT", "BTC", "ETH", "USDT"],
  startingAmount: 10000,
  estimatedReturn: 10018,
  fees: 30,
  netReturn: -12,
  netReturnPercent: -0.12
};

const LEG_LABELS = ["USDT -> BTC", "BTC -> ETH", "ETH -> USDT"];

export function TriangularArbitrageFlow() {
  const [snapshot, setSnapshot] = useState<TriangularSnapshot>(FALLBACK);
  const [refreshedAt, setRefreshedAt] = useState<string>(new Date().toISOString());
  const [simulating, setSimulating] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [lastResult, setLastResult] = useState<SimResult | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      api
        .triangular()
        .then((payload) => {
          if (mounted && payload) {
            setSnapshot(payload as TriangularSnapshot);
            setRefreshedAt(new Date().toISOString());
          }
        })
        .catch(() => undefined);
    };
    load();
    const interval = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleSimulate = async () => {
    if (simulating) return;
    setSimulating(true);
    setLastResult(null);

    // Animate each leg sequentially
    for (let step = 0; step < snapshot.route.length - 1; step++) {
      setActiveStep(step);
      await new Promise((r) => window.setTimeout(r, 420));
    }
    setActiveStep(-1);

    try {
      const result = await api.simulateTriangular();
      const sim = result as SimResult;
      setLastResult(sim);

      if (sim.executed) {
        toast.success(
          `Triangular arb executed: +$${sim.netReturn.toFixed(2)}`,
          `${sim.route.join(" -> ")} - ${percent(sim.netReturnPercent)} net`
        );
      } else {
        toast.warning("Simulation not executed", sim.reason ?? "Route was not profitable.");
      }
    } catch {
      toast.danger("Simulation failed", "Could not reach the API.");
    } finally {
      setSimulating(false);
    }
  };

  const profitable = snapshot.netReturn > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-400" />
          Triangular Arbitrage
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{snapshot.label}</Badge>
          <Badge variant={snapshot.liveData === false ? "warning" : profitable ? "success" : "neutral"}>
            {snapshot.liveData === false ? "Demo data" : profitable ? "Profitable route" : "Live monitoring"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Route visualization */}
        <div className="relative flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(8,13,20,0.88))] p-4">
          {snapshot.route.map((node, index) => {
            const isActive = activeStep === index || (simulating && activeStep === -1 && index < snapshot.route.length - 1);
            const isPast = activeStep > index;
            return (
              <div key={`${node}-${index}`} className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-14 min-w-20 items-center justify-center rounded-md border px-4 text-sm font-semibold transition-all duration-300",
                    isActive && "scale-105 border-primary/60 bg-primary/20 text-primary shadow-[0_0_16px_rgba(45,212,191,0.35)]",
                    isPast && "border-success/40 bg-success/10 text-success",
                    !isActive && !isPast && "border-primary/25 text-primary/70"
                  )}
                >
                  {node}
                </div>
                {index < snapshot.route.length - 1 ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <ArrowRight className={cn("h-4 w-4 transition-colors duration-300", activeStep === index ? "route-path text-primary" : "text-muted-foreground")} />
                    <span className="text-[9px] text-muted-foreground">{LEG_LABELS[index]}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Metrics grid */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Starting amount" value={currency(snapshot.startingAmount)} />
          <Metric label="Estimated gross return" value={currency(snapshot.estimatedReturn)} />
          <Metric label="Fees (3 legs x 0.1%)" value={currency(snapshot.fees)} />
          <Metric
            label="Net return"
            value={`${currency(snapshot.netReturn)} (${percent(snapshot.netReturnPercent)})`}
            tone={profitable ? "success" : "danger"}
          />
        </div>

        {/* Live prices */}
        {snapshot.prices ? (
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <PriceChip label="BTC Ask" value={currency(snapshot.prices.btcAsk ?? 0)} />
            <PriceChip label="BTC Bid" value={currency(snapshot.prices.btcBid ?? 0)} />
            <PriceChip label="ETH Ask" value={currency(snapshot.prices.ethAsk ?? 0)} />
            <PriceChip label="ETH Bid" value={currency(snapshot.prices.ethBid ?? 0)} />
            <PriceChip label="ETH/BTC implied" value={(snapshot.prices.impliedEthPerBtc ?? 0).toFixed(6)} />
            <PriceChip label="Last refresh" value={new Date(refreshedAt).toLocaleTimeString()} />
          </div>
        ) : null}

        {/* Simulate button */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={profitable ? "default" : "outline"}
            disabled={simulating}
            onClick={() => void handleSimulate()}
          >
            <Play className="h-4 w-4" />
            {simulating ? "Simulating..." : "Simulate execution"}
          </Button>
          {!profitable ? (
            <span className="text-xs text-muted-foreground">Route is not profitable - simulation will show why</span>
          ) : (
            <span className="text-xs text-success">Profitable route detected - click to simulate</span>
          )}
        </div>

        {/* Last simulation result */}
        {lastResult ? (
          <div
            className={cn(
              "rounded-md border p-4",
              lastResult.executed
                ? "border-success/35 bg-success/10"
                : "border-warning/35 bg-warning/10"
            )}
          >
            <div className="flex items-start gap-3">
              {lastResult.executed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">
                  {lastResult.executed ? "Simulation executed" : "Simulation not executed"}
                </div>
                {lastResult.executed ? (
                  <div className="mt-2 grid gap-1 text-xs">
                    <span className="text-muted-foreground">Net P&L: <span className="font-semibold text-success">+{currency(lastResult.netReturn)}</span></span>
                    <span className="text-muted-foreground">Final USDT: <span className="font-semibold">{currency(lastResult.finalAmount)}</span></span>
                    <span className="text-muted-foreground">Fees paid: <span className="font-semibold text-warning">{currency(lastResult.fees)}</span></span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{lastResult.reason}</p>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(lastResult.executedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold", tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        {value}
      </div>
    </div>
  );
}

function PriceChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-white/10 bg-white/5 px-2 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
