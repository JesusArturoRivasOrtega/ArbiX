"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type ScenarioResult = "PASS" | "FAIL" | "PASS_WITH_FALLBACK" | "LOADING" | "UNKNOWN";

type ValidationPayload = {
  profitableArbitrage: ScenarioResult;
  rejectedByFees: ScenarioResult;
  insufficientLiquidity: ScenarioResult;
  highLatencyCircuitBreaker: ScenarioResult;
  lastFiveMinutes: ScenarioResult;
  mode: string;
  bufferSize: number;
  checkedAt: string;
};

const SCENARIO_LABELS: { key: keyof Omit<ValidationPayload, "mode" | "bufferSize" | "checkedAt">; label: string }[] = [
  { key: "profitableArbitrage", label: "Profitable Arbitrage" },
  { key: "rejectedByFees", label: "Rejected by Fees" },
  { key: "insufficientLiquidity", label: "Insufficient Liquidity" },
  { key: "highLatencyCircuitBreaker", label: "High Latency / Circuit Breaker" },
  { key: "lastFiveMinutes", label: "Last 5 Minutes" }
];

function ResultIcon({ status }: { status: ScenarioResult }) {
  if (status === "LOADING") return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (status === "PASS") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "PASS_WITH_FALLBACK") return <AlertCircle className="h-3.5 w-3.5 text-warning" />;
  if (status === "FAIL") return <AlertCircle className="h-3.5 w-3.5 text-danger" />;
  return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function statusColor(s: ScenarioResult) {
  if (s === "PASS") return "text-success";
  if (s === "PASS_WITH_FALLBACK") return "text-warning";
  if (s === "FAIL") return "text-danger";
  return "text-muted-foreground";
}

function statusLabel(s: ScenarioResult) {
  if (s === "PASS") return "PASS";
  if (s === "PASS_WITH_FALLBACK") return "PASS (fallback)";
  if (s === "FAIL") return "FAIL";
  if (s === "LOADING") return "Checking…";
  return "—";
}

const LOADING_STATE: ValidationPayload = {
  profitableArbitrage: "LOADING",
  rejectedByFees: "LOADING",
  insufficientLiquidity: "LOADING",
  highLatencyCircuitBreaker: "LOADING",
  lastFiveMinutes: "LOADING",
  mode: "—",
  bufferSize: 0,
  checkedAt: ""
};

export function ScenarioHealthPanel() {
  const [result, setResult] = useState<ValidationPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api.validateScenarios();
      setResult(payload as ValidationPayload);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void validate();
  }, [validate]);

  const display = loading ? LOADING_STATE : result;
  const allPass = result && SCENARIO_LABELS.every(({ key }) => result[key] !== "FAIL");

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {allPass ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={cn("font-semibold", allPass ? "text-success" : "text-muted-foreground")}>
            {loading ? "Validating scenarios…" : allPass ? "All scenarios ready" : result ? "Degraded — check warnings" : "Not validated yet"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void validate()}
          disabled={loading}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Validate
        </Button>
      </div>

      {display ? (
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {SCENARIO_LABELS.map(({ key, label }) => {
            const status = display[key];
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                  status === "PASS" && "border-success/15 bg-success/5",
                  status === "PASS_WITH_FALLBACK" && "border-warning/20 bg-warning/5",
                  status === "FAIL" && "border-danger/20 bg-danger/5",
                  (status === "LOADING" || status === "UNKNOWN") && "border-white/10 bg-white/5"
                )}
              >
                <ResultIcon status={status} />
                <div className="min-w-0 flex-1">
                  <span className={cn("font-semibold", statusColor(status))}>{label}</span>
                </div>
                <span className={cn("shrink-0 tabular-nums", statusColor(status))}>{statusLabel(status)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
          API unreachable — cannot validate scenarios
        </div>
      )}

      {result?.mode && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <span>Mode: <span className="font-semibold text-foreground">{result.mode}</span></span>
          <span>Buffer: <span className="font-semibold text-foreground">{result.bufferSize} events</span></span>
          {result.checkedAt && (
            <span>Validated at {new Date(result.checkedAt).toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </div>
  );
}
