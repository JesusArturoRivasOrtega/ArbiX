import { Injectable, Logger } from "@nestjs/common";
import { uid } from "@arbix/shared";
import { OrderBookStore } from "../market-data/order-book.store.js";
import { WalletService } from "../simulator/wallet.service.js";

const FEE_PER_LEG = 0.001;
const STARTING_AMOUNT = 10_000;
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
  prices: Record<string, number> | null;
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

  getWatchOnlySnapshot() {
    const route = ["USDT", "BTC", "ETH", "USDT"];

    const btcQuotes = this.store.getQuotesBySymbol("BTC/USDT");
    const ethQuotes = this.store.getQuotesBySymbol("ETH/USDT");

    if (btcQuotes.length === 0 || ethQuotes.length === 0) {
      return this.fallback(route);
    }

    // Best prices across all exchanges
    const btcAsk = Math.min(...btcQuotes.map((q) => q.askPrice));
    const btcBid = Math.max(...btcQuotes.map((q) => q.bidPrice));
    const ethAsk = Math.min(...ethQuotes.map((q) => q.askPrice));
    const ethBid = Math.max(...ethQuotes.map((q) => q.bidPrice));

    // Leg 1: Buy BTC with USDT
    const btcObtained = STARTING_AMOUNT / btcAsk;

    // Leg 2: Sell BTC, buy ETH - implied cross rate via best USD legs
    const impliedEthPerBtc = btcBid / ethAsk;
    const ethObtained = btcObtained * impliedEthPerBtc;

    // Leg 3: Sell ETH for USDT
    const finalUsdt = ethObtained * ethBid;

    // Fees: 3 legs x fee rate x starting notional
    const fees = STARTING_AMOUNT * FEE_PER_LEG * 3;
    const estimatedReturn = finalUsdt;
    const netReturn = estimatedReturn - fees - STARTING_AMOUNT;
    const netReturnPercent = (netReturn / STARTING_AMOUNT) * 100;

    return {
      status: "Watch-only",
      label: "Experimental module",
      startingAsset: "USDT",
      route,
      startingAmount: STARTING_AMOUNT,
      estimatedReturn,
      fees,
      netReturn,
      netReturnPercent,
      liveData: true,
      prices: {
        btcAsk,
        btcBid,
        ethAsk,
        ethBid,
        impliedEthPerBtc
      }
    };
  }

  simulate(): TriangularSimResult {
    const snapshot = this.getWatchOnlySnapshot();
    const now = new Date().toISOString();
    const id = uid("tri");

    if (!snapshot.liveData) {
      return {
        executed: false, id, route: snapshot.route,
        startingAmount: STARTING_AMOUNT, finalAmount: STARTING_AMOUNT,
        netReturn: 0, netReturnPercent: 0, fees: snapshot.fees,
        prices: null, liveData: false,
        reason: "No live market data available", executedAt: now
      };
    }

    if (snapshot.netReturn <= 0) {
      return {
        executed: false, id, route: snapshot.route,
        startingAmount: STARTING_AMOUNT, finalAmount: snapshot.estimatedReturn - snapshot.fees,
        netReturn: snapshot.netReturn, netReturnPercent: snapshot.netReturnPercent,
        fees: snapshot.fees, prices: snapshot.prices as Record<string, number>,
        liveData: true,
        reason: `Route yields ${snapshot.netReturn.toFixed(2)} USDT - not profitable after fees`,
        executedAt: now
      };
    }

    const hasBalance = this.wallets.hasBalance(SIMULATION_EXCHANGE, "USDT", STARTING_AMOUNT);
    if (!hasBalance) {
      return {
        executed: false, id, route: snapshot.route,
        startingAmount: STARTING_AMOUNT, finalAmount: snapshot.estimatedReturn - snapshot.fees,
        netReturn: snapshot.netReturn, netReturnPercent: snapshot.netReturnPercent,
        fees: snapshot.fees, prices: snapshot.prices as Record<string, number>,
        liveData: true,
        reason: `Insufficient USDT balance on ${SIMULATION_EXCHANGE}`,
        executedAt: now
      };
    }

    // Apply net P&L to wallet - USDT change = netReturn
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.wallets as any).applyDelta(SIMULATION_EXCHANGE, "USDT", snapshot.netReturn, "Triangular arb simulation", id);

    const result: TriangularSimResult = {
      executed: true, id, route: snapshot.route,
      startingAmount: STARTING_AMOUNT,
      finalAmount: snapshot.estimatedReturn - snapshot.fees,
      netReturn: snapshot.netReturn, netReturnPercent: snapshot.netReturnPercent,
      fees: snapshot.fees, prices: snapshot.prices as Record<string, number>,
      liveData: true, executedAt: now
    };

    this.lastSimulation = result;
    this.logger.log(`Triangular arb simulated: net +${snapshot.netReturn.toFixed(2)} USDT`);
    return result;
  }

  getLastSimulation(): TriangularSimResult | null {
    return this.lastSimulation;
  }

  private fallback(route: string[]) {
    const estimatedReturn = STARTING_AMOUNT * 1.0018;
    const fees = STARTING_AMOUNT * FEE_PER_LEG * 3;
    const netReturn = estimatedReturn - fees - STARTING_AMOUNT;
    return {
      status: "Watch-only",
      label: "Experimental module",
      startingAsset: "USDT",
      route,
      startingAmount: STARTING_AMOUNT,
      estimatedReturn,
      fees,
      netReturn,
      netReturnPercent: (netReturn / STARTING_AMOUNT) * 100,
      liveData: false,
      prices: null
    };
  }
}
