import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { MarketDataModule } from "../market-data/market-data.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [AppConfigModule, MarketDataModule],
  controllers: [HealthController]
})
export class HealthModule {}
