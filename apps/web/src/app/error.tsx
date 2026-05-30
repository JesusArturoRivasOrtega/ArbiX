"use client";

import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { PlatformMark } from "@/components/layout/platform-mark";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ArbiX] Unhandled route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <PlatformMark size={64} priority />
      <div className="flex items-center gap-2 rounded-full border border-danger/35 bg-danger/10 px-4 py-1.5 text-sm font-semibold text-danger">
        <AlertTriangle className="h-4 w-4" />
        Unexpected error
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          ArbiX encountered an unexpected error rendering this page. The arbitrage engine is unaffected — this is a UI issue only.
        </p>
        {error.message && (
          <p className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
        {error.digest && (
          <p className="mt-1 text-[10px] text-muted-foreground/60">Digest: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
