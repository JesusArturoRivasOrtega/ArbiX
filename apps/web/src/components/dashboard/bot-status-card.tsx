"use client";

import { Activity, CheckCircle2, Database, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarketStore } from "@/store/market.store";

export function BotStatusCard() {
  const { bot, exchanges } = useMarketStore();
  return (
    <Card data-tour="bot-status-card">
      <CardHeader>
        <CardTitle>Bot Status</CardTitle>
        <Badge variant={bot.status === "RUNNING" ? "success" : "warning"}>{bot.status}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{bot.message}</p>
        <div className="mt-3 data-strip" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatusPill icon={RadioTower} label="Market mode" value={bot.mode} />
          <StatusPill icon={Database} label="Data source" value={bot.mode === "LIVE" ? "Public WS" : "Synthetic WS"} />
          <StatusPill icon={Activity} label="Exchanges" value={`${exchanges.filter((item) => item.status === "CONNECTED").length}/${exchanges.length}`} />
        </div>
        <div className="mt-4 grid gap-2">
          {exchanges.map((exchange) => (
            <div key={exchange.exchange} className="group flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 transition-all duration-200 hover:border-primary/25 hover:bg-primary/10">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success transition-transform duration-200 group-hover:scale-110" />
                {exchange.exchange}
              </div>
              <Badge variant={exchange.status === "CONNECTED" ? "success" : "warning"}>{exchange.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3 transition-all duration-200 hover:border-primary/25 hover:bg-primary/10">
      <Icon className="mb-2 h-4 w-4 text-primary kinetic-icon rounded border border-primary/20 p-0.5" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
