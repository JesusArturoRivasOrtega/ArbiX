import { Injectable } from "@nestjs/common";
import type { CostBreakdown, ExchangeFeeConfig, TradingSymbol } from "@arbix/shared";
import { SlippageEstimator } from "./slippage-estimator.js";

export type CostInput = {
  buyAskPrice: number;
  sellBidPrice: number;
  executionBuyPrice: number;
  executionSellPrice: number;
  amount: number;
  buyFee: ExchangeFeeConfig;
  sellFee: ExchangeFeeConfig;
  symbol?: TradingSymbol;
};

@Injectable()
export class CostCalculator {
  constructor(private readonly slippage: SlippageEstimator) {}

  calculate(input: CostInput): CostBreakdown {
    const buyCost = input.executionBuyPrice * input.amount;
    const sellRevenue = input.executionSellPrice * input.amount;
    const buyFee = buyCost * input.buyFee.tradingFeeRate;
    const sellFee = sellRevenue * input.sellFee.tradingFeeRate;
    const withdrawalFee = calculateWithdrawalFee(input.buyFee, input.symbol, input.sellBidPrice);
    const slippage = this.slippage.estimateSlippage({
      bestAsk: input.buyAskPrice,
      bestBid: input.sellBidPrice,
      executionBuyVwap: input.executionBuyPrice,
      executionSellVwap: input.executionSellPrice,
      amount: input.amount
    });
    const grossSpread = input.sellBidPrice - input.buyAskPrice;
    const grossProfit = (input.sellBidPrice - input.buyAskPrice) * input.amount;
    const netProfit = sellRevenue - sellFee - buyCost - buyFee - withdrawalFee;

    return {
      grossSpread,
      grossSpreadPercent: input.buyAskPrice > 0 ? (grossSpread / input.buyAskPrice) * 100 : 0,
      grossProfit,
      buyCost,
      buyFee,
      sellRevenue,
      sellFee,
      withdrawalFee,
      slippageCost: slippage.slippageCost,
      netProfit,
      netProfitPercent: buyCost > 0 ? (netProfit / buyCost) * 100 : 0,
      buySlippage: slippage.buySlippage,
      buySlippagePercent: slippage.buySlippagePercent,
      sellSlippage: slippage.sellSlippage,
      sellSlippagePercent: slippage.sellSlippagePercent
    };
  }
}

function calculateWithdrawalFee(fee: ExchangeFeeConfig, symbol: TradingSymbol | undefined, sellBidPrice: number) {
  const baseAsset = symbol?.split("/")[0] as keyof NonNullable<ExchangeFeeConfig["withdrawalFeesByAsset"]> | undefined;
  const assetFee = baseAsset ? fee.withdrawalFeesByAsset?.[baseAsset] : undefined;
  if (assetFee !== undefined) {
    return assetFee * sellBidPrice;
  }
  return fee.withdrawalFee;
}
