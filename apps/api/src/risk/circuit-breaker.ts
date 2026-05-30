import { Injectable } from "@nestjs/common";
import type { RiskEvent } from "@arbix/shared";
import { uid } from "@arbix/shared";
import { PersistenceService } from "../database/persistence.service.js";
import { RealtimeEventsService } from "../realtime/realtime-events.service.js";

@Injectable()
export class CircuitBreaker {
  private active = false;
  private reason: string | undefined;
  private lastTriggeredAt: string | undefined;
  private readonly events: RiskEvent[] = [];

  constructor(
    private readonly realtime: RealtimeEventsService,
    private readonly persistence: PersistenceService
  ) {}

  trigger(reason: string, metadata?: Record<string, unknown>) {
    if (this.active && this.reason === reason) return;
    this.active = true;
    this.reason = reason;
    this.lastTriggeredAt = new Date().toISOString();
    const event: RiskEvent = {
      id: uid("risk"),
      type: "CIRCUIT_BREAKER_TRIGGERED",
      severity: "CRITICAL",
      message: reason,
      ...(metadata ? { metadata } : {}),
      createdAt: this.lastTriggeredAt
    };
    this.events.unshift(event);
    if (this.events.length > 100) this.events.length = 100;
    this.persistence.saveRiskEvent(event);
    this.realtime.publish("risk.circuit_breaker.triggered", event);
  }

  clear(reason = "Circuit breaker cleared manually") {
    this.active = false;
    this.reason = undefined;
    const event: RiskEvent = {
      id: uid("risk"),
      type: "CIRCUIT_BREAKER_CLEARED",
      severity: "INFO",
      message: reason,
      createdAt: new Date().toISOString()
    };
    this.events.unshift(event);
    if (this.events.length > 100) this.events.length = 100;
    this.persistence.saveRiskEvent(event);
    this.realtime.publish("risk.circuit_breaker.cleared", event);
  }

  isActive() {
    return this.active;
  }

  getReason() {
    return this.reason;
  }

  getLastTriggeredAt() {
    return this.lastTriggeredAt;
  }

  getEvents() {
    return this.events.slice(0, 50);
  }
}
