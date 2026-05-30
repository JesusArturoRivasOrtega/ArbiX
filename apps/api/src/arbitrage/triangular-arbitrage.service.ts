import { Injectable, Logger } from "@nestjs/common";
import { uid } from "@arbix/shared";
import { OrderBookStore } from "../market-data/order-book.store.js";
import { WalletService } from "../simulator/wallet.service.js";

// ---------------------------------------------------------------------------
// Triangular Arbitrage — Strategy Lab (watch-only + simulation)
//
// Route: USDT → BTC → ETH → USDT, executed entirely on BINANCE.
//
// All three "legs" are computed from BINANCE prices only:
//   Leg 1 — Buy  BTC with USDT : uses BTC/USDT ask
//   Leg 2 — Sell BTC, buy  ETH : uses implied cross-rate
//            (btcBid / ethAsk) — equivalent to selling BTC for USDT then
//            buying ETH, but expressed as a single cross-rate conversion.
//   Leg 3 — Sell ETH for USDT  : uses ETH/USDT bid
//
// Fees are applied multiplicatively per leg (not a flat 3× on notional),
// which correctly models that each intermediate balance is the fee base:
//   after_leg_n = before_leg_n × (1 − feeRate)
//
// This is a demonstration module. We do NOT have a direct ETH/BTC order
// book, so we derive the cross-rate from the BTC/USDT and ETH/USDT books
// on the same exchange — a standard approximation used in practice.
// ---------------------------------------------------------------------------

const FEE_RATE = 0.001;         // Binance taker fee (0.10%)
const STARTING_AMOUNT = 10_000; // USDT starting capital
const SIMULATION_EXCHANGE = "BINANCE" as const;

export type TriangularSimResult = {
  executed: boolean;
  id: string;
  route: string[];
  startingAmount: number;
  finalAmount: number;
  netReturn: number;
  netReturnPercent: number;
  fees: number;
  prices: {
    btcAsk: number;
    btcBid: number;
    ethAsk: number;
    ethBid: number;
    impliedEthPerBtc: number;
  } | null;
  liveData: boolean;
  reason?: string;
  executedAt: string;
};

@Injectable()
export class TriangularArbitrageService {
  private readonly logger = new Logger(TriangularArbitrageService.name);
  private lastSimulation: TriangularSimResult | null = null;

  constructor(
    private readonly store: OrderBookStore,
    private readonly wallets: WalletService
  ) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  getWatchOnlySnapshot() {
    const route = ["USDT", "BTC", "ETH", "USDT"];
    const prices = this.getBinancePrices();

    if (!prices) {
      return this.fallback(route);
    }

    const result = this.computeRoute(prices);

    return {
      status: "Watch-only",
      label: "Experimental — implied cross-rate triangular arbitrage on Binance",
      note: "All three legs use Binance prices only. Cross-rate ETH/BTC is derived from BTC/USDT and ETH/USDT books.",
      startingAsset: "USDT",
      route,
      startingAmount: STARTING_AMOUNT,
      estimatedReturn: result.finalAmount,
      fees: result.fees,
      netReturn: result.netReturn,
      netReturnPercent: result.netReturnPercent,
      liveData: true,
      prices: prices
    };
  }

  simulate(): TriangularSimResult {
    const route = ["USDT", "BTC", "ETH", "USDT"];
    const now = new Date().toISOString();
    const id = uid("tri");

    const prices = this.getBinancePrices();

    if (!prices) {
      return {
        executed: false, id, route,
        startingAmount: STARTING_AMOUNT, finalAmount: STARTING_AMOUNT,
        netReturn: 0, netReturnPercent: 0, fees: 0,
        prices: null, liveData: false,
        reason: "No Binance market data available", executedAt: now
      };
    }

    const result = this.computeRoute(prices);

    if (result.netReturn <= 0) {
      return {
        executed: false, id, route,
        startingAmount: STARTING_AMOUNT, finalAmount: result.finalAmount,
        netReturn: result.netReturn, netReturnPercent: result.netReturnPercent,
        fees: result.fees, prices, liveData: true,
        reason: `Route yields ${result.netReturn.toFixed(4)} USDT after fees — not profitable`,
        executedAt: now
      };
    }

    const hasBalance = this.wallets.hasBalance(SIMULATION_EXCHANGE, "USDT", STARTING_AMOUNT);
    if (!hasBalance) {
      return {
        executed: false, id, route,
        startingAmount: STARTING_AMOUNT, finalAmount: result.finalAmount,
        netReturn: result.netReturn, netReturnPercent: result.netReturnPercent,
        fees: result.fees, prices, liveData: true,
        reason: `Insufficient USDT balance on ${SIMULATION_EXCHANGE}`,
        executedAt: now
      };
    }

    // Apply only the net P&L delta to the wallet (USDT in, USDT out — net result)
    this.wallets.applyAdjustment(
      SIMULATION_EXCHANGE,
      "USDT",
      result.netReturn,
      "Triangular arb simulation (USDT→BTC→ETH→USDT on Binance)",
      id
    );

    const simResult: TriangularSimResult = {
      executed: true, id, route,
      startingAmount: STARTING_AMOUNT,
      finalAmount: result.finalAmount,
      netReturn: result.netReturn,
      netReturnPercent: result.netReturnPercent,
      fees: result.fees,
      prices,
      liveData: true,
      executedAt: now
    };

    this.lastSimulation = simResult;
    this.logger.log(
      `Triangular arb simulated on ${SIMULATION_EXCHANGE}: ` +
      `+${result.netReturn.toFixed(4)} USDT (${result.netReturnPercent.toFixed(4)}%)`
    );
    return simResult;
  }

  getLastSimulation(): TriangularSimResult | null {
    return this.lastSimulation;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Fetch the best bid/ask for BTC/USDT and ETH/USDT from BINANCE only.
   * Returns null if either pair is unavailable.
   */
  private getBinancePrices(): {
    btcAsk: number;
    btcBid: number;
    ethAsk: number;
    ethBid: number;
    impliedEthPerBtc: number;
  } | null {
    const btcQuote = this.store.getQuote(SIMULATION_EXCHANGE, "BTC/USDT");
    const ethQuote = this.store.getQuote(SIMULATION_EXCHANGE, "ETH/USDT");

    if (!btcQuote || !ethQuote) return null;
    if (btcQuote.askPrice <= 0 || ethQuote.askPrice <= 0) return null;

    // Implied ETH/BTC cross-rate from Binance books:
    //   Sell BTC at btcBid (USDT/BTC) → then buy ETH at ethAsk (USDT/ETH)
    //   ⟹ ETH per BTC = btcBid / ethAsk
    const impliedEthPerBtc = btcQuote.bidPrice / ethQuote.askPrice;

    return {
      btcAsk: btcQuote.askPrice,
      btcBid: btcQuote.bidPrice,
      ethAsk: ethQuote.askPrice,
      ethBid: ethQuote.bidPrice,
      impliedEthPerBtc
    };
  }

  /**
   * Compute the triangular route outcome with multiplicative fees.
   *
   * Leg 1: USDT → BTC
   *   btcObtained = (startingAmount / btcAsk) × (1 − fee)
   *
   * Leg 2: BTC → ETH  (implied cross-rate)
   *   ethObtained = btcObtained × impliedEthPerBtc × (1 − fee)
   *
   * Leg 3: ETH → USDT
   *   finalUSDT = ethObtained × ethBid × (1 − fee)
   *
   * Total fees = startingAmount − (startingAmount × (1-fee)³ × routeReturn)
   * netReturn  = finalUSDT − startingAmount
   */
  private computeRoute(prices: {
    btcAsk: number;
    btcBid: number;
    ethAsk: number;
    ethBid: number;
    impliedEthPerBtc: number;
  }) {
    const afterFee = 1 - FEE_RATE;

    // Leg 1: Buy BTC with USDT at Binance ask
    const btcObtained = (STARTING_AMOUNT / prices.btcAsk) * afterFee;

    // Leg 2: Convert BTC → ETH using implied cross-rate
    //   (equivalent to selling BTC at btcBid then buying ETH at ethAsk)
    const ethObtained = btcObtained * prices.impliedEthPerBtc * afterFee;

    // Leg 3: Sell ETH at Binance bid
    const finalAmount = ethObtained * prices.ethBid * afterFee;

    const netReturn = finalAmount - STARTING_AMOUNT;
    const netReturnPercent = (netReturn / STARTING_AMOUNT) * 100;

    // Gross fees = difference between fee-free route and actual
    const grossReturn = (STARTING_AMOUNT / prices.btcAsk) * prices.impliedEthPerBtc * prices.ethBid;
    const fees = grossReturn - finalAmount;

    return { finalAmount, netReturn, netReturnPercent, fees };
  }

  /**
   * Fallback snapshot used when no Binance live data is available.
   * Returns a clearly flagged non-live result (liveData: false).
   */
  private fallback(route: string[]) {
    return {
      status: "Watch-only",
      label: "Experimental — implied cross-rate triangular arbitrage on Binance",
      note: "All three legs use Binance prices only. Cross-rate ETH/BTC is derived from BTC/USDT and ETH/USDT books.",
      startingAsset: "USDT",
      route,
      startingAmount: STARTING_AMOUNT,
      estimatedReturn: STARTING_AMOUNT,
      fees: STARTING_AMOUNT * FEE_RATE * 3,
      netReturn: 0,
      netReturnPercent: 0,
      liveData: false,
      prices: null
    };
  }
}
