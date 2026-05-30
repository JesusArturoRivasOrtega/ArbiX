import type { ExchangeName, TradingSymbol } from "@arbix/shared";
import { MockExchangeAdapter } from "./mock-exchange.adapter.js";

export class ReplayExchangeAdapter extends MockExchangeAdapter {
  override readonly mode = "REPLAY" as const;

  constructor(name: ExchangeName) {
    super(name);
  }

  override async connect(symbols: TradingSymbol[]) {
    await super.connect(symbols);
    this.setScenario("profitable");
  }
}
