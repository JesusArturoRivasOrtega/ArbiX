import { BadRequestException, Injectable, Optional, OnModuleInit } from "@nestjs/common";
import { buildDefaultBotConfig, defaultFees, symbols } from "@arbix/config";
import { EXCHANGES } from "@arbix/shared";
import type { BotConfig, ExchangeFeeConfig, ExchangeName, MarketMode, RiskConfig } from "@arbix/shared";
import { PersistenceService } from "../database/persistence.service.js";

const MARKET_MODES: MarketMode[] = ["LIVE", "DEMO", "REPLAY"];
const EXCHANGE_SET = new Set<string>(EXCHANGES);

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
    const fees = mergeFees(this.config.fees, partial.fees);
    const next = {
      ...this.config,
      ...partial,
      fees
    };
    validateConfig(next);
    this.config = next;
    if (options.persist !== false) {
      this.persistence?.saveBotConfig(this.config);
    }
    return this.getConfig();
  }
}

function mergeFees(current: Record<string, ExchangeFeeConfig>, partial?: Partial<Record<string, Partial<ExchangeFeeConfig>>>) {
  const merged: Record<string, ExchangeFeeConfig> = { ...defaultFees, ...current };
  for (const [exchange, fee] of Object.entries(partial ?? {})) {
    merged[exchange] = {
      ...(merged[exchange] ?? { tradingFeeRate: 0, withdrawalFee: 0 }),
      ...fee
    };
  }
  return merged;
}

function validateConfig(config: BotConfig) {
  if (!MARKET_MODES.includes(config.marketMode)) {
    throw new BadRequestException("marketMode must be LIVE, DEMO or REPLAY");
  }
  if (!Array.isArray(config.enabledExchanges) || config.enabledExchanges.length === 0) {
    throw new BadRequestException("At least one exchange must be enabled");
  }
  for (const exchange of config.enabledExchanges) {
    if (!EXCHANGE_SET.has(exchange)) {
      throw new BadRequestException(`Unsupported exchange: ${exchange}`);
    }
  }

  assertNumber("minNetProfitPercent", config.minNetProfitPercent, 0, 10);
  assertNumber("maxTradeSize", config.maxTradeSize, 0.000001, 100);
  assertNumber("maxLatencyMs", config.maxLatencyMs, 1, 60_000);
  assertNumber("maxOrderBookAgeMs", config.maxOrderBookAgeMs, 1, 60_000);
  assertNumber("maxSlippagePercent", config.maxSlippagePercent, 0, 25);
  assertNumber("maxRejectedOpportunitiesPerMinute", config.maxRejectedOpportunitiesPerMinute, 1, 100_000);
  assertNumber("maxNegativePnLBeforeStop", config.maxNegativePnLBeforeStop, -1_000_000, -0.01);
  assertNumber("minLiquidityScore", config.minLiquidityScore, 0, 100);

  assertBoolean("allowPartialFills", config.allowPartialFills);
  assertBoolean("autoSimulationEnabled", config.autoSimulationEnabled);
  assertBoolean("circuitBreakerEnabled", config.circuitBreakerEnabled);

  for (const [exchange, fee] of Object.entries(config.fees)) {
    if (!EXCHANGE_SET.has(exchange)) {
      throw new BadRequestException(`Unsupported fee exchange: ${exchange}`);
    }
    assertNumber(`${exchange}.tradingFeeRate`, fee.tradingFeeRate, 0, 0.1);
    assertNumber(`${exchange}.withdrawalFee`, fee.withdrawalFee, 0, 1_000_000);
  }
}

function assertNumber(name: string, value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${name} must be between ${min} and ${max}`);
  }
}

function assertBoolean(name: string, value: boolean) {
  if (typeof value !== "boolean") {
    throw new BadRequestException(`${name} must be a boolean`);
  }
}
