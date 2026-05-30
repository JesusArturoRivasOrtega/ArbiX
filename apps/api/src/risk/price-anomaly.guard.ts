import { Injectable, Logger } from "@nestjs/common";

const WINDOW_SIZE = 30;
const ANOMALY_THRESHOLD_PCT = 5;
const MIN_SAMPLES_REQUIRED = 5;

@Injectable()
export class PriceAnomalyGuard {
  private readonly logger = new Logger(PriceAnomalyGuard.name);
  private readonly history = new Map<string, number[]>();

  update(exchange: string, symbol: string, price: number) {
    const key = `${exchange}:${symbol}`;
    const prices = this.history.get(key) ?? [];
    prices.push(price);
    if (prices.length > WINDOW_SIZE) prices.shift();
    this.history.set(key, prices);
  }

  isAnomaly(exchange: string, symbol: string, price: number): boolean {
    const key = `${exchange}:${symbol}`;
    const prices = this.history.get(key) ?? [];
    if (prices.length < MIN_SAMPLES_REQUIRED) return false;

    const sorted = [...prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const deviationPct = (Math.abs(price - median) / median) * 100;

    if (deviationPct > ANOMALY_THRESHOLD_PCT) {
      this.logger.warn(
        `Price anomaly on ${exchange} ${symbol}: ${price.toFixed(2)} deviates ${deviationPct.toFixed(2)}% from median ${median.toFixed(2)}`
      );
      return true;
    }
    return false;
  }
}
