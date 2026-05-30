import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
