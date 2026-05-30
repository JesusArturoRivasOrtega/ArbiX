import { Injectable } from "@nestjs/common";

@Injectable()
export class ReplayService {
  getScenarios() {
    return [
      {
        name: "profitable-arbitrage",
        label: "Demo: profitable arbitrage",
        description: "Creates a controlled BTC/USDT spread that survives fees, slippage and risk checks."
      },
      {
        name: "rejected-by-fees",
        label: "Demo: rejected by fees",
        description: "Creates a gross spread that disappears after exchange fees."
      },
      {
        name: "insufficient-liquidity",
        label: "Demo: insufficient liquidity",
        description: "Creates a spread with shallow depth to demonstrate partial-fill controls."
      },
      {
        name: "high-latency-circuit-breaker",
        label: "Demo: high latency circuit breaker",
        description: "Injects stale market data and triggers risk controls."
      }
    ];
  }
}
