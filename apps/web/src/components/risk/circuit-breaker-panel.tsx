"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { ms, percent, timeAgo } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

const RISK_TONE = {
  LOW: "success" as const,
  MEDIUM: "info" as const,
  HIGH: "warning" as const,
  CRITICAL: "danger" as const
};

export function CircuitBreakerPanel() {
  const risk = useAnalyticsStore((state) => state.risk);
  const [showConfirm, setShowConfirm] = useState(false);
  const Icon = risk.circuitBreakerActive ? ShieldAlert : ShieldCheck;
  const staleProtection = risk.config.maxOrderBookAgeMs > 0;

  const handleClear = async () => {
    try {
      const updated = await api.clearCircuitBreaker();
      useAnalyticsStore.getState().setRisk(updated as never);
    } catch {
      window.dispatchEvent(new Event("arbix:refresh-risk"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Circuit Breaker</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={RISK_TONE[risk.currentRiskLevel]}>{risk.currentRiskLevel}</Badge>
          <Badge variant={risk.circuitBreakerActive ? "danger" : "success"}>{risk.circuitBreakerActive ? "Active" : "Inactive"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={
            risk.circuitBreakerActive
              ? "flex items-start justify-between gap-3 rounded-md border border-danger/35 bg-danger/10 p-4"
              : "flex items-start justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-4"
          }
        >
          <div className="flex items-start gap-3">
            <Icon className={risk.circuitBreakerActive ? "mt-0.5 h-5 w-5 text-danger" : "mt-0.5 h-5 w-5 text-success"} />
            <div>
              <div className="text-sm font-semibold">{risk.currentRiskLevel} risk</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {risk.reason ?? "Simulated execution is available under current risk limits."}
              </p>
              {risk.lastTriggeredAt ? (
                <div className="mt-1 text-[11px] text-muted-foreground">Last triggered {timeAgo(risk.lastTriggeredAt)}</div>
              ) : null}
            </div>
          </div>
          {risk.circuitBreakerActive ? (
            <Button size="sm" variant="outline" onClick={() => setShowConfirm(true)}>
              <Zap className="h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Rule label="Max latency allowed" value={ms(risk.config.maxLatencyMs)} />
          <Rule
            label="Current highest latency"
            value={ms(risk.currentHighestLatencyMs)}
            tone={risk.currentHighestLatencyMs > risk.config.maxLatencyMs ? "warning" : "default"}
          />
          <Rule label="Max trade size" value={risk.config.maxTradeSize.toFixed(4)} />
          <Rule label="Min net profit threshold" value={percent(risk.config.minNetProfitPercent)} />
          <Rule label="Max order book age" value={ms(risk.config.maxOrderBookAgeMs)} />
          <Rule label="Max slippage" value={percent(risk.config.maxSlippagePercent)} />
          <Rule label="Max rejects / minute" value={risk.config.maxRejectedOpportunitiesPerMinute.toString()} />
          <Rule label="Max negative P&L stop" value={`$${risk.config.maxNegativePnLBeforeStop.toFixed(2)}`} />
          <Rule label="Min liquidity score" value={risk.config.minLiquidityScore.toString()} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Toggle label="Stale data protection" checked={staleProtection} />
          <Toggle label="Partial fills allowed" checked={risk.config.allowPartialFills} />
          <Toggle label="Auto simulation" checked={risk.config.autoSimulationEnabled} />
          <Toggle label="Circuit breaker" checked={risk.config.circuitBreakerEnabled} />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          Configure thresholds and toggles in{" "}
          <Link href="/settings" className="text-primary underline underline-offset-2 hover:opacity-80">
            Settings
          </Link>
        </div>
      </CardContent>
      <ConfirmDialog
        open={showConfirm}
        title="Clear circuit breaker?"
        description="This will resume simulated execution immediately. Make sure market conditions have stabilized before continuing."
        confirmLabel="Yes, clear breaker"
        cancelLabel="Cancel"
        onConfirm={() => { setShowConfirm(false); void handleClear(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </Card>
  );
}

function Rule({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={tone === "warning" ? "mt-1 font-semibold text-warning" : "mt-1 font-semibold"}>{value}</div>
    </div>
  );
}

function Toggle({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} disabled />
    </div>
  );
}
