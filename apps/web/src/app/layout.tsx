import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "ArbiX - Multi-Exchange Bitcoin Arbitrage Simulator",
  description: "Real-time arbitrage detection, risk-aware simulation and P&L analytics.",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/arbix-platform-icon-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/brand/arbix-platform-icon-512.png", sizes: "512x512", type: "image/png" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
