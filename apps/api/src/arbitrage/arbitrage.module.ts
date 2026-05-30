import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module.js";
import { OrderBookStoreModule } from "../market-data/order-book-store.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
import { RiskModule } from "../risk/risk.module.js";
import { SimulatorModule } from "../simulator/simulator.module.js";
import { ArbitrageController } from "./arbitrage.controller.js";
import { ArbitrageEngine } from "./arbitrage.engine.js";
import { CostCalculator } from "./cost-calculator.js";
import { OpportunityClassifier } from "./opportunity-classifier.js";
import { OpportunityScorer } from "./opportunity.scorer.js";
import { RejectionAnalyzer } from "./rejection-analyzer.js";
import { SlippageEstimator } from "./slippage-estimator.js";
import { TriangularArbitrageService } from "./triangular-arbitrage.service.js";

@Module({
  imports: [AppConfigModule, OrderBookStoreModule, RealtimeModule, RiskModule, SimulatorModule],
  controllers: [ArbitrageController],
  providers: [
    ArbitrageEngine,
    CostCalculator,
    SlippageEstimator,
    OpportunityScorer,
    OpportunityClassifier,
    RejectionAnalyzer,
    TriangularArbitrageService
  ],
  exports: [ArbitrageEngine, CostCalculator, SlippageEstimator, OpportunityScorer, RejectionAnalyzer, TriangularArbitrageService]
})
export class ArbitrageModule {}
