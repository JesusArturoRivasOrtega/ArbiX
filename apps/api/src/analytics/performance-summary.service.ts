import { Injectable } from "@nestjs/common";
import { MetricsService } from "./metrics.service.js";

@Injectable()
export class PerformanceSummaryService {
  constructor(private readonly metrics: MetricsService) {}

  getExecutiveSummary() {
    const summary = this.metrics.getSummary();
    return {
      headline: "ArbiX detects, evaluates and simulates crypto arbitrage opportunities in real time.",
      netPnl: summary.totalNetProfit,
      detected: summary.totalOpportunities,
      executed: summary.executedOpportunities,
      rejected: summary.rejectedOpportunities,
      averageDetectionLatencyMs: summary.averageDetectionLatencyMs
    };
  }
}
