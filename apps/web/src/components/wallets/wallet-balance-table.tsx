"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExportButton } from "@/components/ui/export-button";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { currency, timeAgo } from "@/lib/formatters";
import { useWalletStore } from "@/store/wallets.store";

const PRECISION: Record<string, number> = {
  BTC: 6,
  ETH: 4,
  USDT: 2,
  USD: 2
};

export function WalletBalanceTable() {
  const { balances, ledger, setWallets, resetInitialTotals } = useWalletStore();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const total = balances.reduce((sum, wallet) => sum + wallet.estimatedUsdValue, 0);

  const reset = async () => {
    setResetting(true);
    try {
      resetInitialTotals();
      const payload = await api.resetWallets();
      setWallets(payload as never);
      toast.success("Wallets reset", "Seed balances restored across exchanges.");
    } catch (error) {
      toast.danger("Reset failed", (error as Error).message);
    } finally {
      setResetting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
    <ConfirmDialog
      open={confirmOpen}
      title="Reset all virtual wallets?"
      description="This restores seed balances across all exchanges and clears the ledger. Useful before a fresh demo run."
      confirmLabel={resetting ? "Resetting..." : "Reset wallets"}
      destructive
      onConfirm={() => void reset()}
      onCancel={() => setConfirmOpen(false)}
    />
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Virtual Wallets</CardTitle>
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-success/25 bg-success/10 px-3 py-1 text-xs">
              <span className="text-muted-foreground">Total estimated value </span>
              <span className="font-semibold text-success tabular-nums">{currency(total)}</span>
            </div>
            <ExportButton
              data={balances.map((w) => ({ exchange: w.exchange, asset: w.asset, balance: w.balance, usdValue: w.estimatedUsdValue, updatedAt: w.updatedAt }))}
              filename={`arbix-wallets-${Date.now()}`}
              format="csv"
              label="Export CSV"
            />
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)} disabled={resetting}>
              <RefreshCcw className="h-4 w-4" />
              Reset wallets
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-white/5 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Exchange</th>
                  <th className="px-3 py-2 text-left">Asset</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">USD Value</th>
                  <th className="px-3 py-2 text-left">Last Trade</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {balances.map((wallet) => {
                  const precision = PRECISION[wallet.asset] ?? 4;
                  return (
                    <tr key={`${wallet.exchange}-${wallet.asset}`} className="transition-all duration-200 hover:bg-primary/10">
                      <td className="px-3 py-2 font-medium">{wallet.exchange}</td>
                      <td className="px-3 py-2">
                        <Badge variant="neutral">{wallet.asset}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{wallet.balance.toFixed(precision)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency(wallet.estimatedUsdValue)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{wallet.lastTradeId ? wallet.lastTradeId.slice(-8) : "seed"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{timeAgo(wallet.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Wallet Ledger</CardTitle>
          <div className="text-xs text-muted-foreground">{ledger.length} entries</div>
        </CardHeader>
        <CardContent className="max-h-[520px] space-y-2 overflow-auto scrollbar-thin">
          {ledger.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
              Wallet ledger is empty. The first simulated trade will write here.
            </div>
          ) : (
            ledger.map((entry) => {
              const precision = PRECISION[entry.asset] ?? 4;
              const positive = entry.change >= 0;
              const Arrow = positive ? ArrowUpRight : ArrowDownRight;
              return (
                <div key={entry.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {entry.exchange} <span className="text-muted-foreground">{entry.asset}</span>
                    </span>
                    <span className={positive ? "flex items-center gap-1 text-success tabular-nums" : "flex items-center gap-1 text-danger tabular-nums"}>
                      <Arrow className="h-3 w-3" />
                      {positive ? "+" : ""}
                      {entry.change.toFixed(precision)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{entry.reason}</span>
                    <span className="tabular-nums">bal {entry.balanceAfter.toFixed(precision)}</span>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
