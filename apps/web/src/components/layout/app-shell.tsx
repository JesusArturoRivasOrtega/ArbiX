"use client";

import { useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster } from "@/components/ui/toast";
import { Chatbot } from "@/components/chatbot/chatbot";
import { GuidedTutorial } from "@/components/tutorial/guided-tutorial";
import { useUiStore } from "@/store/ui.store";
import { RealtimeBridge } from "./realtime-bridge";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrationStatus = useUiStore((state) => state.hydrationStatus);
  const hydrationError = useUiStore((state) => state.hydrationError);
  return (
    <div className="min-h-screen financial-grid">
      <RealtimeBridge />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Topbar onOpenMobile={() => setMobileOpen(true)} />
      <main className="page-shell px-4 py-5 pb-8 lg:ml-64 lg:px-6">
        {hydrationStatus === "failed" || hydrationStatus === "partial" ? (
          <div
            data-testid="hydration-status"
            className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning"
          >
            {hydrationStatus === "failed" ? "Backend hydration failed." : "Backend hydration is partial."} {hydrationError}
          </div>
        ) : null}
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Toaster />
      <Chatbot />
      <GuidedTutorial />
    </div>
  );
}
