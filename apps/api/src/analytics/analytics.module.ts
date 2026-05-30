import { Module } from "@nestjs/common";
import { MarketDataModule } from "../market-data/market-data.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { RealtimeBroadcaster } from "../realtime/realtime-broadcaster.service.js";
import { RiskModule } from "../risk/risk.module.js";
import { SimulatorModule } from "../simulator/simulator.module.js";
import { AnalyticsController } from "./analytics.controller.js";
import { MetricsService } from "./metrics.service.js";
import { PerformanceSummaryService } from "./performance-summary.service.js";
import { ReplayService } from "./replay.service.js";

@Module({
  imports: [RealtimeModule, RiskModule, SimulatorModule, MarketDataModule],
  controllers: [AnalyticsController],
  providers: [MetricsService, ReplayService, PerformanceSummaryService, RealtimeBroadcaster],
  exports: [MetricsService, ReplayService, PerformanceSummaryService]
})
export class AnalyticsModule {}
