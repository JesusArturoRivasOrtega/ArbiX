export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  /** CSS selector using data-tour attribute. null = center of screen */
  targetSelector: string | null;
  /** Route to navigate to before showing this step */
  route: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  actionRequired?: boolean;
  lockOtherActions?: boolean;
  allowedSelectors?: string[];
  /** Fun "videogame narrator" prefix shown above the title */
  gameText?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to ArbiX",
    description:
      "ArbiX monitors crypto markets in real time, detects cross-exchange arbitrage opportunities, and calculates whether they're truly profitable after fees, slippage, liquidity and risk. No real trades are ever executed — everything is simulated.",
    targetSelector: null,
    route: "/dashboard",
    placement: "center",
    gameText: "Tutorial — Step 1 of 19",
  },
  {
    id: "bot-status",
    title: "Bot Status",
    description:
      "This card shows whether ArbiX is RUNNING, PAUSED, or STOPPED, which market mode is active, and how many exchanges are connected.",
    targetSelector: '[data-tour="bot-status-card"]',
    route: "/dashboard",
    placement: "bottom",
    gameText: "System overview",
  },
  {
    id: "market-mode",
    title: "Market Mode",
    description:
      "This badge shows the current mode: LIVE (real WebSocket feeds), DEMO (controlled synthetic data), or REPLAY (scripted scenario). DEMO and REPLAY guarantee a stable presentation even if an exchange is unavailable.",
    targetSelector: '[data-tour="market-mode-badge"]',
    route: "/dashboard",
    placement: "bottom",
    gameText: "Data source",
  },
  {
    id: "preflight",
    title: "Health Preflight",
    description:
      "Before running a demo, ArbiX verifies the API, WebSocket connection, database, and order book freshness. Press \"Recheck\" to run all checks now.",
    targetSelector: '[data-tour="preflight-panel"]',
    route: "/dashboard",
    placement: "top",
    actionRequired: false,
    gameText: "System readiness",
  },
  {
    id: "start-bot",
    title: "Start the Bot",
    description:
      "Press the ▶ Play button to start scanning order books across all connected exchanges. The bot will begin detecting price divergences immediately. The step will advance automatically once the bot is running.",
    targetSelector: '[data-tour="start-bot"]',
    route: "/dashboard",
    placement: "bottom",
    actionRequired: true,
    lockOtherActions: true,
    allowedSelectors: ['[data-tour="start-bot"]'],
    gameText: "Activate the engine",
  },
  {
    id: "market-matrix",
    title: "Market Matrix",
    description:
      "Live normalized quotes from all connected exchanges. Each row shows bid, ask, spread, arbitrage signal, liquidity depth, latency and freshness. Rows with strong arbitrage signals are highlighted green.",
    targetSelector: '[data-tour="market-matrix"]',
    route: "/dashboard",
    placement: "top",
    gameText: "Real-time order book grid",
  },
  {
    id: "symbol-filter",
    title: "Symbol Filter",
    description:
      "Filter the entire platform by trading pair. Switch between All Pairs, BTC/USDT, or ETH/USDT. ArbiX is not limited to a single asset.",
    targetSelector: '[data-tour="symbol-filter"]',
    route: "/dashboard",
    placement: "bottom",
    gameText: "Multi-asset architecture",
  },
  {
    id: "demo-scenario",
    title: "Run a Profitable Scenario",
    description:
      'For reliable demos, ArbiX includes scripted scenarios. Press "Profitable" to inject a controlled BTC/USDT spread that survives all cost and risk checks. The step will advance automatically when an EXECUTED opportunity appears.',
    targetSelector: '[data-tour="demo-profitable-arbitrage"]',
    route: "/dashboard",
    placement: "top",
    actionRequired: true,
    lockOtherActions: true,
    allowedSelectors: ['[data-tour="demo-profitable-arbitrage"]'],
    gameText: "Demo control panel",
  },
  {
    id: "opportunity-feed",
    title: "Opportunity Feed",
    description:
      "Every detected opportunity appears here: EXECUTED (green), REJECTED (red), WATCHING (yellow), or EXPIRED (grey). ArbiX doesn't execute everything — it validates first.",
    targetSelector: '[data-tour="opportunity-feed"]',
    route: "/dashboard",
    placement: "left",
    gameText: "Live event stream",
  },
  {
    id: "opportunity-detail",
    title: "Opportunity Detail",
    description:
      "Select any opportunity to see the full breakdown: buy/sell VWAP, gross profit, fees, slippage, net profit, end-to-end latency, and the 4-component confidence score.",
    targetSelector: '[data-tour="opportunity-detail"]',
    route: "/opportunities",
    placement: "left",
    gameText: "Full cost ledger",
  },
  {
    id: "rejection-checklist",
    title: "Rejection Checklist",
    description:
      "A key ArbiX feature: every opportunity shows 8 risk checks. EXECUTED opportunities pass all checks. REJECTED ones show exactly which check failed — fees, slippage, latency, liquidity, wallet, or circuit breaker.",
    targetSelector: '[data-tour="rejection-checklist"]',
    route: "/opportunities",
    placement: "top",
    gameText: "8-point risk audit",
  },
  {
    id: "simulator",
    title: "Execution Timeline",
    description:
      "The simulator shows each trade step-by-step: detection → risk checks → VWAP calculation → fee deduction → wallet update → P&L recording. Partial fills and failures are also shown.",
    targetSelector: '[data-tour="execution-timeline"]',
    route: "/simulator",
    placement: "top",
    gameText: "Trade simulation",
  },
  {
    id: "wallets",
    title: "Virtual Wallets",
    description:
      "Virtual wallet balances update after every simulated trade. The engine refuses any trade that would overdraw a balance — ensuring realistic simulation constraints.",
    targetSelector: '[data-tour="wallet-balance-table"]',
    route: "/wallets",
    placement: "top",
    gameText: "Capital management",
  },
  {
    id: "analytics",
    title: "P&L Analytics",
    description:
      "Track cumulative performance: gross profit, net profit, total fees, average slippage, rejection breakdown by reason, volume by exchange, and — when enough trades are recorded — Sharpe ratio.",
    targetSelector: '[data-tour="pnl-chart"]',
    route: "/analytics",
    placement: "top",
    gameText: "Performance dashboard",
  },
  {
    id: "risk-center",
    title: "Risk Center & Circuit Breaker",
    description:
      "The Risk Center monitors real-time risk. If latency spikes, data goes stale, or P&L drops past a threshold, the circuit breaker activates and pauses all simulated executions.",
    targetSelector: '[data-tour="circuit-breaker-panel"]',
    route: "/risk",
    placement: "top",
    gameText: "Risk management",
  },
  {
    id: "replay-mode",
    title: "Replay Mode",
    description:
      "The Replay menu lets you trigger any scripted scenario at any time. This guarantees a compelling demo even when live market conditions aren't producing opportunities.",
    targetSelector: '[data-tour="replay-menu"]',
    route: "/dashboard",
    placement: "bottom",
    gameText: "Demo reliability",
  },
  {
    id: "strategy-lab",
    title: "Strategy Lab",
    description:
      "Strategy Lab demonstrates experimental strategies like triangular arbitrage (USDT → BTC → ETH → USDT). This is watch-only — it shows that the architecture can grow beyond two-leg arbitrage.",
    targetSelector: '[data-tour="strategy-lab-triangular"]',
    route: "/strategy-lab",
    placement: "top",
    gameText: "Advanced strategies",
  },
  {
    id: "settings",
    title: "Settings & Configuration",
    description:
      "All risk thresholds, trade size limits, latency caps, slippage limits, partial fill policies, and per-exchange fees can be tuned here without touching code.",
    targetSelector: '[data-tour="settings-form"]',
    route: "/settings",
    placement: "top",
    gameText: "Runtime configuration",
  },
  {
    id: "finish",
    title: "You're ready to demo ArbiX",
    description:
      "Real-time market data → opportunity detection → cost calculation → risk validation → simulated execution → wallet update → P&L recording → analytics. The full arbitrage lifecycle, explained and demoed.",
    targetSelector: null,
    route: "/dashboard",
    placement: "center",
    gameText: "Tutorial complete",
  },
];
