"use client";

import { Menu, Pause, Play, RadioTower, RefreshCcw, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { currency, ms } from "@/lib/formatters";
import { useAnalyticsStore } from "@/store/analytics.store";
import { useMarketStore } from "@/store/market.store";
import { useUiStore } from "@/store/ui.store";
import { ReplayMenu } from "./replay-menu";

function computeMidPrice(snapshots: ReturnType<typeof useMarketStore.getState>["snapshots"], symbol: string): number | null {
  const matching = snapshots.filter((s) => s.symbol === symbol);
  if (matching.length === 0) return null;
  const avg = matching.reduce((sum, s) => sum + (s.bidPrice + s.askPrice) / 2, 0) / matching.length;
  return avg;
}

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { bot, symbolFilter, setSymbolFilter, snapshots } = useMarketStore();
  const risk = useAnalyticsStore((state) => state.risk);
  const activeReplay = useUiStore((state) => state.activeReplay);
  const modeVariant = bot.mode === "LIVE" ? "success" : bot.mode === "REPLAY" ? "info" : "info";
  const marketTape = snapshots.slice(0, 8);
  const tapeRows = marketTape.length > 0 ? [...marketTape, ...marketTape] : [];
  const btcPrice = computeMidPrice(snapshots, "BTC/USDT");
  const ethPrice = computeMidPrice(snapshots, "ETH/USDT");

  const onBotAction = async (action: "start" | "pause" | "stop" | "reset") => {
    try {
      if (action === "start") {
        await api.botStart();
        toast.success("Bot resumed", "ArbiX is scanning order books across exchanges.");
      } else if (action === "pause") {
        await api.botPause();
        toast.info("Bot paused", "Market feed disconnected. Start to resume scanning.");
      } else if (action === "stop") {
        await api.botStop();
        window.dispatchEvent(new Event("arbix:refresh-risk"));
        toast.info("Bot stopped", "All adapters disconnected. Press Start to reconnect.");
      } else {
        await api.botReset();
        window.dispatchEvent(new Event("arbix:refresh-risk"));
        window.dispatchEvent(new Event("arbix:refresh-analytics"));
        toast.success("Bot reset", "Adapters reconnected and order books cleared.");
      }
    } catch (error) {
      toast.danger("Bot action failed", (error as Error).message);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060a10]/88 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="flex min-h-16 flex-col gap-3 px-4 py-3 lg:ml-64 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenMobile}
              className="rounded-md border border-white/10 bg-white/5 p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Badge variant={modeVariant} data-tour="market-mode-badge">{bot.mode === "LIVE" ? "Live Market" : bot.mode === "REPLAY" ? "Replay Mode" : "Demo Mode"}</Badge>
            <Badge variant={bot.connected ? "success" : "warning"}>
              <span className={bot.connected ? "pulse-dot" : "h-1.5 w-1.5 rounded-full bg-warning"} />
              <RadioTower className="h-3 w-3" />
              {bot.connected ? "Realtime connected" : "Local demo fallback"}
            </Badge>
            <Badge variant={bot.status === "RUNNING" ? "success" : bot.status === "PAUSED" ? "warning" : "neutral"}>
              {bot.status}
            </Badge>
            <Badge variant={risk.circuitBreakerActive ? "danger" : "success"}>
              {risk.circuitBreakerActive ? "Circuit breaker active" : "Risk nominal"}
            </Badge>
            {activeReplay ? (
              <Badge variant="info" className="replay-active-pulse">
                <span className="pulse-dot" />
                Replay: {activeReplay}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{bot.message}</p>
          {tapeRows.length > 0 ? (
            <div className="market-tape mt-2 hidden max-w-3xl sm:block">
              <div className="market-tape-track">
                {tapeRows.map((row, index) => (
                  <div
                    key={`${row.exchange}-${row.symbol}-${index}`}
                    className="flex shrink-0 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] tabular-nums"
                  >
                    <span className="font-semibold text-foreground">{row.exchange}</span>
                    <span className="text-muted-foreground">{row.symbol}</span>
                    <span className="text-success">B {currency(row.bidPrice)}</span>
                    <span className="text-danger">A {currency(row.askPrice)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 hidden w-80 data-strip sm:block" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {btcPrice !== null && (
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs tabular-nums">
              <span className="text-muted-foreground">BTC </span>
              <span className="font-semibold text-foreground">{currency(btcPrice)}</span>
            </div>
          )}
          {ethPrice !== null && (
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs tabular-nums">
              <span className="text-muted-foreground">ETH </span>
              <span className="font-semibold text-foreground">{currency(ethPrice)}</span>
            </div>
          )}
          <div className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs text-muted-foreground shadow-[0_0_22px_rgba(96,165,250,0.05)]">
            Highest latency <span className="font-semibold text-foreground">{ms(risk.currentHighestLatencyMs)}</span>
          </div>
          <Select value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value as never)} aria-label="Symbol filter" data-tour="symbol-filter">
            <option value="ALL">All pairs</option>
            <option value="BTC/USDT">BTC/USDT</option>
            <option value="ETH/USDT">ETH/USDT</option>
          </Select>
          <ReplayMenu />
          <Button variant="outline" size="icon" onClick={() => void onBotAction("reset")} title="Reset bot — reconnect all adapters">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => void onBotAction("stop")} title="Stop bot — disconnect all adapters">
            <Square className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => void onBotAction("pause")} title="Pause bot — suspend scanning">
            <Pause className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={() => void onBotAction("start")} title="Start bot" data-tour="start-bot">
            <Play className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
