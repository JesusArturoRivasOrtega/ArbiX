import { Injectable } from "@nestjs/common";
import type { NormalizedOrderBook } from "@arbix/shared";
import { AppConfigService } from "../config/app.config.js";

@Injectable()
export class StaleDataGuard {
  constructor(private readonly config: AppConfigService) {}

  isStale(orderBook: NormalizedOrderBook, now = Date.now()) {
    return now - orderBook.normalizedAt > this.config.risk.maxOrderBookAgeMs;
  }
}
