import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ArbitrageEngine } from "./arbitrage.engine.js";
import { TriangularArbitrageService } from "./triangular-arbitrage.service.js";

@ApiTags("opportunities")
@Controller()
export class ArbitrageController {
  constructor(
    private readonly engine: ArbitrageEngine,
    private readonly triangular: TriangularArbitrageService
  ) {}

  @Get("opportunities")
  getOpportunities() {
    return this.engine.getOpportunities();
  }

  @Get("strategy-lab/triangular")
  getTriangular() {
    return this.triangular.getWatchOnlySnapshot();
  }

  @Post("strategy-lab/triangular/simulate")
  simulateTriangular() {
    return this.triangular.simulate();
  }

  @Get("strategy-lab/triangular/last-simulation")
  getLastTriangularSimulation() {
    return this.triangular.getLastSimulation() ?? null;
  }
}
