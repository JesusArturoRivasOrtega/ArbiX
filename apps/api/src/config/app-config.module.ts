import { Module } from "@nestjs/common";
import { AppConfigController } from "./app-config.controller.js";
import { AppConfigService } from "./app.config.js";

@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService]
})
export class AppConfigModule {}
