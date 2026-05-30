"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useUiStore } from "@/store/ui.store";

const SCENARIOS = [
  { id: "profitable-arbitrage", label: "Profitable arbitrage" },
  { id: "rejected-by-fees", label: "Rejected by fees" },
  { id: "insufficient-liquidity", label: "Insufficient liquidity" },
  { id: "high-latency-circuit-breaker", label: "High latency / circuit breaker" },
  { id: "last-5-minutes", label: "Replay last 5 minutes" }
] as const;

export function ReplayMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeReplay = useUiStore((state) => state.activeReplay);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClickAway);
    return () => window.removeEventListener("mousedown", onClickAway);
  }, []);

  const run = (scenario: string, label: string) => {
    void api
      .replayScenario(scenario)
      .then(() => {
        window.dispatchEvent(new Event("arbix:refresh-risk"));
        window.dispatchEvent(new Event("arbix:refresh-analytics"));
        toast.info("Replay scenario started", label);
      })
      .catch(() => toast.danger("Replay failed", "Could not reach the API."));
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref} data-tour="replay-menu">
      <Button
        variant={activeReplay ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen((value) => !value)}
        className={activeReplay ? "replay-active-pulse" : undefined}
      >
        <WandSparkles className="h-4 w-4" />
        {activeReplay ? "Replaying…" : "Replay"}
        <ChevronDown className="h-3 w-3" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-white/10 bg-[#0a0d12]/96 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase text-muted-foreground">Scenarios</div>
          <div className="grid gap-1">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => run(scenario.id, scenario.label)}
                className={`flex items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-all duration-150 hover:bg-primary/10 ${activeReplay === scenario.id ? "bg-primary/15 text-primary font-semibold" : "text-foreground"}`}
              >
                <span>{scenario.label}</span>
                {activeReplay === scenario.id ? (
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-primary" />
                ) : (
                  <WandSparkles className="h-3 w-3 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
