import { Injectable } from "@nestjs/common";
import type { ArbitrageOpportunity, SimulatedTrade } from "@arbix/shared";
import { PersistenceService } from "../database/persistence.service.js";

@Injectable()
export class PnlService {
  private readonly trades: SimulatedTrade[] = [];
  private readonly opportunities: ArbitrageOpportunity[] = [];

  constructor(private readonly persistence: PersistenceService) {}

  recordOpportunity(opportunity: ArbitrageOpportunity) {
    this.opportunities.unshift(opportunity);
    if (this.opportunities.length > 120) {
      this.opportunities.pop();
    }
    this.persistence.saveOpportunity(opportunity);
  }

  recordTrade(trade: SimulatedTrade) {
    this.trades.unshift(trade);
    if (this.trades.length > 200) {
      this.trades.pop();
    }
    this.persistence.saveTrade(trade);
  }

  getTrades() {
    return [...this.trades];
  }

  getOpportunities() {
    this.expireWatching();
    return [...this.opportunities];
  }

  getTotals() {
    return this.trades.reduce(
      (acc, trade) => ({
        netProfit: acc.netProfit + trade.netProfit,
        fees: acc.fees + trade.totalFees,
        slippage: acc.slippage + trade.slippageCost,
        volume: acc.volume + trade.volume
      }),
      { netProfit: 0, fees: 0, slippage: 0, volume: 0 }
    );
  }

  reset() {
    this.trades.splice(0, this.trades.length);
    this.opportunities.splice(0, this.opportunities.length);
  }

  expireWatching(maxAgeMs = 15_000) {
    const now = Date.now();
    for (const opportunity of this.opportunities) {
      if (opportunity.status !== "WATCHING") continue;
      if (now - new Date(opportunity.detectedAt).getTime() > maxAgeMs) {
        opportunity.status = "EXPIRED";
        opportunity.recommendation = "WATCH";
      }
    }
  }
}
