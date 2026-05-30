import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { BotConfig } from "@arbix/shared";
import { MarketDataService } from "../market-data/market-data.service.js";
import { AppConfigService } from "./app.config.js";

@Controller("config")
export class AppConfigController {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly moduleRef: ModuleRef
  ) {}

  @Get()
  getConfig() {
    return this.appConfig.getConfig();
  }

  @Patch()
  async updateConfig(@Body() payload: Partial<BotConfig>) {
    const before = this.appConfig.getConfig();
    const updated = this.appConfig.updateConfig(payload);
    if (requiresAdapterRestart(before, updated)) {
      await this.moduleRef.get(MarketDataService, { strict: false }).reset();
    }
    return updated;
  }
}

function requiresAdapterRestart(before: BotConfig, after: BotConfig) {
  if (before.marketMode !== after.marketMode) return true;
  return before.enabledExchanges.slice().sort().join("|") !== after.enabledExchanges.slice().sort().join("|");
}
