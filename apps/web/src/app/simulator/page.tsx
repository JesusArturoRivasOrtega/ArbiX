import { Suspense } from "react";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { ExecutionTimeline } from "@/components/simulator/execution-timeline";
import { OrderbookDepthView } from "@/components/simulator/orderbook-depth-view";
import { TradeBreakdown } from "@/components/simulator/trade-breakdown";

export default function SimulatorPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Execution desk"
        title="Execution Simulator"
        description="Simulated buy/sell execution with VWAP, fees, slippage, wallet validation and P&L."
        iconSrc="/brand/module-arbitrage.png"
        iconAlt="Execution simulator module icon"
        tone="blue"
      >
        <HeaderStat label="Pricing" value="VWAP" tone="blue" />
        <HeaderStat label="Costs" value="Fees + slippage" tone="amber" />
        <HeaderStat label="Validation" value="Wallet-aware" tone="teal" />
        <HeaderStat label="Mode" value="Simulated" tone="neutral" />
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <TradeBreakdown />
        <ExecutionTimeline />
      </div>
      <Suspense fallback={null}>
        <OrderbookDepthView />
      </Suspense>
    </div>
  );
}
