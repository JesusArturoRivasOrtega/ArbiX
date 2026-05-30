import Link from "next/link";
import { Home, SearchX } from "lucide-react";
import { PlatformMark } from "@/components/layout/platform-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <PlatformMark size={64} priority />
      <div>
        <div className="mb-1 text-[72px] font-bold leading-none tabular-nums text-primary/30">404</div>
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This route does not exist in ArbiX. The market scanner is still running — you just took a wrong turn.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <SearchX className="h-3.5 w-3.5" />
        <span>No arbitrage opportunities were harmed in this 404.</span>
      </div>
    </div>
  );
}
