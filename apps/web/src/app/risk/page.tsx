"use client";

import { useAnalyticsStore } from "@/store/analytics.store";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { CircuitBreakerPanel } from "@/components/risk/circuit-breaker-panel";
import { RejectionReasonsChart } from "@/components/risk/rejection-reasons-chart";
import { RiskEventsLog } from "@/components/risk/risk-events-log";
import { ms } from "@/lib/formatters";

export default function RiskPage() {
  const risk = useAnalyticsStore((state) => state.risk);
  const summary = useAnalyticsStore((state) => state.summary);

  const breakerTone = risk.circuitBreakerActive ? "danger" : "success";
  const latencyTone = risk.currentHighestLatencyMs > risk.config.maxLatencyMs ? "danger" : risk.currentHighestLatencyMs > risk.config.maxLatencyMs * 0.7 ? "amber" : "success";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Execution safety"
        title="Risk Center"
        description="Circuit breaker, stale data protection, latency limits and rejection reasons. The bot does not just detect opportunities; it explicitly refuses bad executions."
        iconSrc="/brand/module-risk.png"
        iconAlt="Risk module icon"
        tone="red"
      >
        <HeaderStat
          label="Circuit breaker"
          value={risk.circuitBreakerActive ? "ACTIVE" : "Nominal"}
          tone={breakerTone}
        />
        <HeaderStat
          label="Peak latency"
          value={ms(risk.currentHighestLatencyMs)}
          tone={latencyTone}
        />
        <HeaderStat
          label="Risk level"
          value={risk.currentRiskLevel}
          tone={risk.currentRiskLevel === "LOW" ? "success" : risk.currentRiskLevel === "MEDIUM" ? "blue" : risk.currentRiskLevel === "HIGH" ? "amber" : "danger"}
        />
        <HeaderStat
          label="Rejected"
          value={summary.rejectedOpportunities}
          tone="neutral"
        />
      </PageHeader>
      <CircuitBreakerPanel />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <RejectionReasonsChart />
        <RiskEventsLog />
      </div>
    </div>
  );
}
