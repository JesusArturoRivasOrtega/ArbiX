"use client";

import { useEffect, useState } from "react";
import type { BotConfig, ExchangeName } from "@arbix/shared";
import { Save, WandSparkles } from "lucide-react";
import { HeaderStat, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { demoRisk } from "@/lib/demo-data";

const ALL_EXCHANGES: ExchangeName[] = ["BINANCE", "KRAKEN", "OKX", "COINBASE"];

const EXCHANGE_NOTES: Partial<Record<ExchangeName, string>> = {
  COINBASE: "Ticker only · implied depth",
};

const defaultConfig: BotConfig = {
  ...demoRisk.config,
  marketMode: "DEMO",
  enabledExchanges: ["BINANCE", "KRAKEN", "OKX"],
  fees: {
    BINANCE: { tradingFeeRate: 0.001, withdrawalFee: 0 },
    KRAKEN: { tradingFeeRate: 0.0026, withdrawalFee: 0 },
    OKX: { tradingFeeRate: 0.001, withdrawalFee: 0 },
    COINBASE: { tradingFeeRate: 0.002, withdrawalFee: 0 },
    MOCK: { tradingFeeRate: 0.001, withdrawalFee: 0 }
  }
};

export default function SettingsPage() {
  const [config, setConfig] = useState<BotConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .config()
      .then((payload) => {
        setConfig(payload);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateConfig(config);
      setConfig(updated);
      toast.success("Configuration saved", "Risk limits and fees applied to the running engine.");
    } catch (error) {
      toast.danger("Save failed", (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleExchange = (exchange: ExchangeName) => {
    const isEnabled = config.enabledExchanges.includes(exchange);
    const enabledExchanges = isEnabled
      ? config.enabledExchanges.filter((item) => item !== exchange)
      : [...config.enabledExchanges, exchange];
    setConfig({ ...config, enabledExchanges });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Control surface"
        title="Settings"
        description="Risk limits, simulation mode, partial fills and exchange fee assumptions."
        iconSrc="/brand/arbix-platform-icon-512.png"
        iconAlt="ArbiX platform settings icon"
        tone="teal"
      >
        <HeaderStat label="Mode" value={config.marketMode} tone={config.marketMode === "LIVE" ? "success" : config.marketMode === "REPLAY" ? "blue" : "amber"} />
        <HeaderStat label="Exchanges" value={config.enabledExchanges.length} tone="teal" />
        <HeaderStat label="Partial fills" value={config.allowPartialFills ? "On" : "Off"} tone={config.allowPartialFills ? "success" : "neutral"} />
        <HeaderStat label="Circuit breaker" value={config.circuitBreakerEnabled ? "On" : "Off"} tone={config.circuitBreakerEnabled ? "red" : "neutral"} />
      </PageHeader>
      {!loaded ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Bot Configuration</CardTitle>
                <Button size="sm" onClick={() => void save()} disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Mode">
                  <Select value={config.marketMode} onChange={(event) => setConfig({ ...config, marketMode: event.target.value as never })}>
                    <option value="LIVE">LIVE</option>
                    <option value="DEMO">DEMO</option>
                    <option value="REPLAY">REPLAY</option>
                  </Select>
                </Field>
                <NumberField label="Min net profit %" value={config.minNetProfitPercent} onChange={(value) => setConfig({ ...config, minNetProfitPercent: value })} />
                <NumberField label="Max trade size" value={config.maxTradeSize} onChange={(value) => setConfig({ ...config, maxTradeSize: value })} />
                <NumberField label="Max latency ms" value={config.maxLatencyMs} onChange={(value) => setConfig({ ...config, maxLatencyMs: value })} />
                <NumberField label="Max order book age ms" value={config.maxOrderBookAgeMs} onChange={(value) => setConfig({ ...config, maxOrderBookAgeMs: value })} />
                <NumberField label="Max slippage %" value={config.maxSlippagePercent} onChange={(value) => setConfig({ ...config, maxSlippagePercent: value })} />
                <NumberField label="Max rejects / minute" value={config.maxRejectedOpportunitiesPerMinute} step="1" onChange={(value) => setConfig({ ...config, maxRejectedOpportunitiesPerMinute: value })} />
                <NumberField label="Max neg P&L stop" value={config.maxNegativePnLBeforeStop} onChange={(value) => setConfig({ ...config, maxNegativePnLBeforeStop: value })} />
                <NumberField label="Min liquidity score" value={config.minLiquidityScore} onChange={(value) => setConfig({ ...config, minLiquidityScore: value })} />
                <ToggleField label="Allow partial fills" checked={config.allowPartialFills} onChange={(value) => setConfig({ ...config, allowPartialFills: value })} />
                <ToggleField label="Auto simulation" checked={config.autoSimulationEnabled} onChange={(value) => setConfig({ ...config, autoSimulationEnabled: value })} />
                <ToggleField label="Circuit breaker" checked={config.circuitBreakerEnabled} onChange={(value) => setConfig({ ...config, circuitBreakerEnabled: value })} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Replay Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ReplayButton scenario="profitable-arbitrage" label="Demo: profitable arbitrage" />
                <ReplayButton scenario="rejected-by-fees" label="Demo: rejected by fees" />
                <ReplayButton scenario="insufficient-liquidity" label="Demo: insufficient liquidity" />
                <ReplayButton scenario="high-latency-circuit-breaker" label="Demo: high latency circuit breaker" />
                <ReplayButton scenario="last-5-minutes" label="Replay last 5 minutes" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Enabled Exchanges</CardTitle>
              <div className="text-xs text-muted-foreground">Toggle which venues the arbitrage engine connects to</div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ALL_EXCHANGES.map((exchange) => {
                const enabled = config.enabledExchanges.includes(exchange);
                return (
                  <div key={exchange} className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-3">
                    <div>
                      <div className="text-sm font-semibold">{exchange}</div>
                      <div className="text-xs text-muted-foreground">
                        {EXCHANGE_NOTES[exchange] ?? (enabled ? "Streaming" : "Disabled")}
                      </div>
                    </div>
                    <Switch checked={enabled} onCheckedChange={() => toggleExchange(exchange)} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Trading Fees</CardTitle>
              <div className="text-xs text-muted-foreground">Used by the cost calculator to compute net profitability</div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(config.fees).map(([exchange, fee]) => (
                <div key={exchange} className="rounded-md border border-white/10 bg-white/5 p-3">
                  <div className="mb-3 font-semibold">{exchange}</div>
                  <NumberField
                    label="Trading fee rate"
                    value={fee.tradingFeeRate}
                    step="0.0001"
                    onChange={(value) => setConfig({ ...config, fees: { ...config.fees, [exchange]: { ...fee, tradingFeeRate: value } } })}
                  />
                  <div className="mt-3">
                    <NumberField
                      label="Withdrawal fee"
                      value={fee.withdrawalFee}
                      onChange={(value) => setConfig({ ...config, fees: { ...config.fees, [exchange]: { ...fee, withdrawalFee: value } } })}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange, step = "0.01" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return (
    <Field label={label}>
      <Input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ReplayButton({ scenario, label }: { scenario: string; label: string }) {
  return (
    <Button
      className="w-full justify-start"
      variant="outline"
      onClick={() => {
        void api.replayScenario(scenario).then(() => {
          window.dispatchEvent(new Event("arbix:refresh-risk"));
          window.dispatchEvent(new Event("arbix:refresh-analytics"));
        });
        toast.info("Replay scenario requested", label);
      }}
    >
      <WandSparkles className="h-4 w-4" />
      {label}
    </Button>
  );
}
