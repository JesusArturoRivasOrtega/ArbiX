import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { MetricsService } from "../analytics/metrics.service.js";
import { MarketDataService } from "../market-data/market-data.service.js";
import { LatencyMonitor } from "../risk/latency-monitor.js";
import { RiskEngine } from "../risk/risk-engine.js";
import { PnlService } from "../simulator/pnl.service.js";
import { RealtimeEventsService } from "./realtime-events.service.js";

@Injectable()
export class RealtimeBroadcaster implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeBroadcaster.name);
  private interval?: NodeJS.Timeout;

  constructor(
    private readonly realtime: RealtimeEventsService,
    private readonly metrics: MetricsService,
    private readonly risk: RiskEngine,
    private readonly latency: LatencyMonitor,
    private readonly marketData: MarketDataService,
    private readonly pnl: PnlService
  ) {}

  onModuleInit() {
    // Periodic broadcast every 2.5 seconds for continuous updates.
    this.interval = setInterval(() => this.tick(), 2500);

    // Trigger an immediate analytics push whenever a trade is executed,
    // eliminating the up-to-2.5s lag after a simulation fires.
    this.pnl.onTradeRecorded(() => this.tick());
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private tick() {
    try {
      const status = this.marketData.getStatus();
      this.risk.evaluateSystemHealth({
        running: status.running,
        exchangeStatuses: status.exchanges,
        frontendConnectionLost: this.realtime.isFrontendConnectionLost()
      });
      this.realtime.publish("analytics.updated", this.metrics.getSummary());
      this.realtime.publish("risk.status.updated", this.risk.getStatus());
      this.realtime.publish("latency.updated", this.latency.getByExchange());
      this.realtime.publish("exchanges.status.updated", status.exchanges);
      this.realtime.publish("opportunities.updated", this.pnl.getOpportunities());
    } catch (error) {
      this.logger.warn(`Broadcaster tick failed: ${(error as Error).message}`);
    }
  }
}
