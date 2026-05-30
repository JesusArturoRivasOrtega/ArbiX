import { describe, expect, it } from "vitest";
import { CostCalculator } from "./cost-calculator.js";
import { SlippageEstimator } from "./slippage-estimator.js";

function makeCalc() {
  return new CostCalculator(new SlippageEstimator());
}

// Base input: profitable scenario
function baseInput(overrides = {}) {
  return {
    buyAskPrice: 100,
    sellBidPrice: 102,
    executionBuyPrice: 100.5,
    executionSellPrice: 101.5,
    amount: 2,
    buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
    sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
    ...overrides
  };
}

describe("CostCalculator", () => {
  it("calculates net profit from VWAP execution prices without double-counting slippage", () => {
    const result = makeCalc().calculate(baseInput());
    expect(result.grossProfit).toBe(4);
    expect(result.buyFee).toBeCloseTo(0.201);
    expect(result.sellFee).toBeCloseTo(0.203);
    expect(result.slippageCost).toBeCloseTo(2);
    expect(result.netProfit).toBeCloseTo(1.596);
  });

  it("produces positive net profit when fees + slippage are small vs spread", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 68000,
      sellBidPrice: 68500,
      executionBuyPrice: 68010,
      executionSellPrice: 68490,
      amount: 0.5,
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }));
    // grossProfit = 500 * 0.5 = 250; fees ≈ 34 + 34; slippage ≈ 10; net ≈ 172
    expect(result.grossProfit).toBeCloseTo(250);
    expect(result.netProfit).toBeGreaterThan(0);
  });

  it("produces negative net profit when fees exceed the spread", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 100,
      sellBidPrice: 100.05, // very tiny spread
      executionBuyPrice: 100,
      executionSellPrice: 100.05,
      amount: 1,
      buyFee: { tradingFeeRate: 0.002, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.002, withdrawalFee: 0 }
    }));
    expect(result.netProfit).toBeLessThan(0);
  });

  it("deducts withdrawal fee from net profit", () => {
    const withoutWithdrawal = makeCalc().calculate(baseInput({
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }));
    const withWithdrawal = makeCalc().calculate(baseInput({
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 5 }
    }));
    expect(withWithdrawal.withdrawalFee).toBe(5);
    expect(withWithdrawal.netProfit).toBeCloseTo(withoutWithdrawal.netProfit - 5);
  });

  it("calculates buy fee as buyCost * tradingFeeRate", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 1000,
      executionBuyPrice: 1000,
      amount: 2,
      buyFee: { tradingFeeRate: 0.002, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0, withdrawalFee: 0 }
    }));
    // buyCost = 1000 * 2 = 2000; buyFee = 2000 * 0.002 = 4
    expect(result.buyCost).toBe(2000);
    expect(result.buyFee).toBeCloseTo(4);
  });

  it("calculates sell fee as sellRevenue * tradingFeeRate", () => {
    const result = makeCalc().calculate(baseInput({
      sellBidPrice: 1010,
      executionSellPrice: 1010,
      amount: 2,
      buyFee: { tradingFeeRate: 0, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.0026, withdrawalFee: 0 }
    }));
    // sellRevenue = 1010 * 2 = 2020; sellFee = 2020 * 0.0026 ≈ 5.252
    expect(result.sellRevenue).toBe(2020);
    expect(result.sellFee).toBeCloseTo(5.252);
  });

  it("calculates netProfitPercent relative to buy cost", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 68000,
      sellBidPrice: 68500,
      executionBuyPrice: 68000,
      executionSellPrice: 68500,
      amount: 1,
      buyFee: { tradingFeeRate: 0, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0, withdrawalFee: 0 }
    }));
    // buyCost = 68000; netProfit = 500; netProfitPercent = 500/68000 * 100 ≈ 0.735
    expect(result.netProfitPercent).toBeCloseTo(0.735, 2);
  });

  it("handles small volume (0.001 BTC) without precision errors", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 68000,
      sellBidPrice: 68200,
      executionBuyPrice: 68000,
      executionSellPrice: 68200,
      amount: 0.001,
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }));
    expect(result.grossProfit).toBeCloseTo(0.2, 4);
    expect(Number.isFinite(result.netProfit)).toBe(true);
    expect(Number.isNaN(result.netProfit)).toBe(false);
  });

  it("handles large volume (100 BTC) without overflow", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 68000,
      sellBidPrice: 68500,
      executionBuyPrice: 68000,
      executionSellPrice: 68500,
      amount: 100,
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }));
    expect(result.grossProfit).toBe(50000);
    expect(Number.isFinite(result.netProfit)).toBe(true);
  });

  it("returns zero gross profit when buy and sell prices are equal", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 100,
      sellBidPrice: 100,
      executionBuyPrice: 100,
      executionSellPrice: 100,
      amount: 1,
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }));
    expect(result.grossSpread).toBe(0);
    expect(result.grossProfit).toBe(0);
    expect(result.netProfit).toBeLessThan(0); // fees still apply
  });

  it("grossSpreadPercent is zero when buyAskPrice is zero (guard against division)", () => {
    const result = makeCalc().calculate(baseInput({
      buyAskPrice: 0,
      sellBidPrice: 0,
      executionBuyPrice: 0,
      executionSellPrice: 0,
      amount: 1,
      buyFee: { tradingFeeRate: 0.001, withdrawalFee: 0 },
      sellFee: { tradingFeeRate: 0.001, withdrawalFee: 0 }
    }));
    expect(result.grossSpreadPercent).toBe(0);
    expect(Number.isNaN(result.grossSpreadPercent)).toBe(false);
  });
});
