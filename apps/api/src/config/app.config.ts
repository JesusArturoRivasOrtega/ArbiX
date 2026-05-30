import { Injectable, Optional, OnModuleInit } from "@nestjs/common";
import { buildDefaultBotConfig, defaultFees, symbols } from "@arbix/config";
import type { BotConfig, ExchangeFeeConfig, ExchangeName, MarketMode, RiskConfig } from "@arbix/shared";
import { PersistenceService } from "../database/persistence.service.js";

@Injectable()
export class AppConfigService implements OnModuleInit {
  private config: BotConfig = buildDefaultBotConfig();

  constructor(@Optional() private readonly persistence?: PersistenceService) {}

  async onModuleInit() {
    const persisted = await this.persistence?.loadBotConfig();
    if (persisted) {
      this.updateConfig(persisted, { persist: false });
    }
  }

  get marketMode(): MarketMode {
    return this.config.marketMode;
  }

  get enabledExchanges(): ExchangeName[] {
    return [...this.config.enabledExchanges];
  }

  get symbols() {
    return symbols.filter((symbol) => symbol.enabled).map((symbol) => symbol.normalizedSymbol);
  }

  get risk(): RiskConfig {
    const {
      minNetProfitPercent,
      maxTradeSize,
      maxLatencyMs,
      maxOrderBookAgeMs,
      maxSlippagePercent,
      allowPartialFills,
      autoSimulationEnabled,
      circuitBreakerEnabled,
      maxRejectedOpportunitiesPerMinute,
      maxNegativePnLBeforeStop,
      minLiquidityScore
    } = this.config;

    return {
      minNetProfitPercent,
      maxTradeSize,
      maxLatencyMs,
      maxOrderBookAgeMs,
      maxSlippagePercent,
      allowPartialFills,
      autoSimulationEnabled,
      circuitBreakerEnabled,
      maxRejectedOpportunitiesPerMinute,
      maxNegativePnLBeforeStop,
      minLiquidityScore
    };
  }

  get fees(): Record<string, ExchangeFeeConfig> {
    return this.config.fees;
  }

  getConfig(): BotConfig {
    return structuredClone(this.config);
  }

  updateConfig(partial: Partial<BotConfig>, options: { persist?: boolean } = {}): BotConfig {
    this.config = {
      ...this.config,
      ...partial,
      fees: {
        ...defaultFees,
        ...this.config.fees,
        ...(partial.fees ?? {})
      }
    };
    if (options.persist !== false) {
      this.persistence?.saveBotConfig(this.config);
    }
    return this.getConfig();
  }
}
