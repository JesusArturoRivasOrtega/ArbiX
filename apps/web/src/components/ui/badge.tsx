import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-normal shadow-[0_0_18px_rgba(255,255,255,0.035)]", {
  variants: {
    variant: {
      default: "border-white/10 bg-white/10 text-foreground",
      success: "border-success/35 bg-success/15 text-success shadow-[0_0_20px_rgba(52,211,153,0.08)]",
      danger: "border-danger/35 bg-danger/15 text-danger shadow-[0_0_20px_rgba(244,63,94,0.08)]",
      warning: "border-warning/35 bg-warning/15 text-warning shadow-[0_0_20px_rgba(251,191,36,0.08)]",
      info: "border-info/35 bg-info/15 text-info shadow-[0_0_20px_rgba(96,165,250,0.08)]",
      neutral: "border-white/10 bg-white/5 text-muted-foreground"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
