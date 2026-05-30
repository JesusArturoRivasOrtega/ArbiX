"use client";

import type { CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ms } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

export function ExecutionTimeline() {
  const trade = useAnalyticsStore((state) => state.lastTrade);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Timeline</CardTitle>
        <div className="text-xs text-muted-foreground">Last simulated execution path</div>
      </CardHeader>
      <CardContent>
        {!trade ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">No simulated trade yet</p>
            <p className="mt-1 text-xs">Hit <span className="font-semibold text-primary">Presentation Mode</span> on the Dashboard or run the &ldquo;Profitable&rdquo; replay scenario to see a step-by-step execution breakdown with latency at each stage.</p>
          </div>
        ) : (
          <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-gradient-to-b before:from-success/40 before:via-primary/30 before:to-transparent">
            {trade.timeline.map((step, index) => (
              <li
                key={`${step.label}-${index}`}
                className="timeline-step relative grid grid-cols-[28px_1fr_auto] gap-3"
                style={{ "--step-index": index } as CSSProperties}
              >
                <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-md border border-success/30 bg-success/10 shadow-[0_0_18px_rgba(52,211,153,0.1)]">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <div className="text-sm font-medium">{step.label}</div>
                  {step.detail ? <div className="mt-0.5 text-xs text-muted-foreground">{step.detail}</div> : null}
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">{ms(step.durationMs)}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
