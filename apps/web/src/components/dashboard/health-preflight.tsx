"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useWalletStore } from "@/store/wallets.store";
import { cn } from "@/lib/utils";

type CheckStatus = "ok" | "warn" | "error" | "loading";

type CheckResult = {
  label: string;
  status: CheckStatus;
  detail?: string;
};

type HealthResponse = {
  status: string;
  database: string;
  botRunning: boolean;
  mode: string;
  symbols: string[];
  services: Record<string, string>;
  exchanges: Array<{ exchange: string; status: string; mode: string; lastMessageAgoMs: number | null; error: string | null }>;
  orderBooks: { count: number; oldestAgeMs: number | null; stale: boolean };
  uptime: number;
};

function statusColor(s: CheckStatus) {
  return {
    ok: "text-success",
    warn: "text-warning",
    error: "text-danger",
    loading: "text-muted-foreground"
  }[s];
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "loading") return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "warn") return <AlertCircle className="h-3.5 w-3.5 text-warning" />;
  return <AlertCircle className="h-3.5 w-3.5 text-danger" />;
}

export function HealthPreflight() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [overall, setOverall] = useState<CheckStatus>("loading");
  const [fixing, setFixing] = useState(false);
  const [fixStatus, setFixStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const setWallets = useWalletStore((state) => state.setWallets);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setOverall("loading");
    setChecks([
      { label: "REST API", status: "loading" },
      { label: "WebSocket gateway", status: "loading" },
      { label: "Database (Prisma)", status: "loading" },
      { label: "Order books (freshness)", status: "loading" },
    ]);

    let health: HealthResponse | null = null;
    let apiStatus: CheckStatus = "error";
    let apiDetail = "Cannot reach API";

    try {
      health = (await api.health()) as HealthResponse;
      apiStatus = "ok";
      apiDetail = `uptime ${health.uptime}s`;
    } catch {
      /* apiStatus/apiDetail already set to error defaults */
    }

    if (health) {
      const dbStatus: CheckStatus = health.database === "connected" ? "ok" : "warn";
      const dbDetail = health.database === "connected" ? "Connected" : "Optional / unavailable";

      let obStatus: CheckStatus = "ok";
      let obDetail = `${health.orderBooks.count} books, max age ${health.orderBooks.oldestAgeMs ?? 0}ms`;
      if (health.orderBooks.stale) {
        obStatus = "warn";
        obDetail = `Oldest book ${health.orderBooks.oldestAgeMs}ms (stale)`;
      } else if (health.orderBooks.count === 0) {
        obStatus = "warn";
        obDetail = "No order books yet";
      }

      const socketConnected =
        typeof window !== "undefined" &&
        (window as unknown as Record<string, unknown>)["__arbix_socket_connected__"] === true;
      const wsStatus: CheckStatus = socketConnected ? "ok" : "warn";
      const wsDetail = socketConnected ? "Connected" : "Not yet connected (will retry)";

      const exchangeChecks: CheckResult[] = health.exchanges.map((ex) => ({
        label: `${ex.exchange} exchange`,
        status: ex.status === "CONNECTED" ? "ok" : ex.status === "CONNECTING" ? "warn" : "error",
        detail: ex.error ?? (ex.lastMessageAgoMs != null ? `last msg ${ex.lastMessageAgoMs}ms ago` : ex.status),
      }));

      // Bot / mode check
      const botCheck: CheckResult = {
        label: "Bot engine",
        status: health.botRunning ? "ok" : "warn",
        detail: health.botRunning ? `Running · ${health.mode} mode · ${health.symbols?.join(", ") ?? ""}` : "Bot not started — press Start"
      };

      // Services checks derived from the /health services block
      const serviceLabels: Record<string, string> = {
        arbitrageEngine: "Arbitrage engine",
        riskEngine: "Risk engine",
        walletService: "Wallet service",
        simulator: "Simulator",
        analyticsService: "Analytics"
      };
      const serviceChecks: CheckResult[] = health.services
        ? Object.entries(health.services)
            .filter(([key]) => key in serviceLabels)
            .map(([key, val]) => ({
              label: serviceLabels[key] ?? key,
              status: val === "ACTIVE" ? "ok" : val === "AVAILABLE" ? "ok" : "warn",
              detail: val === "ACTIVE" ? "Active" : val === "AVAILABLE" ? "Ready" : val
            }))
        : [];

      const all: CheckResult[] = [
        { label: "REST API", status: apiStatus, detail: apiDetail },
        { label: "WebSocket gateway", status: wsStatus, detail: wsDetail },
        { label: "Database (Prisma)", status: dbStatus, detail: dbDetail },
        botCheck,
        { label: "Order books (freshness)", status: obStatus, detail: obDetail },
        ...serviceChecks,
        ...exchangeChecks,
      ];

      const hasError = all.some((c) => c.status === "error");
      const hasWarn = all.some((c) => c.status === "warn");
      setChecks(all);
      setOverall(hasError ? "error" : hasWarn ? "warn" : "ok");
    } else {
      setChecks([
        { label: "REST API", status: apiStatus, detail: apiDetail },
        { label: "WebSocket gateway", status: "error", detail: "API unreachable" },
        { label: "Database (Prisma)", status: "error", detail: "API unreachable" },
        { label: "Order books (freshness)", status: "error", detail: "API unreachable" },
      ]);
      setOverall("error");
    }

    setChecking(false);
  }, []);

  const fixDemoState = useCallback(async () => {
    setFixing(true);
    setFixStatus("busy");
    try {
      await api.botReset();
      await api.clearCircuitBreaker();
      const wallets = await api.resetWallets();
      setWallets(wallets as never);
      await api.replayScenario("profitable-arbitrage");
      window.dispatchEvent(new Event("arbix:refresh-risk"));
      window.dispatchEvent(new Event("arbix:refresh-analytics"));
      setFixStatus("done");
      toast.success("Demo state fixed", "Bot reset · Circuit breaker cleared · Wallets seeded · Profitable scenario running.");
      setTimeout(() => void runChecks(), 2000);
    } catch (error) {
      setFixStatus("error");
      toast.danger("Fix failed", (error as Error).message);
    } finally {
      setFixing(false);
    }
  }, [runChecks, setWallets]);

  useEffect(() => {
    void runChecks();
    // Use setTimeout so the handler never fires synchronously inside a React render cycle
    const handler = () => { setTimeout(() => void runChecks(), 0); };
    window.addEventListener("arbix:socket-status", handler);
    return () => window.removeEventListener("arbix:socket-status", handler);
  }, [runChecks]);

  const overallLabel = { ok: "All systems ready", warn: "Degraded — check warnings", error: "Not ready", loading: "Checking…" }[overall];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4" data-tour="preflight-panel">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <StatusIcon status={overall} />
          <span className={cn("font-semibold", statusColor(overall))}>{overallLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void runChecks()}
            disabled={checking}
            className="h-6 px-2 text-xs"
            data-tour="run-preflight"
          >
            <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
            Recheck
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fixDemoState()}
            disabled={fixing}
            className={cn(
              "h-6 px-2 text-xs gap-1",
              fixStatus === "done" && "border-success/35 text-success",
              fixStatus === "error" && "border-danger/35 text-danger"
            )}
            title="Reset bot · Clear circuit breaker · Seed wallets · Fire profitable scenario"
          >
            <Wrench className={cn("h-3 w-3", fixing && "animate-pulse")} />
            {fixing ? "Fixing…" : fixStatus === "done" ? "Fixed ✓" : "Fix Demo State"}
          </Button>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
              check.status === "ok" && "border-success/15 bg-success/5",
              check.status === "warn" && "border-warning/20 bg-warning/5",
              check.status === "error" && "border-danger/20 bg-danger/5",
              check.status === "loading" && "border-white/10 bg-white/5"
            )}
          >
            <StatusIcon status={check.status} />
            <div>
              <span className={cn("font-semibold", statusColor(check.status))}>{check.label}</span>
              {check.detail ? <span className="ml-1.5 text-muted-foreground">{check.detail}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
