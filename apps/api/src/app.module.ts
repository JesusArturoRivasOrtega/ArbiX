import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { ArbitrageModule } from "./arbitrage/arbitrage.module.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { DatabaseModule } from "./database/prisma.module.js";
import { HealthModule } from "./health/health.module.js";
import { MarketDataModule } from "./market-data/market-data.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { RiskModule } from "./risk/risk.module.js";
import { SimulatorModule } from "./simulator/simulator.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
    AppConfigModule,
    DatabaseModule,
    RealtimeModule,
    RiskModule,
    SimulatorModule,
    ArbitrageModule,
    MarketDataModule,
    AnalyticsModule,
    HealthModule
  ]
})
export class AppModule {}
