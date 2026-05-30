# Technical Decisions

## Monorepo

The project uses npm workspaces so frontend, backend and shared contracts evolve together. Shared types prevent drift between realtime payloads and UI state.

## Exchange Adapters

Each exchange implements the same `ExchangeAdapter` interface. Binance, Kraken and OKX adapters normalize public WebSocket data into `BestQuote` and `NormalizedOrderBook`. Mock and replay adapters follow the same contract so the rest of the platform does not care whether data is live or synthetic.

## Risk-Aware Execution

The engine only simulates a trade after:

- `ask < bid`
- VWAP depth is available
- net profit is positive
- net profit percentage clears the threshold
- latency and order book age are acceptable
- slippage is within limits
- virtual wallets have sufficient balances
- the circuit breaker is inactive

## VWAP

VWAP prevents overestimating profitability from the best level alone. The simulator walks asks for buys and bids for sells, supports partial fill detection and recalculates economics on executable volume.

## Demo Reliability

Hackathon presentations should not depend on market conditions. DEMO and REPLAY modes inject controlled scenarios:

- profitable arbitrage
- fees removing gross spread
- insufficient liquidity
- elevated latency triggering risk controls

The last-5-minutes replay first uses the in-memory market buffer and then falls back to persisted `MarketSnapshot` records when PostgreSQL is available.

## Coinbase Scope

Coinbase is optional and disabled by default. The current adapter consumes the public ticker channel and derives an implied depth ladder from best bid/ask. Binance, Kraken and OKX remain the primary true order-book adapters for the challenge demo.

## UI/UX

The interface uses a dense financial dashboard layout: fixed sidebar, topbar status, metric cards, market matrix, opportunity feed, P&L chart, execution timeline, wallets and risk center. It prioritizes scan speed over marketing presentation.
