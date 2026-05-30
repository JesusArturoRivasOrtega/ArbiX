import { Injectable } from "@nestjs/common";
import type { OpportunityStatus, Recommendation, RejectionReason } from "@arbix/shared";

@Injectable()
export class OpportunityClassifier {
  classify(recommendation: Recommendation, rejectionReasons: RejectionReason[], autoSimulationEnabled: boolean): OpportunityStatus {
    if (rejectionReasons.length > 0 || recommendation === "REJECT") return "REJECTED";
    if (recommendation === "WATCH" || !autoSimulationEnabled) return "WATCHING";
    return "EXECUTED";
  }
}
