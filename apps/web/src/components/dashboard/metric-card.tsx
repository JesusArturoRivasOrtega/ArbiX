import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "danger" | "warning" | "info";
};

const toneClass = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info"
};

const toneAccent = {
  default: "#e5e7eb",
  success: "#34d399",
  danger: "#fb7185",
  warning: "#fbbf24",
  info: "#60a5fa"
};

export function MetricCard({ label, value, helper, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <Card className="metric-card group" style={{ "--metric-accent": toneAccent[tone] } as CSSProperties}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <div key={value} className={cn("metric-value mt-2 truncate text-3xl font-semibold leading-tight", toneClass[tone])}>{value}</div>
          {helper ? <p className="mt-1 truncate text-xs text-muted-foreground">{helper}</p> : null}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full sparkline opacity-80 transition-all duration-500 group-hover:w-full" />
          </div>
        </div>
        <div className="kinetic-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15">
          <Icon className={cn("h-5 w-5", toneClass[tone])} />
        </div>
      </CardContent>
    </Card>
  );
}
