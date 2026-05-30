import { Injectable } from "@nestjs/common";
import type { ArbitrageOpportunity, ExecutionTimelineStep, SimulatedTrade } from "@arbix/shared";
import { uid } from "@arbix/shared";
import { RealtimeEventsService } from "../realtime/realtime-events.service.js";
import { PnlService } from "./pnl.service.js";
import { WalletService } from "./wallet.service.js";

@Injectable()
export class ExecutionSimulator {
  private lastTrade: SimulatedTrade | undefined;

  constructor(
    private readonly wallets: WalletService,
    private readonly pnl: PnlService,
    private readonly realtime: RealtimeEventsService
  ) {}

  simulate(opportunity: ArbitrageOpportunity): SimulatedTrade {
    const started = Date.now();
    const timeline: ExecutionTimelineStep[] = [];
    const push = (label: string, detail?: string) => {
      const timestamp = new Date().toISOString();
      timeline.push({
        label,
        timestamp,
        durationMs: Date.now() - started,
        status: "completed",
        ...(detail ? { detail } : {})
      });
    };

    push("Opportunity detected", `${opportunity.symbol} ${opportunity.buyExchange} -> ${opportunity.sellExchange}`);
    push("Risk checks started", `Confidence ${opportunity.confidence.toFixed(0)}%`);
    push("VWAP calculated", `Buy ${opportunity.executionBuyPrice.toFixed(2)}, sell ${opportunity.executionSellPrice.toFixed(2)}`);
    push("Fees applied", `Total fees ${(opportunity.buyFee + opportunity.sellFee).toFixed(2)}`);
    push("Wallet balances checked");
    push(`Buy ${opportunity.symbol.split("/")[0]} on ${opportunity.buyExchange}`);
    push(`Sell ${opportunity.symbol.split("/")[0]} on ${opportunity.sellExchange}`);
    push("Apply trading fees");
    push("Apply slippage");
    push("Update balances");
    push("Calculate net P&L", `$${opportunity.netProfit.toFixed(2)}`);

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
      totalFees: opportunity.buyFee + opportunity.sellFee + opportunity.withdrawalFee,
      withdrawalFee: opportunity.withdrawalFee,
      slippageCost: opportunity.slippageCost,
      netProfit: opportunity.netProfit,
      status: opportunity.volume < (opportunity.requestedVolume ?? opportunity.volume) - 1e-9 ? "PARTIAL" : "SIMULATED",
      timeline,
      createdAt: new Date().toISOString()
    };

    this.wallets.applyTrade(trade, opportunity);
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
