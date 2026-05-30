"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Gauge, MonitorPlay, Play, RefreshCcw, ShieldAlert, WalletCards, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useUiStore } from "@/store/ui.store";
import { useWalletStore } from "@/store/wallets.store";
import { HealthPreflight } from "./health-preflight";
import { ScenarioHealthPanel } from "./scenario-health-panel";

const scenarios = [
  { id: "profitable-arbitrage", label: "Profitable", icon: Gauge },
  { id: "rejected-by-fees", label: "Fees reject", icon: ShieldAlert },
  { id: "insufficient-liquidity", label: "Low liquidity", icon: Activity },
  { id: "high-latency-circuit-breaker", label: "High latency", icon: ShieldAlert },
  { id: "last-5-minutes", label: "Last 5 min", icon: WandSparkles }
] as const;

export function DemoControlPanel() {
  const router = useRouter();
  const activeReplay = useUiStore((state) => state.activeReplay);
  const risk = useAnalyticsStore((state) => state.risk);
  const setWallets = useWalletStore((state) => state.setWallets);
  const [presentationBusy, setPresentationBusy] = useState(false);
  const [presentationStatus, setPresentationStatus] = useState<"idle" | "starting" | "ready" | "failed">("idle");
  const [skipBusy, setSkipBusy] = useState(false);

  const runScenario = async (scenario: string, label: string) => {
    try {
      await api.replayScenario(scenario);
      window.dispatchEvent(new Event("arbix:refresh-risk"));
      window.dispatchEvent(new Event("arbix:refresh-analytics"));
      toast.info("Replay scenario started", label);
    } catch (error) {
      toast.danger("Replay failed", (error as Error).message);
    }
  };

  const resetBot = async () => {
    try {
      await api.botReset();
      window.dispatchEvent(new Event("arbix:refresh-risk"));
      window.dispatchEvent(new Event("arbix:refresh-analytics"));
      toast.success("Bot reset", "Market adapters reconnected.");
    } catch (error) {
      toast.danger("Reset failed", (error as Error).message);
    }
  };

  const resetWallets = async () => {
    try {
      const payload = await api.resetWallets();
      setWallets(payload as never);
      window.dispatchEvent(new Event("arbix:refresh-analytics"));
      toast.success("Wallets reset", "Seed balances restored.");
    } catch (error) {
      toast.danger("Wallet reset failed", (error as Error).message);
    }
  };

  /** Quick shortcut for judges: navigate to dashboard, activate DEMO, fire profitable scenario */
  const skipToDemo = async () => {
    setSkipBusy(true);
    try {
      router.push("/dashboard");
      await api.updateConfig({ marketMode: "DEMO" } as never);
      await api.botStart();
      await api.replayScenario("profitable-arbitrage");
      window.dispatchEvent(new Event("arbix:refresh-risk"));
      window.dispatchEvent(new Event("arbix:refresh-analytics"));
      toast.success("Skip to Demo ready", "DEMO mode active — profitable arbitrage scenario running.");
    } catch (error) {
      toast.danger("Skip to Demo failed", (error as Error).message);
    } finally {
      setSkipBusy(false);
    }
  };

  /** One-click demo reset: bot + circuit breaker + wallets + profitable scenario */
  const presentationMode = async () => {
    setPresentationBusy(true);
    setPresentationStatus("starting");
    toast.info("Presentation Mode", "Resetting all state and firing profitable scenario...");
    try {
      await api.botReset();
      await api.clearCircuitBreaker();
      const wallets = await api.resetWallets();
      setWallets(wallets as never);
      await api.replayScenario("profitable-arbitrage");
      window.dispatchEvent(new Event("arbix:refresh-risk"));
      window.dispatchEvent(new Event("arbix:refresh-analytics"));
      setPresentationStatus("ready");
      toast.success("Presentation Mode ready", "Bot reset - Circuit breaker cleared - Wallets seeded - Profitable scenario running.");
    } catch (error) {
      setPresentationStatus("failed");
      toast.danger("Presentation Mode failed", (error as Error).message);
    } finally {
      setPresentationBusy(false);
    }
  };

  return (
    <Card data-tour="demo-control-panel">
      <CardHeader>
        <CardTitle>Demo Control Panel</CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={activeReplay ? "text-info" : "text-muted-foreground"}>
            {activeReplay ? `Replay: ${activeReplay}` : "Ready"}
          </span>
          <span className={risk.circuitBreakerActive ? "text-danger" : "text-success"}>
            {risk.circuitBreakerActive ? "Circuit breaker active" : "Risk nominal"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary CTAs */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="default"
            className="gap-2 bg-primary/90 font-semibold hover:bg-primary"
            onClick={() => void presentationMode()}
            disabled={presentationBusy}
            title="Full reset: bot + wallets + circuit breaker + profitable scenario"
          >
            <MonitorPlay className="h-4 w-4" />
            {presentationBusy ? "Preparing..." : "Presentation Mode"}
          </Button>
          <Button
            variant="secondary"
            className="gap-2 font-semibold"
            onClick={() => void skipToDemo()}
            disabled={skipBusy}
            title="Quick shortcut: DEMO mode + profitable scenario, no reset"
          >
            <Play className="h-4 w-4" />
            {skipBusy ? "Loading..." : "Skip to Demo"}
          </Button>
        </div>
        {presentationStatus === "starting" ? (
          <div
            data-testid="presentation-mode-status"
            className="rounded-md border border-info/25 bg-info/10 px-3 py-2 text-xs font-semibold text-info"
          >
            Starting Presentation Mode: resetting bot, clearing risk and seeding wallets.
          </div>
        ) : presentationStatus === "ready" ? (
          <div
            data-testid="presentation-mode-status"
            className="rounded-md border border-success/25 bg-success/10 px-3 py-2 text-xs font-semibold text-success"
          >
            Presentation Mode ready: bot reset, wallets seeded and profitable replay running.
          </div>
        ) : presentationStatus === "failed" ? (
          <div
            data-testid="presentation-mode-status"
            className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
          >
            Presentation Mode failed. Check API health before the demo.
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => void resetBot()} className="justify-start">
            <RefreshCcw className="h-4 w-4" />
            Reset bot
          </Button>
          <Button variant="outline" onClick={() => void resetWallets()} className="justify-start">
            <WalletCards className="h-4 w-4" />
            Reset wallets
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <Button
                key={scenario.id}
                variant={activeReplay === scenario.id ? "default" : "secondary"}
                onClick={() => void runScenario(scenario.id, scenario.label)}
                className="justify-start"
                data-tour={scenario.id === "profitable-arbitrage" ? "demo-profitable-arbitrage" : undefined}
              >
                <Icon className="h-4 w-4" />
                {scenario.label}
              </Button>
            );
          })}
        </div>

        {/* Health preflight */}
        <HealthPreflight />
        {/* Demo scenarios health */}
        <ScenarioHealthPanel />
      </CardContent>
    </Card>
  );
}
