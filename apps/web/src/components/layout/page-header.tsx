import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type HeaderTone = "teal" | "blue" | "amber" | "red" | "violet";
type StatTone = HeaderTone | "neutral" | "success" | "danger" | "warning";

const TONE_HEX: Record<HeaderTone, string> = {
  teal: "#2dd4bf",
  blue: "#60a5fa",
  amber: "#fbbf24",
  red: "#fb7185",
  violet: "#a78bfa"
};

const STAT_TONE_CLASS: Record<StatTone, string> = {
  teal: "border-primary/30 bg-primary/10 text-primary",
  blue: "border-info/30 bg-info/10 text-info",
  amber: "border-warning/30 bg-warning/10 text-warning",
  red: "border-danger/30 bg-danger/10 text-danger",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  neutral: "border-white/10 bg-white/[0.07] text-foreground",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning"
};

export function PageHeader({
  eyebrow,
  title,
  description,
  iconSrc,
  iconAlt = "",
  tone = "teal",
  children,
  className
}: {
  eyebrow: string;
  title: string;
  description: string;
  iconSrc: string;
  iconAlt?: string;
  tone?: HeaderTone;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "page-hero relative isolate overflow-hidden rounded-lg border border-white/10 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,0.26)] sm:px-5 sm:py-5",
        className
      )}
      style={{ "--hero-accent": TONE_HEX[tone] } as CSSProperties}
    >
      <div className="absolute inset-0 hero-circuit-field" />
      <div className="absolute inset-x-0 top-0 data-strip" />
      <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="hero-module-icon">
            <Image src={iconSrc} alt={iconAlt} width={72} height={72} priority className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-primary">
              <span className="pulse-dot" />
              {eyebrow}
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-white sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {children ? <div className="header-stat-grid">{children}</div> : null}
      </div>
    </section>
  );
}

export function HeaderStat({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className={cn("header-stat rounded-md border px-3 py-2 text-xs", STAT_TONE_CLASS[tone])}>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-semibold leading-tight tabular-nums text-current">{value}</div>
    </div>
  );
}
