"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FlaskConical,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldAlert,
  WalletCards,
  X,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";
import { useOpportunitiesStore } from "@/store/opportunities.store";
import { useUiStore } from "@/store/ui.store";
import { useWalletStore } from "@/store/wallets.store";
import { currency } from "@/lib/formatters";
import { TutorialButton } from "@/components/tutorial/guided-tutorial";
import { PlatformMark } from "./platform-mark";

type BadgeTone = "default" | "success" | "warning" | "danger";
type Badge = { value: string; tone: BadgeTone };

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/opportunities", label: "Opportunities", icon: Zap },
  { href: "/simulator", label: "Simulator", icon: Activity },
  { href: "/wallets", label: "Wallets", icon: WalletCards },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/risk", label: "Risk Center", icon: ShieldAlert },
  { href: "/strategy-lab", label: "Strategy Lab", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings }
];

const navSections = [
  { label: "Command", items: items.slice(0, 3) },
  { label: "Capital", items: items.slice(3, 6) },
  { label: "Lab", items: items.slice(6) }
];

const TONE_CLASS: Record<BadgeTone, string> = {
  default: "border-white/15 bg-white/10 text-muted-foreground",
  success: "border-success/35 bg-success/15 text-success",
  warning: "border-warning/35 bg-warning/15 text-warning",
  danger: "border-danger/40 bg-danger/15 text-danger"
};

function useLatencyTone(): { color: string; label: string; p50: number } {
  const latencyByExchange = useAnalyticsStore((state) => state.summary.latencyByExchange);
  const circuitBreakerActive = useAnalyticsStore((state) => state.risk.circuitBreakerActive);
  const p50 = latencyByExchange.length > 0 ? Math.max(...latencyByExchange.map((l) => l.p50)) : 0;

  if (circuitBreakerActive || p50 > 500) {
    return { color: "bg-danger", label: `${p50 > 0 ? `${p50.toFixed(0)}ms` : "BREAK"}`, p50 };
  }
  if (p50 > 100) {
    return { color: "bg-warning", label: `${p50.toFixed(0)}ms`, p50 };
  }
  return { color: "bg-success", label: p50 > 0 ? `${p50.toFixed(0)}ms` : "OK", p50 };
}

export function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const opportunityCount = useOpportunitiesStore((state) => state.opportunities.length);
  const risk = useAnalyticsStore((state) => state.risk);
  const hydrated = useUiStore((state) => state.hydrated);
  const exchangeCount = useWalletStore((state) =>
    new Set(state.balances.map((wallet) => wallet.exchange)).size
  );
  const latency = useLatencyTone();
  const snapshots = useMarketStore((state) => state.snapshots);
  const btcSnaps = snapshots.filter((s) => s.symbol === "BTC/USDT");
  const btcMid = btcSnaps.length > 0 ? btcSnaps.reduce((sum, s) => sum + (s.bidPrice + s.askPrice) / 2, 0) / btcSnaps.length : null;
  const ethSnaps = snapshots.filter((s) => s.symbol === "ETH/USDT");
  const ethMid = ethSnaps.length > 0 ? ethSnaps.reduce((sum, s) => sum + (s.bidPrice + s.askPrice) / 2, 0) / ethSnaps.length : null;

  const badgeFor = (href: string): Badge | null => {
    if (href === "/opportunities" && opportunityCount > 0) {
      return { value: opportunityCount.toString(), tone: "default" };
    }
    if (href === "/wallets" && exchangeCount > 0) {
      return { value: exchangeCount.toString(), tone: "default" };
    }
    if (href === "/risk") {
      if (risk.circuitBreakerActive) return { value: "BREAK", tone: "danger" };
      if (risk.currentRiskLevel === "CRITICAL") return { value: "CRIT", tone: "danger" };
      if (risk.currentRiskLevel === "HIGH") return { value: "HIGH", tone: "warning" };
    }
    return null;
  };

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onMobileClose} aria-hidden />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[#060a10]/96 px-3 py-4 shadow-[18px_0_60px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-3 px-2">
          <Link href="/dashboard" onClick={onMobileClose} className="group flex items-center gap-3">
            <PlatformMark priority size={46} className="transition-transform duration-200 group-hover:scale-[1.03]" />
            <div>
              <div className="text-xl font-semibold tracking-normal text-white drop-shadow-[0_0_18px_rgba(45,212,191,0.2)]">ArbiX</div>
              <div className="text-xs text-muted-foreground">Arbitrage Simulator</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-5 data-strip" />
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase text-muted-foreground/80">{section.label}</div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const badge = badgeFor(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 overflow-hidden rounded-md border border-transparent px-3 text-sm text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-white/10 hover:text-foreground",
                        active && "border-primary/30 bg-primary/10 text-foreground shadow-[0_0_26px_rgba(45,212,191,0.06)]"
                      )}
                    >
                      {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary shadow-[0_0_12px_hsl(var(--primary))]" /> : null}
                      <Icon className={cn("h-4 w-4 transition-transform duration-200 group-hover:scale-110", active && "text-primary")} />
                      <span className="flex-1">{item.label}</span>
                      {badge ? (
                        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", TONE_CLASS[badge.tone])}>
                          {badge.value}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-3 space-y-3">
          {hydrated ? (
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${latency.color} shadow-[0_0_6px_currentColor]`} />
                <span className="text-xs text-muted-foreground">System latency</span>
                <span className="ml-auto text-xs font-semibold tabular-nums">{latency.label}</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", latency.p50 > 500 ? "bg-danger" : latency.p50 > 100 ? "bg-warning" : "bg-success")}
                  style={{ width: `${Math.min(100, Math.max(8, latency.p50 / 6))}%` }}
                />
              </div>
            </div>
          ) : null}
        {(btcMid !== null || ethMid !== null) && (
          <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground/70">Live prices</div>
            {btcMid !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">BTC</span>
                <span className="font-semibold tabular-nums">{currency(btcMid)}</span>
              </div>
            )}
            {ethMid !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ETH</span>
                <span className="font-semibold tabular-nums">{currency(ethMid)}</span>
              </div>
            )}
          </div>
        )}
        <TutorialButton />
        <div className="surface-card rounded-lg border p-3 text-xs text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">No real trading</div>
          <p>Simulated execution only. Public market data, no private API keys.</p>
        </div>
        </div>
      </aside>
    </>
  );
}
