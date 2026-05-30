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
    // grossProfit uses the true raw spread × volume (before slippage AND fees).
    // Relationship: netProfit = grossProfit − slippageCost − totalFees
    const totalGrossProfit = trades.reduce((sum, trade) => sum + trade.grossProfit, 0);

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
      // Use the true gross spread (before slippage AND fees) so the chart
      // clearly shows: gross − slippage − fees = net.
      gross += trade.grossProfit;
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

/**
 * Sharpe Ratio (per-trade, risk-free rate = 0).
 *
 * Formula: S = mean(r) / std(r)
 *   where r_i = netProfit_i / buyCost_i  (fractional return per trade)
 *
 * Notes:
 *   • Risk-free rate is set to 0, the standard convention for crypto.
 *   • We use population std-dev (÷ N) since we have the full trade universe,
 *     not a sample. Switch to N−1 for sample std-dev if desired.
 *   • This is a per-trade Sharpe — not annualised — because trade duration
 *     varies and annualisation would require a fixed holding period.
 *   • A positive Sharpe indicates risk-adjusted profitability per unit of
 *     return volatility across executed trades.
 */
function computeSharpeRatio(trades: ReturnType<PnlService["getTrades"]>): number {
  if (trades.length < 2) return 0;

  // Use fractional returns (netProfit / buyCost), not absolute USD amounts.
  // This makes the Sharpe scale-independent and comparable across trade sizes.
  const returns = trades
    .filter((t) => t.buyCost > 0)
    .map((t) => t.netProfit / t.buyCost);

  if (returns.length < 2) return 0;

  const n = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  // Population variance (we have the full trade set)
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  if (std === 0) return 0;

  // Sharpe = (mean(r) − rf) / std(r), rf = 0 for crypto
  return Number((mean / std).toFixed(4));
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
