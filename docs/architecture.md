# Architecture

ArbiX is a TypeScript monorepo with a Next.js dashboard and a NestJS realtime backend.

```mermaid
flowchart TB
  subgraph Exchanges
    BIN[Binance WS]
    KRA[Kraken WS]
    OKX[OKX WS]
    MOCK[Mock/Replay]
  end

  subgraph API[NestJS API]
    ADP[Exchange Adapters]
    OBS[Order Book Store]
    ARB[Arbitrage Engine]
    VWAP[VWAP + Slippage]
    COST[Cost Calculator]
    RISK[Risk Engine + Circuit Breaker]
    SIM[Execution Simulator]
    WAL[Virtual Wallets]
    PNL[P&L Service]
    GW[Socket.IO Gateway]
    DB[(PostgreSQL + Prisma)]
  end

  subgraph WEB[Next.js Dashboard]
    DASH[Dashboard]
    OPPS[Opportunity Feed]
    SIMUI[Execution Simulator UI]
    RISKUI[Risk Center]
    LAB[Strategy Lab]
  end

  BIN --> ADP
  KRA --> ADP
  OKX --> ADP
  MOCK --> ADP
  ADP --> OBS
  OBS --> ARB
  ARB --> VWAP
  VWAP --> COST
  COST --> RISK
  RISK --> SIM
  SIM --> WAL
  SIM --> PNL
  ARB --> DB
  SIM --> DB
  GW --> WEB
  ARB --> GW
  WAL --> GW
  PNL --> GW
```

## Backend Modules

- `market-data`: exchange adapters, symbol normalization and order book state.
- `arbitrage`: cross-exchange comparison, VWAP, cost calculation, scoring and triangular watch-only service.
- `risk`: latency checks, stale data protection and circuit breaker.
- `simulator`: virtual execution, partial fills, wallets and P&L.
- `analytics`: summaries for charts and replay scenario metadata.
- `realtime`: Socket.IO gateway and event publisher.
- `database`: Prisma service and schema.

## Realtime Events

Backend to frontend:

- `market.quote.updated`
- `market.orderbook.updated`
- `opportunity.detected`
- `opportunity.rejected`
- `opportunity.executed`
- `trade.simulated`
- `wallet.updated`
- `pnl.updated`
- `risk.circuit_breaker.triggered`
- `risk.circuit_breaker.cleared`
- `analytics.updated`
- `risk.status.updated`
- `opportunities.updated`
- `exchanges.status.updated`
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
- `wallet.reset`
- `replay.start`
- `replay.scenario`
- `latency.ack`

## Safety Model

ArbiX never executes real trades. It does not request private exchange keys. Every execution is simulated against normalized public or synthetic market data.
