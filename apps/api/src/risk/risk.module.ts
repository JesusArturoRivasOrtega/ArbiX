import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { LatencyMonitor } from "./latency-monitor.js";
import { PriceAnomalyGuard } from "./price-anomaly.guard.js";
import { RiskController } from "./risk.controller.js";
import { RiskEngine } from "./risk-engine.js";
import { StaleDataGuard } from "./stale-data.guard.js";

@Module({
  imports: [AppConfigModule, RealtimeModule],
  controllers: [RiskController],
  providers: [CircuitBreaker, LatencyMonitor, RiskEngine, StaleDataGuard, PriceAnomalyGuard],
  exports: [CircuitBreaker, LatencyMonitor, RiskEngine, StaleDataGuard, PriceAnomalyGuard]
})
export class RiskModule {}
