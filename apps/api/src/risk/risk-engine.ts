import { Injectable } from "@nestjs/common";
import type { CostBreakdown, ExchangeConnectionStatus, OpportunityScore, RejectionReason, RiskStatus } from "@arbix/shared";
import { AppConfigService } from "../config/app.config.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { LatencyMonitor } from "./latency-monitor.js";

export type RiskEvaluationInput = {
  latencyMs: number;
  orderBookAgeMs: number;
  cost: CostBreakdown;
  score: OpportunityScore;
  walletOk: boolean;
  liquidityOk: boolean;
  partialFill: boolean;
  currentNetPnl?: number;
};

export type RiskEvaluation = {
  accepted: boolean;
  reasons: RejectionReason[];
};

@Injectable()
export class RiskEngine {
  private rejectedWindow: number[] = [];

  constructor(
    private readonly config: AppConfigService,
    private readonly breaker: CircuitBreaker,
    private readonly latency: LatencyMonitor
  ) {}

  evaluate(input: RiskEvaluationInput): RiskEvaluation {
    const rules = this.config.risk;
    const reasons: RejectionReason[] = [];

    if (rules.circuitBreakerEnabled && this.breaker.isActive()) reasons.push("CIRCUIT_BREAKER_ACTIVE");
    if (input.cost.netProfit <= 0) reasons.push("NET_PROFIT_NEGATIVE");
    if (input.cost.buyFee + input.cost.sellFee + input.cost.withdrawalFee > input.cost.grossProfit) {
      reasons.push("FEES_EXCEED_SPREAD");
    }
    if (input.cost.netProfitPercent < rules.minNetProfitPercent) reasons.push("BELOW_MIN_PROFIT_THRESHOLD");
    if (input.latencyMs > rules.maxLatencyMs) reasons.push("LATENCY_TOO_HIGH");
    if (input.orderBookAgeMs > rules.maxOrderBookAgeMs) reasons.push("STALE_ORDER_BOOK");
    if (!input.liquidityOk) reasons.push("INSUFFICIENT_LIQUIDITY");
    if (!input.walletOk) reasons.push("INSUFFICIENT_WALLET_BALANCE");
    if (input.cost.buySlippagePercent > rules.maxSlippagePercent || input.cost.sellSlippagePercent > rules.maxSlippagePercent) {
      reasons.push("SLIPPAGE_TOO_HIGH");
    }
    if (input.partialFill && !rules.allowPartialFills) reasons.push("PARTIAL_FILL_NOT_ALLOWED");
    if (input.score.liquidityScore < rules.minLiquidityScore) reasons.push("INSUFFICIENT_LIQUIDITY");

    if (input.currentNetPnl !== undefined && input.currentNetPnl <= rules.maxNegativePnLBeforeStop) {
      reasons.push("CIRCUIT_BREAKER_ACTIVE");
      this.breaker.trigger("Simulated execution paused because cumulative P&L breached the configured stop.", {
        currentNetPnl: input.currentNetPnl,
        threshold: rules.maxNegativePnLBeforeStop
      });
    }

    if (reasons.length > 0) {
      this.recordRejection();
    }

    if (rules.circuitBreakerEnabled && input.latencyMs > rules.maxLatencyMs) {
      this.breaker.trigger("Simulated execution paused due to elevated market risk.", {
        latencyMs: input.latencyMs,
        limit: rules.maxLatencyMs
      });
    }

    if (this.rejectedWindow.length >= rules.maxRejectedOpportunitiesPerMinute) {
      this.breaker.trigger("Too many rejected opportunities in the last minute.", {
        rejectedOpportunities: this.rejectedWindow.length
      });
    }

    return { accepted: reasons.length === 0, reasons: [...new Set(reasons)] };
  }

  evaluateSystemHealth(input: {
    running: boolean;
    exchangeStatuses: ExchangeConnectionStatus[];
    frontendConnectionLost: boolean;
    now?: number;
  }) {
    const rules = this.config.risk;
    if (!rules.circuitBreakerEnabled || !input.running) return;

    const now = input.now ?? Date.now();
    const failedExchange = input.exchangeStatuses.find((status) => status.status === "ERROR" || status.status === "DISCONNECTED");
    if (failedExchange) {
      this.breaker.trigger(`Exchange ${failedExchange.exchange} is ${failedExchange.status.toLowerCase()}.`, {
        exchange: failedExchange.exchange,
        status: failedExchange.status,
        error: failedExchange.error ?? null
      });
      return;
    }

    const staleExchange = input.exchangeStatuses.find(
      (status) => status.lastMessageAt !== undefined && now - status.lastMessageAt > rules.maxOrderBookAgeMs
    );
    if (staleExchange) {
      this.breaker.trigger(`Exchange ${staleExchange.exchange} stopped sending fresh market data.`, {
        exchange: staleExchange.exchange,
        lastMessageAgoMs: now - (staleExchange.lastMessageAt ?? now),
        maxOrderBookAgeMs: rules.maxOrderBookAgeMs
      });
      return;
    }

    if (input.frontendConnectionLost) {
      this.breaker.trigger("Frontend realtime connection lost.", {
        frontendConnected: false
      });
    }
  }

  getStatus(): RiskStatus {
    const reason = this.breaker.getReason();
    const lastTriggeredAt = this.breaker.getLastTriggeredAt();
    return {
      circuitBreakerActive: this.breaker.isActive(),
      ...(reason ? { reason } : {}),
      ...(lastTriggeredAt ? { lastTriggeredAt } : {}),
      currentRiskLevel: this.breaker.isActive() ? "CRITICAL" : this.latency.getHighestLatency() > this.config.risk.maxLatencyMs ? "HIGH" : "LOW",
      config: this.config.risk,
      currentHighestLatencyMs: this.latency.getHighestLatency()
    };
  }

  clearCircuitBreaker() {
    this.breaker.clear();
  }

  private recordRejection() {
    const now = Date.now();
    this.rejectedWindow = this.rejectedWindow.filter((timestamp) => now - timestamp < 60_000);
    this.rejectedWindow.push(now);
  }
}
