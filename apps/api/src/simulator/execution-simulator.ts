import { Injectable } from "@nestjs/common";
import type { ArbitrageOpportunity, ExecutionTimelineStep, SimulatedTrade } from "@arbix/shared";
import { uid } from "@arbix/shared";
import { RealtimeEventsService } from "../realtime/realtime-events.service.js";
import { PnlService } from "./pnl.service.js";
import { WalletService } from "./wallet.service.js";

// ---------------------------------------------------------------------------
// Realistic execution timeline durations
//
// In a real arbitrage system each step has measurable latency:
//   • Opportunity detection: 0ms   (baseline reference)
//   • Risk checks:           3–6ms (rule evaluation)
//   • VWAP calculation:      4–8ms (order-book walk)
//   • Fee computation:       1–3ms (arithmetic)
//   • Wallet check:          2–4ms (balance lookup)
//   • Send buy order:       10–20ms (network round-trip simulation)
//   • Send sell order:      10–20ms (network round-trip simulation)
//   • Apply fees ledger:     2–4ms  (write)
//   • Apply slippage:        1–2ms  (compute)
//   • Update balances:       3–6ms  (persistence)
//   • Calculate P&L:         1–2ms  (arithmetic)
//
// We derive per-trade jitter from the opportunity's latencyMs so every
// execution shows slightly different (but realistic) timings.
// ---------------------------------------------------------------------------

/** Base cumulative durations (ms) for each of the 11 execution steps. */
const BASE_CUMULATIVE_MS = [0, 4, 8, 11, 14, 24, 34, 37, 39, 44, 46];

/**
 * Build a realistic cumulative duration profile for a single execution.
 * Jitter = (latencyMs mod 13) gives 0–12ms of per-trade variation spread
 * across steps, making every timeline look distinct without randomness.
 */
function buildDurations(latencyMs: number): number[] {
  const jitter = latencyMs % 13;
  return BASE_CUMULATIVE_MS.map((base, index) => {
    // Distribute jitter gradually: earlier steps get less, later ones more
    const extra = Math.floor((jitter * index) / (BASE_CUMULATIVE_MS.length - 1));
    return base + extra;
  });
}

@Injectable()
export class ExecutionSimulator {
  private lastTrade: SimulatedTrade | undefined;

  constructor(
    private readonly wallets: WalletService,
    private readonly pnl: PnlService,
    private readonly realtime: RealtimeEventsService
  ) {}

  simulate(opportunity: ArbitrageOpportunity): SimulatedTrade {
    const startedAt = new Date().toISOString();
    const durations = buildDurations(opportunity.latencyMs);
    const timeline: ExecutionTimelineStep[] = [];

    const push = (index: number, label: string, detail?: string, status: ExecutionTimelineStep["status"] = "completed"): void => {
      timeline.push({
        label,
        timestamp: startedAt,
        durationMs: durations[index] ?? 0,
        status,
        ...(detail !== undefined ? { detail } : {})
      });
    };

    const base = opportunity.symbol.split("/")[0] ?? "BTC";
    const walletOk = this.wallets.canSimulate(opportunity);

    push(0,  "Opportunity detected",   `${opportunity.symbol} ${opportunity.buyExchange} -> ${opportunity.sellExchange}`);
    push(1,  "Risk checks started",    `Confidence ${opportunity.confidence.toFixed(0)}%`);
    push(2,  "VWAP calculated",        `Buy ${opportunity.executionBuyPrice.toFixed(2)}, sell ${opportunity.executionSellPrice.toFixed(2)}`);
    push(3,  "Fees applied",           `Total fees $${(opportunity.buyFee + opportunity.sellFee).toFixed(2)}`);
    push(4,  "Wallet balances checked", walletOk ? undefined : "Execution aborted: balance changed before order submission.", walletOk ? "completed" : "failed");
    push(5,  `Buy ${base} on ${opportunity.buyExchange}`, undefined, walletOk ? "completed" : "skipped");
    push(6,  `Sell ${base} on ${opportunity.sellExchange}`, undefined, walletOk ? "completed" : "skipped");
    push(7,  "Apply trading fees", undefined, walletOk ? "completed" : "skipped");
    push(8,  "Apply slippage", undefined, walletOk ? "completed" : "skipped");
    push(9,  "Update balances", undefined, walletOk ? "completed" : "skipped");
    push(10, "Calculate net P&L",      walletOk ? `$${opportunity.netProfit.toFixed(2)}` : "$0.00", walletOk ? "completed" : "skipped");

    const trade: SimulatedTrade = {
      id: uid("trade"),
      opportunityId: opportunity.id,
      symbol: opportunity.symbol,
      buyExchange: opportunity.buyExchange,
      sellExchange: opportunity.sellExchange,
      volume: opportunity.volume,
      requestedVolume: opportunity.requestedVolume ?? opportunity.volume,
      buyCost: opportunity.executionBuyPrice * opportunity.volume,
      sellRevenue: opportunity.executionSellPrice * opportunity.volume,
      // grossProfit = raw spread × volume (before slippage AND fees)
      grossProfit: opportunity.grossProfit,
      totalFees: opportunity.buyFee + opportunity.sellFee + opportunity.withdrawalFee,
      withdrawalFee: opportunity.withdrawalFee,
      slippageCost: opportunity.slippageCost,
      netProfit: walletOk ? opportunity.netProfit : 0,
      status: walletOk ? (opportunity.volume < (opportunity.requestedVolume ?? opportunity.volume) - 1e-9 ? "PARTIAL" : "SIMULATED") : "FAILED",
      timeline,
      createdAt: startedAt
    };

    if (walletOk) {
      this.wallets.applyTrade(trade, opportunity);
    }
    this.pnl.recordTrade(trade);
    this.lastTrade = trade;
    this.realtime.publish("trade.simulated", trade);
    this.realtime.publish("pnl.updated", this.pnl.getTotals());
    return trade;
  }

  getLastTrade() {
    return this.lastTrade;
  }

  reset() {
    this.lastTrade = undefined;
  }
}
