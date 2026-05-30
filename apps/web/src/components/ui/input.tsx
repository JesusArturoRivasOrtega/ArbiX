import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-white/15 bg-white/10 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/30 focus:border-primary",
        className
      )}
      {...props}
    />
  );
}
