import { Injectable } from "@nestjs/common";
import type { AnalyticsSummary, RejectionReason } from "@arbix/shared";
import { LatencyMonitor } from "../risk/latency-monitor.js";
import { PnlService } from "../simulator/pnl.service.js";

@Injectable()
export class MetricsService {
  constructor(
    private readonly pnl: PnlService,
    private readonly latency: LatencyMonitor
  ) {}

  getSummary(): AnalyticsSummary {
    const opportunities = this.pnl.getOpportunities();
    const trades = this.pnl.getTrades();
    const rejected = opportunities.filter((opportunity) => opportunity.status === "REJECTED");
    const totalFeesPaid = trades.reduce((sum, trade) => sum + trade.totalFees, 0);
    const totalSlippageCost = trades.reduce((sum, trade) => sum + trade.slippageCost, 0);
    const totalNetProfit = trades.reduce((sum, trade) => sum + trade.netProfit, 0);
    const totalGrossProfit = trades.reduce((sum, trade) => sum + (trade.sellRevenue - trade.buyCost), 0);

    const executedOpportunities = opportunities.filter((opportunity) => opportunity.status === "EXECUTED");
    const bestOpportunity = executedOpportunities.sort((a, b) => b.netProfit - a.netProfit)[0];
    const worstRejectedOpportunity = rejected.sort((a, b) => a.netProfit - b.netProfit)[0];

    return {
      totalOpportunities: opportunities.length,
      executedOpportunities: Math.max(trades.length, executedOpportunities.length),
      rejectedOpportunities: rejected.length,
      expiredOpportunities: opportunities.filter((opportunity) => opportunity.status === "EXPIRED").length,
      totalGrossProfit,
      totalNetProfit,
      totalFeesPaid,
      totalSlippageCost,
      averageDetectionLatencyMs:
        opportunities.length > 0 ? opportunities.reduce((sum, opportunity) => sum + opportunity.latencyMs, 0) / opportunities.length : 0,
      ...(bestOpportunity ? { bestOpportunity } : {}),
      ...(worstRejectedOpportunity ? { worstRejectedOpportunity } : {}),
      cumulativePnl: buildCumulativePnl(trades),
      opportunitiesOverTime: buildOpportunityBuckets(opportunities),
      rejectionReasons: buildRejectionReasons(rejected),
      latencyByExchange: this.latency.getByExchange(),
      volumeByPair: buildVolumeByPair(trades),
      volumeByExchange: buildVolumeByExchange(trades),
      ...(trades.length >= 2 ? { sharpeRatio: computeSharpeRatio(trades) } : {})
    };
  }
}

function buildCumulativePnl(trades: ReturnType<PnlService["getTrades"]>) {
  let net = 0;
  let gross = 0;
  return [...trades]
    .reverse()
    .map((trade) => {
      net += trade.netProfit;
      gross += trade.sellRevenue - trade.buyCost;
      return {
        time: trade.createdAt,
        pnl: net,
        gross,
        net
      };
    })
    .slice(-40);
}

function buildOpportunityBuckets(opportunities: ReturnType<PnlService["getOpportunities"]>) {
  const buckets = new Map<string, { time: string; observed: number; executed: number; rejected: number }>();
  for (const opportunity of opportunities) {
    const time = new Date(opportunity.detectedAt);
    time.setSeconds(0, 0);
    const key = time.toISOString();
    const bucket = buckets.get(key) ?? { time: key, observed: 0, executed: 0, rejected: 0 };
    bucket.observed += 1;
    if (opportunity.status === "EXECUTED") bucket.executed += 1;
    if (opportunity.status === "REJECTED") bucket.rejected += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].slice(-40);
}

function buildRejectionReasons(rejected: ReturnType<PnlService["getOpportunities"]>) {
  const counts = new Map<RejectionReason, number>();
  for (const opportunity of rejected) {
    if (opportunity.rejectionReason) {
      counts.set(opportunity.rejectionReason, (counts.get(opportunity.rejectionReason) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}

function buildVolumeByPair(trades: ReturnType<PnlService["getTrades"]>) {
  const counts = new Map<string, number>();
  for (const trade of trades) {
    counts.set(trade.symbol, (counts.get(trade.symbol) ?? 0) + trade.volume);
  }
  return [...counts.entries()].map(([symbol, volume]) => ({ symbol: symbol as never, volume }));
}

function computeSharpeRatio(trades: ReturnType<PnlService["getTrades"]>): number {
  const profits = trades.map((t) => t.netProfit);
  const mean = profits.reduce((s, v) => s + v, 0) / profits.length;
  const variance = profits.reduce((s, v) => s + (v - mean) ** 2, 0) / profits.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return Number((mean / std).toFixed(3));
}

function buildVolumeByExchange(trades: ReturnType<PnlService["getTrades"]>) {
  const map = new Map<string, { volume: number; notional: number }>();
  for (const trade of trades) {
    const buy = map.get(trade.buyExchange) ?? { volume: 0, notional: 0 };
    buy.volume += trade.volume;
    buy.notional += trade.buyCost;
    map.set(trade.buyExchange, buy);
    const sell = map.get(trade.sellExchange) ?? { volume: 0, notional: 0 };
    sell.volume += trade.volume;
    sell.notional += trade.sellRevenue;
    map.set(trade.sellExchange, sell);
  }
  return [...map.entries()].map(([exchange, value]) => ({ exchange: exchange as never, volume: value.volume, notional: value.notional }));
}
