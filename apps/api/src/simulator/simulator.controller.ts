import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ExecutionSimulator } from "./execution-simulator.js";
import { PnlService } from "./pnl.service.js";
import { WalletService } from "./wallet.service.js";

@ApiTags("simulator")
@Controller()
export class SimulatorController {
  constructor(
    private readonly simulator: ExecutionSimulator,
    private readonly wallets: WalletService,
    private readonly pnl: PnlService
  ) {}

  @Get("trades")
  getTrades() {
    return this.pnl.getTrades();
  }

  @Get("simulator/last-trade")
  getLastTrade() {
    return this.simulator.getLastTrade() ?? null;
  }

  @Get("wallets")
  getWallets() {
    return {
      balances: this.wallets.getBalances(),
      ledger: this.wallets.getLedger()
    };
  }

  @Post("wallets/reset")
  resetWallets() {
    this.wallets.reset();
    return {
      balances: this.wallets.getBalances(),
      ledger: this.wallets.getLedger()
    };
  }
}
