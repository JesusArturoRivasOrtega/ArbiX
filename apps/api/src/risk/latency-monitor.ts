import { Injectable } from "@nestjs/common";
import type { ExchangeName, LatencyExchangeStats } from "@arbix/shared";

const WINDOW_SIZE = 200;

@Injectable()
export class LatencyMonitor {
  private readonly latencies = new Map<ExchangeName, number[]>();

  update(exchange: ExchangeName, latencyMs: number) {
    const buffer = this.latencies.get(exchange) ?? [];
    buffer.push(Math.max(0, latencyMs));
    if (buffer.length > WINDOW_SIZE) buffer.splice(0, buffer.length - WINDOW_SIZE);
    this.latencies.set(exchange, buffer);
  }

  clear() {
    this.latencies.clear();
  }

  getHighestLatency() {
    let max = 0;
    for (const buffer of this.latencies.values()) {
      for (const value of buffer) {
        if (value > max) max = value;
      }
    }
    return max;
  }

  getByExchange(): LatencyExchangeStats[] {
    return [...this.latencies.entries()].map(([exchange, buffer]) => {
      const samples = buffer.length;
      if (samples === 0) {
        return { exchange, latencyMs: 0, p50: 0, p95: 0, max: 0, avg: 0, samples: 0 };
      }
      const sorted = [...buffer].sort((a, b) => a - b);
      const sum = buffer.reduce((acc, value) => acc + value, 0);
      const avg = sum / samples;
      const max = sorted[samples - 1] ?? 0;
      const p50 = percentile(sorted, 0.5);
      const p95 = percentile(sorted, 0.95);
      const latencyMs = buffer[buffer.length - 1] ?? 0;
      return { exchange, latencyMs, p50, p95, max, avg, samples };
    });
  }
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const value = sorted[base] ?? 0;
  const next = sorted[base + 1] ?? value;
  return value + (next - value) * rest;
}
