"use client";

import { create } from "zustand";
import type { WalletBalance, WalletLedgerEntry } from "@arbix/shared";
import { demoLedger, demoWallets } from "@/lib/demo-data";

type WalletStore = {
  balances: WalletBalance[];
  ledger: WalletLedgerEntry[];
  /** USD total per exchange at the moment of the first server update this session. */
  initialTotals: Record<string, number>;
  setWallets: (payload: { balances: WalletBalance[]; ledger: WalletLedgerEntry[] }) => void;
  resetInitialTotals: () => void;
};

function computeTotals(balances: WalletBalance[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of balances) {
    out[w.exchange] = (out[w.exchange] ?? 0) + w.estimatedUsdValue;
  }
  return out;
}

export const useWalletStore = create<WalletStore>((set) => ({
  balances: demoWallets,
  ledger: demoLedger,
  initialTotals: {},
  setWallets: ({ balances, ledger }) =>
    set((state) => ({
      balances,
      ledger,
      // Only capture the baseline once per session (first server update)
      initialTotals:
        Object.keys(state.initialTotals).length === 0 ? computeTotals(balances) : state.initialTotals,
    })),
  resetInitialTotals: () => set({ initialTotals: {} }),
}));
