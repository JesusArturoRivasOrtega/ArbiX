"use client";

import { CheckCircle2, Circle, ExternalLink, Route, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { useWalletStore } from "@/store/wallets.store";

const buttonChecks = [
  {
    button: "Presentation Mode",
    expected: "Resets bot and wallets, clears risk, then starts a profitable replay.",
    verify: "Look for an EXECUTED trade, positive Net P&L, and a new Simulator timeline.",
    href: "/simulator"
  },
  {
    button: "Profitable",
    expected: "Starts a replay where the bot should accept and simulate a trade.",
    verify: "Opportunity Feed should show EXECUTED and a green profit amount.",
    href: "/opportunities"
  },
  {
    button: "Fees reject",
    expected: "Starts a replay where gross spread exists but fees remove the profit.",
    verify: "Opportunity Feed should show REJECTED with a fee/profit reason.",
    href: "/opportunities"
  },
  {
    button: "Low liquidity",
    expected: "Starts a replay where the book cannot fill the desired size.",
    verify: "Opportunity Feed should show REJECTED or partial-fill evidence.",
    href: "/simulator"
  },
  {
    button: "High latency",
    expected: "Starts a replay where market data arrives too slowly.",
    verify: "Risk Center should show a circuit-breaker or latency event.",
    href: "/risk"
  },
  {
    button: "Reset bot",
    expected: "Reconnects adapters and clears current market state.",
    verify: "Bot status should be RUNNING and exchanges should reconnect.",
    href: "/dashboard"
  },
  {
    button: "Reset wallets",
    expected: "Restores virtual balances to their seed values.",
    verify: "Wallets should show non-zero BTC/ETH and quote balances.",
    href: "/wallets"
  }
] as const;

export function ValidationGuide() {
  const summary = useAnalyticsStore((state) => state.summary);
  const risk = useAnalyticsStore((state) => state.risk);
  const bot = useMarketStore((state) => state.bot);
  const exchanges = useMarketStore((state) => state.exchanges);
  const opportunities = useOpportunitiesStore((state) => state.opportunities);
  const balances = useWalletStore((state) => state.balances);

  const connectedExchanges = exchanges.filter((exchange) => exchange.status === "CONNECTED").length;
  const hasExecutedTrade = opportunities.some((opportunity) => opportunity.status === "EXECUTED") || summary.executedOpportunities > 0;
  const hasRejectedTrade = opportunities.some((opportunity) => opportunity.status === "REJECTED") || summary.rejectedOpportunities > 0;
  const walletsSeeded = balances.some((wallet) => wallet.asset === "BTC" && wallet.balance > 0) && balances.some((wallet) => ["USDT", "USD"].includes(wallet.asset) && wallet.balance > 0);
  const pnlPositive = summary.totalNetProfit > 0;

  const checks = [
    {
      label: "System is connected",
      ready: bot.connected && connectedExchanges > 0,
      detail: `${connectedExchanges}/${exchanges.length} exchanges connected`
    },
    {
      label: "Risk is clear",
      ready: !risk.circuitBreakerActive,
      detail: risk.circuitBreakerActive ? risk.reason ?? "Circuit breaker active" : "Risk nominal"
    },
    {
      label: "Wallets are seeded",
      ready: walletsSeeded,
      detail: walletsSeeded ? "Virtual balances available" : "Click Reset wallets"
    },
    {
      label: "Profitable execution visible",
      ready: hasExecutedTrade && pnlPositive,
      detail: hasExecutedTrade ? `Net P&L ${currency(summary.totalNetProfit)}` : "Click Presentation Mode"
    },
    {
      label: "Rejection logic visible",
      ready: hasRejectedTrade,
      detail: hasRejectedTrade ? `${summary.rejectedOpportunities} rejected opportunities` : "Click Fees reject or Low liquidity"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation Guide</CardTitle>
        <div className="text-xs text-muted-foreground">Use this to confirm each demo button did something real.</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {checks.map((check) => (
            <div
              key={check.label}
              className={cn(
                "rounded-md border px-3 py-2 text-xs",
                check.ready ? "border-success/25 bg-success/8" : "border-white/10 bg-white/5"
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {check.ready ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                <span>{check.label}</span>
              </div>
              <div className="mt-1 text-muted-foreground">{check.detail}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/8 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Route className="h-4 w-4 text-primary" />
            Minimal demo path
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <Step number="1" text="Click Presentation Mode" />
            <Step number="2" text="Confirm EXECUTED trade" />
            <Step number="3" text="Open Simulator" />
            <Step number="4" text="Show Analytics P&L" />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Button</th>
                <th className="px-3 py-2 text-left">Expected result</th>
                <th className="px-3 py-2 text-left">Where to verify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {buttonChecks.map((item) => (
                <tr key={item.button} className="hover:bg-white/5">
                  <td className="px-3 py-3">
                    <Badge variant={item.button === "Presentation Mode" ? "info" : "neutral"}>{item.button}</Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{item.expected}</td>
                  <td className="px-3 py-3">
                    <Link href={item.href} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      {item.verify}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>Everything here is simulated. A successful validation means the platform detected, evaluated, accepted or rejected, and recorded the scenario correctly.</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/15 px-2.5 py-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">{number}</span>
      <span>{text}</span>
    </div>
  );
}
