"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ArbitrageOpportunity, RejectionReason, RiskConfig } from "@arbix/shared";
import { cn } from "@/lib/utils";
import { currency, ms, percent } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";

type CheckItem = {
  label: string;
  description: string;
  reasons: RejectionReason[];
  getDetail?: (opp: ArbitrageOpportunity, config: RiskConfig) => string;
};

const CHECKS: CheckItem[] = [
  {
    label: "Net profit positive",
    description: "Net profit after fees/slippage > min threshold",
    reasons: ["NET_PROFIT_NEGATIVE", "BELOW_MIN_PROFIT_THRESHOLD", "FEES_EXCEED_SPREAD"],
    getDetail: (opp, config) => {
      if (opp.rejectionReason === "FEES_EXCEED_SPREAD") {
        const fees = opp.buyFee + opp.sellFee + opp.withdrawalFee;
        return `Fees ${currency(fees)} > gross profit ${currency(opp.grossProfit)}`;
      }
      if (opp.rejectionReason === "BELOW_MIN_PROFIT_THRESHOLD") {
        return `Net ${percent(opp.netProfitPercent, 3)} < min ${percent(config.minNetProfitPercent, 3)}`;
      }
      return `Net ${currency(opp.netProfit)} · ${percent(opp.netProfitPercent, 3)}`;
    }
  },
  {
    label: "Slippage within limit",
    description: "Execution slippage below configured max",
    reasons: ["SLIPPAGE_TOO_HIGH"],
    getDetail: (opp, config) => {
      const buyCost = opp.buyPrice * opp.volume;
      const slippagePct = buyCost > 0 ? (opp.slippageCost / buyCost) * 100 : 0;
      return `${currency(opp.slippageCost)} · ${percent(slippagePct, 3)} vs max ${percent(config.maxSlippagePercent, 2)}`;
    }
  },
  {
    label: "Latency acceptable",
    description: "Order book processing within latency SLA",
    reasons: ["LATENCY_TOO_HIGH"],
    getDetail: (opp, config) =>
      `${ms(opp.latencyMs)} detected · max allowed ${ms(config.maxLatencyMs)}`
  },
  {
    label: "Order book fresh",
    description: "Market data age below stale threshold",
    reasons: ["STALE_ORDER_BOOK"],
    getDetail: (opp, config) =>
      opp.rejectionReason === "STALE_ORDER_BOOK"
        ? `Data exceeded max age of ${ms(config.maxOrderBookAgeMs)}`
        : `Within max age ${ms(config.maxOrderBookAgeMs)}`
  },
  {
    label: "Wallet balance sufficient",
    description: "Enough virtual funds for the trade size",
    reasons: ["INSUFFICIENT_WALLET_BALANCE", "PARTIAL_FILL_NOT_ALLOWED"],
    getDetail: (opp) => {
      const required = opp.buyPrice * opp.volume;
      return `Required ~${currency(required)} · ${opp.volume.toFixed(6)} ${opp.symbol.split("/")[0]}`;
    }
  },
  {
    label: "Circuit breaker off",
    description: "Risk engine not tripped by recent losses",
    reasons: ["CIRCUIT_BREAKER_ACTIVE"],
    getDetail: (opp) =>
      opp.rejectionReason === "CIRCUIT_BREAKER_ACTIVE"
        ? "Circuit breaker was active — all execution paused"
        : "Circuit breaker inactive at detection time"
  },
  {
    label: "Liquidity adequate",
    description: "Order book depth covers the required volume",
    reasons: ["INSUFFICIENT_LIQUIDITY"],
    getDetail: (opp, config) =>
      `Liquidity score ${opp.score.liquidityScore.toFixed(0)}/100 · min ${config.minLiquidityScore}`
  },
  {
    label: "Exchange connected",
    description: "Both buy/sell exchanges reporting live data",
    reasons: ["EXCHANGE_DISCONNECTED", "PRICE_ANOMALY"],
    getDetail: (opp) => `${opp.buyExchange} → ${opp.sellExchange}`
  }
];

interface RejectionChecklistProps {
  opportunity: ArbitrageOpportunity;
}

export function RejectionChecklist({ opportunity }: RejectionChecklistProps) {
  const config = useAnalyticsStore((state) => state.risk.config);

  const isRejected = opportunity.status === "REJECTED" && Boolean(opportunity.rejectionReason);
  const isExecuted = opportunity.status === "EXECUTED";
  const isWatching = opportunity.status === "WATCHING";
  const isExpired = opportunity.status === "EXPIRED";

  if (!isRejected && !isExecuted && !isWatching && !isExpired) return null;

  const failing = opportunity.rejectionReason ?? null;

  const titleMap = {
    EXECUTED: "Risk audit — all checks passed",
    REJECTED: "Rejection audit",
    WATCHING: "Risk audit — pending execution",
    EXPIRED: "Risk audit — expired before execution",
  } as const;
  const title = titleMap[opportunity.status] ?? "Risk audit";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4" data-tour="rejection-checklist">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isExecuted ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : isRejected ? <XCircle className="h-3.5 w-3.5 text-danger" /> : null}
        {title}
      </div>
      <div className="grid gap-1.5">
        {CHECKS.map((check) => {
          const passed = !failing || !check.reasons.includes(failing as RejectionReason);
          const detail = check.getDetail?.(opportunity, config);
          return (
            <div
              key={check.label}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2 text-xs transition-colors",
                passed ? "bg-success/5 border border-success/15" : "bg-danger/8 border border-danger/20"
              )}
            >
              {passed ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("font-semibold", passed ? "text-success" : "text-danger")}>
                    {check.label}
                  </span>
                  <span className="text-muted-foreground">{check.description}</span>
                </div>
                {detail && (
                  <div className={cn("mt-0.5 font-mono text-[11px]", passed ? "text-success/70" : "text-danger/80")}>
                    {detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isRejected && failing ? (
        <div className="mt-3 rounded-md border border-danger/25 bg-danger/8 px-3 py-2 text-xs text-danger">
          <span className="font-semibold">Rejection reason: </span>
          {failing.replace(/_/g, " ")}
          {opportunity.rejectionMessage ? ` — ${opportunity.rejectionMessage}` : ""}
        </div>
      ) : isExecuted ? (
        <div className="mt-3 rounded-md border border-success/20 bg-success/8 px-3 py-2 text-xs text-success">
          All 8 risk checks passed — opportunity was approved and simulated.
        </div>
      ) : null}
    </div>
  );
}
