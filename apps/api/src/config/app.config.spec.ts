import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AppConfigService } from "./app.config.js";

function makeService() {
  const persistence = {
    saveBotConfig: vi.fn(),
    loadBotConfig: vi.fn()
  };
  return { service: new AppConfigService(persistence as never), persistence };
}

describe("AppConfigService", () => {
  it("accepts valid runtime risk updates", () => {
    const { service } = makeService();
    const updated = service.updateConfig({ minNetProfitPercent: 0.1, maxTradeSize: 0.2 });

    expect(updated.minNetProfitPercent).toBe(0.1);
    expect(updated.maxTradeSize).toBe(0.2);
  });

  it("rejects negative fees", () => {
    const { service } = makeService();

    expect(() =>
      service.updateConfig({
        fees: {
          BINANCE: { tradingFeeRate: -0.001, withdrawalFee: 0 }
        } as never
      })
    ).toThrow(BadRequestException);
  });

  it("deep merges partial fee updates per exchange", () => {
    const { service } = makeService();
    const before = service.getConfig().fees.BINANCE!;

    const updated = service.updateConfig({
      fees: {
        BINANCE: { tradingFeeRate: 0.002 }
      } as never
    });

    expect(updated.fees.BINANCE?.tradingFeeRate).toBe(0.002);
    expect(updated.fees.BINANCE?.withdrawalFee).toBe(before.withdrawalFee);
  });

  it("rejects positive max negative P&L stop", () => {
    const { service } = makeService();

    expect(() => service.updateConfig({ maxNegativePnLBeforeStop: 100 })).toThrow(BadRequestException);
  });

  it("rejects empty exchange lists", () => {
    const { service } = makeService();

    expect(() => service.updateConfig({ enabledExchanges: [] })).toThrow(BadRequestException);
  });
});
