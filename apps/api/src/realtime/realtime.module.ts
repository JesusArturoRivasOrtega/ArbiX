import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { RealtimeEventsService } from "./realtime-events.service.js";
import { TradingGateway } from "./trading.gateway.js";

@Module({
  imports: [AppConfigModule],
  providers: [RealtimeEventsService, TradingGateway],
  exports: [RealtimeEventsService]
})
export class RealtimeModule {}
