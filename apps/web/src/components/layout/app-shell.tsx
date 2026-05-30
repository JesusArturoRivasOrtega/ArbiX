"use client";

import { useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Toaster } from "@/components/ui/toast";
import { Chatbot } from "@/components/chatbot/chatbot";
import { RealtimeBridge } from "./realtime-bridge";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen financial-grid">
      <RealtimeBridge />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Topbar onOpenMobile={() => setMobileOpen(true)} />
      <main className="page-shell px-4 py-5 pb-8 lg:ml-64 lg:px-6">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <Toaster />
      <Chatbot />
    </div>
  );
}
