import { Injectable } from "@nestjs/common";
import type { BestQuote } from "@arbix/shared";

const WINDOW_MS = 300_000; // 5 minutes

@Injectable()
export class MarketDataBufferService {
  private readonly buffer: Array<{ quote: BestQuote; ts: number }> = [];

  push(quote: BestQuote) {
    const now = Date.now();
    this.buffer.push({ quote, ts: now });
    const cutoff = now - WINDOW_MS;
    let evict = 0;
    while (evict < this.buffer.length && (this.buffer[evict]?.ts ?? 0) < cutoff) evict++;
    if (evict > 0) this.buffer.splice(0, evict);
  }

  getSnapshot(): Array<{ quote: BestQuote; ts: number }> {
    return [...this.buffer];
  }

  size() {
    return this.buffer.length;
  }

  clear() {
    this.buffer.length = 0;
  }
}
