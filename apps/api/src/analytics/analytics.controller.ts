import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { MetricsService } from "./metrics.service.js";
import { PerformanceSummaryService } from "./performance-summary.service.js";
import { ReplayService } from "./replay.service.js";

@ApiTags("analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly performance: PerformanceSummaryService,
    private readonly replay: ReplayService
  ) {}

  @Get("summary")
  getSummary() {
    return this.metrics.getSummary();
  }

  @Get("performance")
  getPerformance() {
    return this.performance.getExecutiveSummary();
  }

  @Get("replay-scenarios")
  getReplayScenarios() {
    return this.replay.getScenarios();
  }
}
