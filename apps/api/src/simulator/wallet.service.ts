import { Injectable, OnModuleInit } from "@nestjs/common";
import { initialWallets } from "@arbix/config";
import type { ArbitrageOpportunity, ExchangeName, SimulatedTrade, TradingSymbol, WalletBalance, WalletLedgerEntry } from "@arbix/shared";
import { splitSymbol, uid } from "@arbix/shared";
import { PersistenceService } from "../database/persistence.service.js";
import { RealtimeEventsService } from "../realtime/realtime-events.service.js";

/**
 * Minimal shape needed to check wallet affordability. Accepting this structural
 * subset (instead of a full ArbitrageOpportunity) lets the engine validate a
 * candidate before it has built the complete opportunity object.
 */
export type WalletCheckInput = Pick<
  ArbitrageOpportunity,
  "symbol" | "buyExchange" | "sellExchange" | "executionBuyPrice" | "volume" | "buyFee" | "withdrawalFee"
>;

@Injectable()
export class WalletService implements OnModuleInit {
  private balances = new Map<string, WalletBalance>();
  private readonly ledger: WalletLedgerEntry[] = [];

  constructor(
    private readonly realtime: RealtimeEventsService,
    private readonly persistence: PersistenceService
  ) {
    this.seedInMemory(false);
  }

  async onModuleInit() {
    const records = await this.persistence.loadWalletRecords();
    if (records.length === 0) {
      this.seedInMemory(true);
      return;
    }

    this.balances.clear();
    for (const record of records) {
      const wallet: WalletBalance = {
        exchange: record.exchange as ExchangeName,
        asset: record.asset,
        balance: record.balance,
        estimatedUsdValue: this.estimateUsdValue(record.asset, record.balance),
        updatedAt: record.updatedAt.toISOString()
      };
      this.balances.set(this.key(wallet.exchange, wallet.asset), wallet);
    }
    this.realtime.publish("wallet.updated", { balances: this.getBalances(), ledger: this.getLedger() });
  }

  reset() {
    this.seedInMemory(true);
    this.realtime.publish("wallet.updated", { balances: this.getBalances(), ledger: this.getLedger() });
  }

  private seedInMemory(persist: boolean) {
    this.balances.clear();
    this.ledger.splice(0, this.ledger.length);
    const now = new Date().toISOString();
    for (const [exchange, assets] of Object.entries(initialWallets)) {
      for (const [asset, balance] of Object.entries(assets)) {
        const wallet: WalletBalance = {
          exchange: exchange as ExchangeName,
          asset,
          balance,
          estimatedUsdValue: this.estimateUsdValue(asset, balance),
          updatedAt: now
        };
        this.balances.set(this.key(exchange as ExchangeName, asset), wallet);
        if (persist) {
          this.persistence.upsertWallet(wallet);
        }
      }
    }
  }

  getBalances() {
    return [...this.balances.values()];
  }

  getLedger() {
    return this.ledger.slice(0, 100);
  }

  hasBalance(exchange: ExchangeName, asset: string, required: number) {
    return (this.balances.get(this.key(exchange, asset))?.balance ?? 0) >= required;
  }

  canSimulate(opportunity: WalletCheckInput) {
    const { base, quote } = splitSymbol(opportunity.symbol);
    const withdrawalFee = opportunity.withdrawalFee ?? 0;
    const buyRequired = opportunity.executionBuyPrice * opportunity.volume + opportunity.buyFee + withdrawalFee;
    return (
      this.hasBalance(opportunity.buyExchange, quote, buyRequired) &&
      this.hasBalance(opportunity.sellExchange, base, opportunity.volume)
    );
  }

  applyTrade(trade: SimulatedTrade, opportunity: ArbitrageOpportunity) {
    const { base, quote } = splitSymbol(trade.symbol);
    const withdrawalFee = opportunity.withdrawalFee ?? 0;
    const buyDebit = -(opportunity.executionBuyPrice * trade.volume + opportunity.buyFee);
    const sellCredit = opportunity.executionSellPrice * trade.volume - opportunity.sellFee;

    this.applyDelta(opportunity.buyExchange, quote, buyDebit, "Simulated buy cost", trade.id);
    if (withdrawalFee > 0) {
      this.applyDelta(opportunity.buyExchange, quote, -withdrawalFee, "Simulated withdrawal fee", trade.id);
    }
    this.applyDelta(opportunity.buyExchange, base, trade.volume, "Simulated buy fill", trade.id);
    this.applyDelta(opportunity.sellExchange, base, -trade.volume, "Simulated sell fill", trade.id);
    this.applyDelta(opportunity.sellExchange, quote, sellCredit, "Simulated sell proceeds", trade.id);
    this.realtime.publish("wallet.updated", { balances: this.getBalances(), ledger: this.getLedger() });
  }

  applyAdjustment(exchange: ExchangeName, asset: string, change: number, reason: string, tradeId?: string) {
    this.applyDelta(exchange, asset, change, reason, tradeId);
    this.realtime.publish("wallet.updated", { balances: this.getBalances(), ledger: this.getLedger() });
  }

  private applyDelta(exchange: ExchangeName, asset: string, change: number, reason: string, tradeId?: string) {
    const key = this.key(exchange, asset);
    const existing =
      this.balances.get(key) ??
      ({
        exchange,
        asset,
        balance: 0,
        estimatedUsdValue: 0,
        updatedAt: new Date().toISOString()
      } satisfies WalletBalance);
    const updated: WalletBalance = {
      ...existing,
      balance: existing.balance + change,
      estimatedUsdValue: this.estimateUsdValue(asset, existing.balance + change),
      updatedAt: new Date().toISOString(),
      ...(tradeId ? { lastTradeId: tradeId } : {})
    };
    this.balances.set(key, updated);
    const ledgerEntry = {
      id: uid("ledger"),
      exchange,
      asset,
      change,
      balanceAfter: updated.balance,
      reason,
      ...(tradeId ? { tradeId } : {}),
      createdAt: updated.updatedAt
    };
    this.ledger.unshift(ledgerEntry);
    if (this.ledger.length > 200) this.ledger.length = 200;
    this.persistence.upsertWallet(updated);
    this.persistence.saveLedger(ledgerEntry);
  }

  private estimateUsdValue(asset: string, balance: number) {
    // Reference marks (May 2026). Used only for wallet USD-value display;
    // NOT used in any profit calculation. Update periodically if the demo
    // is run in a significantly different market environment.
    const marks: Record<string, number> = { USD: 1, USDT: 1, BTC: 108_000, ETH: 2_848, SOL: 162 };
    return balance * (marks[asset] ?? 0);
  }

  private key(exchange: ExchangeName, asset: string) {
    return `${exchange}:${asset}`;
  }
}
