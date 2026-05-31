import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { DatabaseModule } from "../database/prisma.module.js";
import { MarketDataModule } from "../market-data/market-data.module.js";
import { RiskModule } from "../risk/risk.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [AppConfigModule, DatabaseModule, MarketDataModule, RiskModule],
  controllers: [HealthController]
})
export class HealthModule {}
