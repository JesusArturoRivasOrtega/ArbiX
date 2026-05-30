# ArbiX

Real-Time Multi-Exchange Bitcoin Arbitrage Simulator.

ArbiX detects, evaluates and simulates crypto arbitrage opportunities in real time, using risk-aware execution logic and professional-grade market analytics. It never places real trades, never asks for private API keys, and is designed to remain demo-stable through DEMO and REPLAY modes.

## Problem

Bitcoin and Ethereum trade across fragmented exchanges 24/7. Price divergences can appear for milliseconds or seconds. A simple bot can compare prices; a serious arbitrage simulator must also model fees, order-book depth, slippage, latency, wallet balances and operational risk before deciding whether a trade should be simulated.

## Features

- Real-time public WebSocket market data for Binance, Kraken and OKX
- Optional Coinbase adapter using public ticker data and implied depth
- Multi-symbol monitoring for BTC/USDT and ETH/USDT
- Exchange adapter architecture with normalized quotes and order books
- Cross-exchange arbitrage detection
- VWAP execution against order-book depth
- Fees, withdrawal fee assumptions, slippage and latency modeling
- Partial-fill handling and configurable risk thresholds
- Virtual wallets by exchange and asset
- Wallet ledger for every simulated balance change
- Opportunity states: EXECUTED, REJECTED, WATCHING and EXPIRED
- Explicit rejection reasons for bad executions
- Opportunity confidence scoring from 0 to 100
- Circuit breaker for latency, stale data, disconnected exchanges, frontend loss and P&L stop
- DEMO mode with controlled synthetic opportunities
- REPLAY mode with scripted scenarios and last-5-minutes buffer/database fallback
- Strategy Lab with triangular arbitrage watch-only module
- Real-time dashboard, analytics, P&L charts and risk center
- Prisma/PostgreSQL persistence with optional in-memory fallback
- **Sharpe Ratio** metric (risk-adjusted return) in the Analytics page
- **ArbiX Assistant** — AI chatbot powered by Groq (LLaMA 3.3 70B) with full platform context, accessible from any page via the floating button in the bottom-right corner

## Architecture

Frontend: Next.js 15, TypeScript, Tailwind CSS, shadcn-style components, Zustand, Recharts, Socket.IO client.

Backend: NestJS, TypeScript, Socket.IO gateway, Prisma ORM, PostgreSQL, modular services for market data, arbitrage, simulation, risk and analytics.

```mermaid
flowchart LR
  A[Exchange WebSockets] --> B[Exchange Adapters]
  B --> C[Market Normalizer]
  C --> D[Order Book Store]
  D --> E[Arbitrage Engine]
  E --> F[Cost and Slippage Calculator]
  F --> G[Risk Engine]
  G --> H[Execution Simulator]
  H --> I[Wallet Manager]
  H --> J[PostgreSQL]
  E --> K[Realtime Gateway]
  K --> L[Next.js Dashboard]
  M[Mock/Replay Adapter] --> C
```

## How It Works

1. Connects to public exchange WebSockets or demo/replay adapters.
2. Normalizes market data into common quote and order-book contracts.
3. Compares lowest ask against highest bid across exchanges per symbol.
4. Computes executable volume from order-book depth and wallet balances.
5. Calculates VWAP, fees, slippage, net profit and confidence score.
6. Applies risk rules and circuit breaker protection.
7. Simulates accepted trades, updates wallets and records P&L.
8. Streams quotes, opportunities, trades, wallets, risk and analytics to the dashboard.

## Modes

| Mode | Description |
|---|---|
| DEMO | Controlled synthetic data for reliable presentations. |
| LIVE | Public exchange WebSockets. No private keys. |
| REPLAY | Scripted scenarios or last-5-minutes market replay from memory/database. |

## Replay Scenarios

- Demo: profitable arbitrage
- Demo: rejected by fees
- Demo: insufficient liquidity
- Demo: high latency circuit breaker
- Replay last 5 minutes

## API Reference

```text
GET   /health
GET   /exchanges/status
GET   /market/snapshots
GET   /market/orderbooks
GET   /market/orderbook/:exchange/:base/:quote
GET   /opportunities
GET   /trades
GET   /simulator/last-trade
GET   /wallets
GET   /analytics/summary
GET   /analytics/performance
GET   /analytics/replay-scenarios
GET   /risk/status
GET   /risk/events
GET   /config
PATCH /config
POST  /replay/start
POST  /replay/scenario/:scenarioName
POST  /replay/validate-scenarios
POST  /bot/start
POST  /bot/stop
POST  /bot/pause
POST  /bot/reset
POST  /wallets/reset
POST  /risk/circuit-breaker/clear
GET   /strategy-lab/triangular
POST  /strategy-lab/triangular/simulate
GET   /strategy-lab/triangular/last-simulation
```

Full interactive documentation available at `http://localhost:4000/api/docs` (Swagger UI).

## Socket.IO Events

Backend to frontend:

- `market.quote.updated`
- `market.orderbook.updated`
- `opportunity.detected`
- `opportunity.rejected`
- `opportunity.executed`
- `opportunities.updated`
- `trade.simulated`
- `wallet.updated`
- `pnl.updated`
- `analytics.updated`
- `risk.status.updated`
- `risk.circuit_breaker.triggered`
- `risk.circuit_breaker.cleared`
- `latency.updated`
- `bot.status.updated`
- `replay.started`
- `replay.finished`

Frontend to backend:

- `bot.start`
- `bot.stop`
- `bot.pause`
- `bot.reset`
- `config.update`
- `replay.start`
- `replay.scenario`
- `wallet.reset`
- `latency.ack`

## Running Locally

Prerequisites: Node.js 20+, npm 10+.

```bash
npm install
cp .env.example .env
npm run prisma:generate -w @arbix/api
npm run dev
```

Optional PostgreSQL:

```bash
docker compose up -d postgres
npm run prisma:migrate -w @arbix/api
npm run seed -w @arbix/api
```

Services:

| Service | URL |
|---|---|
| Web | http://localhost:3001 |
| API health | http://localhost:4000/health |
| Socket.IO | http://localhost:4000 |

## Guided Tutorial & Presentation Mode

### Tutorial

ArbiX includes a 19-step interactive tutorial that walks judges through every feature step by step.

- Auto-starts on first visit (saves state to `localStorage`)
- Can be relaunched from the **Tutorial** button at the bottom of the sidebar
- Can be reset from **Settings → Guided Tutorial → Reset tutorial**
- Two steps require action: "Start the Bot" and "Run a Profitable Scenario" — the tutorial auto-advances when the action is completed
- Keyboard: `→` next step · `←` previous · `Escape` skip

See [`docs/tutorial.md`](docs/tutorial.md) for a full step list and user guide.

### Presentation Mode

One-click **Presentation Mode** button in the Demo Control Panel:

1. Resets the bot and clears all market state
2. Clears the circuit breaker
3. Seeds wallets back to baseline (`100,000 USDT`, `1 BTC`, `10 ETH` per exchange)
4. Fires the **profitable-arbitrage** replay scenario
5. Confirms readiness with a Validation Guide checklist

### Fix Demo State

The **Fix Demo State** button (in the Health Preflight panel) performs the same reset as Presentation Mode and is accessible without scrolling to the Demo Control Panel.

### Scenario Health Validation

```
POST /replay/validate-scenarios
```

Returns:
```json
{
  "profitableArbitrage": "PASS",
  "rejectedByFees": "PASS",
  "insufficientLiquidity": "PASS",
  "highLatencyCircuitBreaker": "PASS",
  "lastFiveMinutes": "PASS_WITH_FALLBACK",
  "mode": "DEMO",
  "bufferSize": 0,
  "checkedAt": "2026-05-30T10:00:00.000Z"
}
```

`PASS_WITH_FALLBACK` means the buffer has no data yet — the system falls back to `profitable-arbitrage` automatically.

The **Demo Scenarios Health** panel in the UI calls this endpoint and displays the checklist in real time.

## Quality Checks

```bash
# API unit tests (93 tests across 12 files)
npm test -w @arbix/api

# Web unit tests (32 tests across 3 files)
npm run test -w @arbix/web

# End-to-end demo smoke tests (7 Playwright tests)
npm run test:e2e -w @arbix/web

# Type checking
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.e2e.json

# Build
npm run build

# Lint
npm run lint -w @arbix/web
```

### Test Coverage

| File | Tests | What it validates |
|------|-------|------------------|
| `cost-calculator.spec.ts` | 11 | Net profit calculation with fees, slippage and withdrawal costs |
| `slippage-estimator.spec.ts` | 13 | VWAP and partial fill edge cases |
| `opportunity-scorer.spec.ts` | 2 | Confidence score computation |
| `partial-fill.service.spec.ts` | 1 | Partial fill logic |
| `risk-engine.spec.ts` | 13 | Rejection rules and acceptance |
| `wallet.service.spec.ts` | 10 | Balance tracking, trade application, withdrawal fees, ledger, reset |
| `circuit-breaker.spec.ts` | 11 | Trigger, clear, dedup, events |
| `arbitrage.engine.spec.ts` | 10 | Spread detection, dedup, simulate/reject dispatch |
| `replay.service.spec.ts` | 6 | Scenario catalogue completeness |
| `demo-scenarios.spec.ts` | 8 | Mock adapter scenario behavior |
| `app.config.spec.ts` | 5 | Runtime configuration validation |
| `integration.spec.ts` | 3 | Engine → simulator → wallet → P&L end-to-end |
| Web unit specs | 32 | Tutorial store, opportunity store and formatting helpers |
| Playwright e2e | 7 | Dashboard, Presentation Mode, tutorial launch, scenario, P&L and wallet smoke flow |

## Environment Variables

```bash
MARKET_MODE=DEMO
ENABLE_BINANCE=true
ENABLE_KRAKEN=true
ENABLE_OKX=true
ENABLE_COINBASE=false
DATABASE_URL=postgresql://arbix:arbix@localhost:5432/arbix?schema=public
FRONTEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
GROQ_API_KEY=
```

## Technical Decisions & Trade-offs

### WebSockets over polling

**Decision:** All market data flows through WebSocket connections, not REST polling.
**Why:** Arbitrage windows can close in milliseconds. Polling at 1-second intervals would miss most opportunities. WebSockets deliver sub-100ms latency from exchange to detection.
**Trade-off:** WebSocket connections can drop. The system handles reconnection with backoff and falls back to DEMO mock adapters if a live exchange is unreachable for more than 10 seconds.

### VWAP execution model over best bid/ask

**Decision:** The cost calculator uses VWAP (volume-weighted average price) computed from order-book depth levels, not just the top-of-book price.
**Why:** A trade buying 0.5 BTC at market will consume multiple price levels. Using only the best bid/ask overstates profitability and produces phantom opportunities.
**Trade-off:** More CPU per evaluation. Mitigated by the 3-second deduplication window and 20-second execution cooldown.

### NestJS for the backend

**Decision:** NestJS 11 with TypeScript, dependency injection and a modular module system.
**Why:** Each domain (market data, arbitrage, risk, simulator, analytics) is encapsulated in its own NestJS module with clean dependency injection. This makes testing straightforward — every service can be unit-tested with mocked dependencies.
**Trade-off:** More boilerplate than Express. Acceptable for a platform that needs clear separation of concerns at this scale.

### PostgreSQL optional, in-memory default

**Decision:** Prisma/PostgreSQL is fully optional. The system runs entirely in memory without any database.
**Why:** Demo environments don't always have a database. The `PersistenceService` is fire-and-forget — if it fails, the market data pipeline continues uninterrupted.
**Trade-off:** No persistence between restarts without a database. Acceptable for a hackathon demo.

### DEMO and REPLAY modes for presentation stability

**Decision:** Instead of relying on live market conditions, the system includes scripted `MockExchangeAdapter` scenarios and a replay buffer.
**Why:** Live arbitrage opportunities are rare and unpredictable. A demo that only works when the market cooperates is a risky demo. With DEMO mode, the `profitable-arbitrage` scenario guarantees a visible, explainable outcome in any environment.
**Trade-off:** Mock data is not real. This is acknowledged explicitly in the UI and architecture — the system is a **simulator**, not a trading bot.

### Frontend store architecture (Zustand)

**Decision:** Five Zustand stores manage market, opportunities, analytics, wallets and UI state. Socket.IO events update stores directly.
**Why:** Zustand avoids prop-drilling and enables component-level subscriptions with zero re-render overhead for unrelated components.
**Trade-off:** Stores are initialized with demo data so the UI is never empty, even before the WebSocket connects. After the socket connects, real data flows in and overwrites the demos.

### Shared TypeScript types package

**Decision:** `@arbix/shared` exports all types used by both the frontend and backend.
**Why:** Eliminates the possibility of a schema mismatch between what the API emits and what the frontend expects. If a type changes in the backend, the frontend fails at compile time, not at runtime.
**Trade-off:** Requires rebuilding the shared package on type changes. Handled by the monorepo workspace setup.

### Coinbase adapter scope

Coinbase is optional and disabled by default. Its adapter uses the public ticker feed with an implied depth ladder from best bid/ask (not a real order book). Binance, Kraken and OKX are the primary true order-book venues.

## Known Limitations

- **No real trades**: This is a simulator. No orders are placed on any exchange.
- **Coinbase depth is implied**: Coinbase uses ticker data, not a real order book. Depth numbers are synthetic.
- **Last-5-minutes replay**: Requires the buffer to have accumulated at least 2 events. On a fresh start the system falls back to the `profitable-arbitrage` scenario automatically.
- **USD/USDT wallet isolation**: Wallets are tracked per exchange. USDT on Binance and USDT on Kraken are separate balances; the system does not model cross-exchange transfers.
- **Price marks are static**: The `estimateUsdValue` function uses fixed BTC/ETH marks (68,250 / 3,740). USD totals are approximate.
- **No order routing**: The simulation executes the entire volume at one exchange, not across fragmented order books.

## Demo Day Script

Optimized 5-minute flow for a judging panel:

1. **Open** `http://localhost:3001` — tutorial starts automatically; press Skip after step 2
2. **Explain** the Market Matrix — live quotes from 3 exchanges, spread column, arb signal
3. **Press Presentation Mode** — watch the status chips: "bot reset · circuit breaker cleared · wallets seeded · scenario running"
4. **Point to the Opportunity Feed** — show the EXECUTED trade in green with net profit
5. **Navigate to /opportunities** — click the trade, show the full cost ledger and 8-check rejection audit
6. **Navigate to /simulator** — walk through the execution timeline step by step
7. **Navigate to /wallets** — show the balance change vs. baseline
8. **Back to /dashboard** — run `Fees reject` scenario, show the REJECTED opportunity with "fees exceed spread" reason
9. **Run `High latency`** — show the circuit breaker activate (red banner), then clear it
10. **Navigate to /analytics** — show P&L chart, gross vs net, rejection breakdown
11. **Navigate to /strategy-lab** — show triangular arbitrage (USDT → BTC → ETH → USDT), explain extensibility
12. **Navigate to /settings** — show all configurable risk thresholds
13. **Optional**: start the guided tutorial from the sidebar for a guided judge walkthrough

## Deployment

Frontend: deploy `apps/web` to Vercel with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.

Backend: deploy `apps/api` to Railway, Render or Cloud Run with `DATABASE_URL`, `FRONTEND_URL` and market mode variables.

PostgreSQL: use Supabase, Neon, Railway Postgres or another managed PostgreSQL provider.

For Docker:

```bash
docker compose up --build
```

## Demo Script

See [docs/demo-script.md](docs/demo-script.md).

## Compliance Review

See [docs/compliance-review.md](docs/compliance-review.md) for the challenge coverage matrix, recent hardening notes and suggested next additions.
