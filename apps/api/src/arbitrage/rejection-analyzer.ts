import { Injectable } from "@nestjs/common";
import type { RejectionReason } from "@arbix/shared";

const MESSAGES: Record<RejectionReason, string> = {
  NET_PROFIT_NEGATIVE: "net profit became negative after fees and slippage",
  FEES_EXCEED_SPREAD: "fees exceeded spread",
  INSUFFICIENT_LIQUIDITY: "insufficient liquidity",
  STALE_ORDER_BOOK: "stale data protection triggered",
  LATENCY_TOO_HIGH: "latency too high",
  INSUFFICIENT_WALLET_BALANCE: "insufficient wallet balance",
  SLIPPAGE_TOO_HIGH: "slippage too high",
  BELOW_MIN_PROFIT_THRESHOLD: "below minimum net profit threshold",
  CIRCUIT_BREAKER_ACTIVE: "circuit breaker active",
  PARTIAL_FILL_NOT_ALLOWED: "partial fill not allowed",
  EXCHANGE_DISCONNECTED: "exchange disconnected",
  PRICE_ANOMALY: "price anomaly - possible flash crash or data error, skipping for safety"
};

@Injectable()
export class RejectionAnalyzer {
  humanize(reason?: RejectionReason) {
    return reason ? `Rejected - ${MESSAGES[reason]}` : undefined;
  }

  explain(reason?: RejectionReason) {
    return reason ? MESSAGES[reason] : undefined;
  }
}
