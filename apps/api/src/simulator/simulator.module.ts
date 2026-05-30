import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { ExecutionSimulator } from "./execution-simulator.js";
import { PartialFillService } from "./partial-fill.service.js";
import { PnlService } from "./pnl.service.js";
import { SimulatorController } from "./simulator.controller.js";
import { WalletService } from "./wallet.service.js";

@Module({
  imports: [RealtimeModule],
  controllers: [SimulatorController],
  providers: [ExecutionSimulator, WalletService, PartialFillService, PnlService],
  exports: [ExecutionSimulator, WalletService, PartialFillService, PnlService]
})
export class SimulatorModule {}
