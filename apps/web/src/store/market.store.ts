"use client";

import { create } from "zustand";
import type { BestQuote, BotStatus, ExchangeConnectionStatus, MarketMode, MarketSnapshot } from "@arbix/shared";
import { demoExchangeStatus, demoMarket } from "@/lib/demo-data";

type BotState = {
  status: BotStatus;
  mode: MarketMode;
  message: string;
  connected: boolean;
};

type MarketStore = {
  snapshots: MarketSnapshot[];
  exchanges: ExchangeConnectionStatus[];
  bot: BotState;
  symbolFilter: "ALL" | "BTC/USDT" | "ETH/USDT" | "SOL/USDT";
  setSnapshots: (snapshots: MarketSnapshot[]) => void;
  setExchangeStatus: (exchanges: ExchangeConnectionStatus[]) => void;
  upsertQuote: (quote: BestQuote) => void;
  setBot: (bot: Partial<BotState>) => void;
  setSymbolFilter: (symbol: MarketStore["symbolFilter"]) => void;
};

export const useMarketStore = create<MarketStore>((set) => ({
  snapshots: demoMarket,
  exchanges: demoExchangeStatus,
  bot: {
    status: "RUNNING",
    mode: "DEMO",
    message: "Demo mode is using controlled synthetic market events for presentation reliability.",
    connected: false
  },
  symbolFilter: "ALL",
  setSnapshots: (snapshots) => set({ snapshots }),
  setExchangeStatus: (exchanges) => set({ exchanges }),
  upsertQuote: (quote) =>
    set((state) => {
      const next = state.snapshots.filter((item) => !(item.exchange === quote.exchange && item.symbol === quote.symbol));
      next.unshift({
        ...quote,
        spread: quote.askPrice - quote.bidPrice,
        liquidity: quote.askQty + quote.bidQty,
        status: Date.now() - quote.normalizedAt > 3000 ? "STALE" : "CONNECTED",
        lastUpdate: new Date(quote.normalizedAt).toISOString()
      });
      return { snapshots: next.slice(0, 32) };
    }),
  setBot: (bot) => set((state) => ({ bot: { ...state.bot, ...bot } })),
  setSymbolFilter: (symbolFilter) => set({ symbolFilter })
}));
