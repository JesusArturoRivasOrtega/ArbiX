import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { ExchangePortfolioCards } from "@/components/wallets/exchange-portfolio-cards";
import { PortfolioAllocation } from "@/components/wallets/portfolio-allocation";
import { WalletBalanceTable } from "@/components/wallets/wallet-balance-table";

export default function WalletsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Capital map"
        title="Wallets"
        description="Virtual balances by exchange and asset. Every simulated trade writes a ledger entry. Reset to seed values at any time."
        iconSrc="/brand/module-wallets.png"
        iconAlt="Wallets module icon"
        tone="amber"
      >
        <HeaderStat label="Balances" value="Virtual" tone="amber" />
        <HeaderStat label="Ledger" value="Per trade" tone="blue" />
        <HeaderStat label="Scope" value="Multi-exchange" tone="teal" />
        <HeaderStat label="Safety" value="No real keys" tone="neutral" />
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.85fr]">
        <ExchangePortfolioCards />
        <PortfolioAllocation />
      </div>
      <WalletBalanceTable />
    </div>
  );
}
