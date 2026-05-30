import { Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CircuitBreaker } from "./circuit-breaker.js";
import { RiskEngine } from "./risk-engine.js";

@ApiTags("risk")
@Controller("risk")
export class RiskController {
  constructor(
    private readonly risk: RiskEngine,
    private readonly breaker: CircuitBreaker
  ) {}

  @Get("status")
  getStatus() {
    return this.risk.getStatus();
  }

  @Get("events")
  getEvents() {
    return this.breaker.getEvents();
  }

  @Post("circuit-breaker/clear")
  clear() {
    this.risk.clearCircuitBreaker();
    return this.risk.getStatus();
  }
}
