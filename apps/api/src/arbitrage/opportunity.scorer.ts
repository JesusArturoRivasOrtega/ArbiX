import { Injectable } from "@nestjs/common";
import type { CostBreakdown, OpportunityScore } from "@arbix/shared";

@Injectable()
export class OpportunityScorer {
  score(input: {
    cost: CostBreakdown;
    filledAmount: number;
    targetAmount: number;
    latencyMs: number;
    maxLatencyMs: number;
    orderBookAgeMs: number;
    circuitBreakerActive: boolean;
    walletOk: boolean;
  }): OpportunityScore {
    if (input.circuitBreakerActive || !input.walletOk) {
      return {
        profitScore: 0,
        liquidityScore: 0,
        latencyScore: 0,
        slippageScore: 0,
        riskPenalty: 100,
        confidence: 0,
        recommendation: "REJECT"
      };
    }

    const profitScore = clamp(input.cost.netProfitPercent / 0.25, 0, 1) * 100;
    const liquidityScore = clamp(input.filledAmount / Math.max(input.targetAmount, 1e-9), 0, 1) * 100;
    const latencyScore = clamp(1 - input.latencyMs / Math.max(input.maxLatencyMs, 1), 0, 1) * 100;
    const slippagePercent = input.cost.buySlippagePercent + input.cost.sellSlippagePercent;
    const slippageScore = clamp(1 - slippagePercent / 0.25, 0, 1) * 100;
    const riskPenalty = input.orderBookAgeMs > 1500 ? 12 : 0;
    const confidence = clamp(
      profitScore * 0.35 + liquidityScore * 0.25 + latencyScore * 0.25 + slippageScore * 0.15 - riskPenalty,
      0,
      100
    );

    return {
      profitScore,
      liquidityScore,
      latencyScore,
      slippageScore,
      riskPenalty,
      confidence,
      recommendation: confidence >= 72 ? "EXECUTE" : confidence >= 45 ? "WATCH" : "REJECT"
    };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
