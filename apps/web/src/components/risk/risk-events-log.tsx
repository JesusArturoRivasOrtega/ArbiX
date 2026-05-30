"use client";

import { useEffect, useState } from "react";
import { AlertOctagon, Info, ShieldCheck } from "lucide-react";
import type { RiskEvent } from "@arbix/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/formatters";

export function RiskEventsLog() {
  const [events, setEvents] = useState<RiskEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      api
        .riskEvents()
        .then((payload) => {
          if (mounted && Array.isArray(payload)) setEvents(payload as RiskEvent[]);
        })
        .catch(() => undefined);
    };
    load();
    const refresh = () => load();
    window.addEventListener("arbix:refresh-risk", refresh);
    const interval = window.setInterval(load, 10000);
    return () => {
      mounted = false;
      window.removeEventListener("arbix:refresh-risk", refresh);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Events</CardTitle>
        <div className="text-xs text-muted-foreground">{events.length} recorded</div>
      </CardHeader>
      <CardContent className="max-h-[420px] space-y-2 overflow-auto scrollbar-thin">
        {events.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
            No risk events yet. The bot is operating inside configured safety limits.
          </div>
        ) : (
          events.map((event) => {
            const Icon = event.severity === "CRITICAL" ? AlertOctagon : event.severity === "WARNING" ? AlertOctagon : event.type === "CIRCUIT_BREAKER_CLEARED" ? ShieldCheck : Info;
            const tone = event.severity === "CRITICAL" ? "danger" : event.severity === "WARNING" ? "warning" : event.type === "CIRCUIT_BREAKER_CLEARED" ? "success" : "info";
            return (
              <div key={event.id} className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="flex items-start gap-3">
                  <Icon
                    className={
                      tone === "danger"
                        ? "h-4 w-4 shrink-0 text-danger"
                        : tone === "warning"
                          ? "h-4 w-4 shrink-0 text-warning"
                          : tone === "success"
                            ? "h-4 w-4 shrink-0 text-success"
                            : "h-4 w-4 shrink-0 text-info"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{event.type.replaceAll("_", " ")}</span>
                      <Badge variant={tone}>{event.severity}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{event.message}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(event.createdAt)}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
