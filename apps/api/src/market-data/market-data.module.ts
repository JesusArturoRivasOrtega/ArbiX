import { Module } from "@nestjs/common";
import { ArbitrageModule } from "../arbitrage/arbitrage.module.js";
import { AppConfigModule } from "../config/app-config.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { RiskModule } from "../risk/risk.module.js";
import { MarketDataBufferService } from "./market-data-buffer.service.js";
import { MarketDataController } from "./market-data.controller.js";
import { MarketDataService } from "./market-data.service.js";
import { OrderBookStoreModule } from "./order-book-store.module.js";

@Module({
  imports: [AppConfigModule, ArbitrageModule, RealtimeModule, RiskModule, OrderBookStoreModule],
  controllers: [MarketDataController],
  providers: [MarketDataService, MarketDataBufferService],
  exports: [MarketDataService, MarketDataBufferService]
})
export class MarketDataModule {}
