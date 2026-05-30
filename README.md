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
POST  /bot/start
POST  /bot/stop
POST  /bot/pause
POST  /bot/reset
POST  /wallets/reset
POST  /risk/circuit-breaker/clear
GET   /strategy-lab/triangular
```

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
| Web | http://localhost:3000 |
| API health | http://localhost:4000/health |
| Socket.IO | http://localhost:4000 |

## Quality Checks

```bash
npm test -w @arbix/api
npm run lint -w @arbix/web
npm run build
```

## Environment Variables

```bash
MARKET_MODE=DEMO
ENABLE_BINANCE=true
ENABLE_KRAKEN=true
ENABLE_OKX=true
ENABLE_COINBASE=false
DATABASE_URL=postgresql://arbix:arbix@localhost:5432/arbix?schema=public
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

## Technical Decisions

### Why WebSockets instead of polling?

WebSockets reduce latency and allow the system to react to market updates in near real time.

### Why NestJS instead of Express?

NestJS provides modular architecture, dependency injection and clean separation of concerns.

### Why VWAP instead of simple best bid/ask?

Best bid/ask can overestimate profitability. VWAP estimates execution against actual order-book depth.

### Why simulation instead of real trading?

The challenge is about simulated execution. This avoids private API keys and financial risk.

### Why PostgreSQL?

The system stores opportunities, trades, wallet balances, risk events, market snapshots, order-book snapshots, latency metrics and replay events.

### Why demo/replay mode?

Hackathon demos must remain stable even if market APIs fail or no arbitrage appears during presentation.

### Coinbase adapter scope

Coinbase is optional and disabled by default. Its current adapter uses the public ticker feed and builds an implied depth ladder from best bid/ask, while Binance, Kraken and OKX are the primary true order-book venues.

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
