import { describe, expect, it, vi, beforeEach } from "vitest";
import { CircuitBreaker } from "./circuit-breaker.js";

const mockRealtime = { publish: vi.fn() };
const mockPersistence = { saveRiskEvent: vi.fn() };

function makeBreaker() {
  return new CircuitBreaker(mockRealtime as never, mockPersistence as never);
}

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts inactive", () => {
    const cb = makeBreaker();
    expect(cb.isActive()).toBe(false);
    expect(cb.getReason()).toBeUndefined();
  });

  it("becomes active when triggered", () => {
    const cb = makeBreaker();
    cb.trigger("Latency exceeded 1500ms");
    expect(cb.isActive()).toBe(true);
    expect(cb.getReason()).toBe("Latency exceeded 1500ms");
  });

  it("emits the risk event when triggered", () => {
    const cb = makeBreaker();
    cb.trigger("Stale order book data");
    expect(mockRealtime.publish).toHaveBeenCalledWith(
      "risk.circuit_breaker.triggered",
      expect.objectContaining({ type: "CIRCUIT_BREAKER_TRIGGERED" })
    );
    expect(mockPersistence.saveRiskEvent).toHaveBeenCalledOnce();
  });

  it("deduplicates identical consecutive triggers", () => {
    const cb = makeBreaker();
    cb.trigger("Latency exceeded 1500ms");
    cb.trigger("Latency exceeded 1500ms");
    expect(mockRealtime.publish).toHaveBeenCalledOnce();
  });

  it("allows a different reason after being triggered", () => {
    const cb = makeBreaker();
    cb.trigger("Reason A");
    cb.trigger("Reason B"); // different reason → should re-trigger
    expect(mockRealtime.publish).toHaveBeenCalledTimes(2);
  });

  it("clears and becomes inactive", () => {
    const cb = makeBreaker();
    cb.trigger("Some reason");
    cb.clear("Operator cleared");
    expect(cb.isActive()).toBe(false);
    expect(cb.getReason()).toBeUndefined();
  });

  it("emits the cleared event", () => {
    const cb = makeBreaker();
    cb.trigger("Some reason");
    vi.clearAllMocks();
    cb.clear("Operator cleared");
    expect(mockRealtime.publish).toHaveBeenCalledWith(
      "risk.circuit_breaker.cleared",
      expect.objectContaining({ type: "CIRCUIT_BREAKER_CLEARED" })
    );
  });

  it("uses default reason when clear is called without message", () => {
    const cb = makeBreaker();
    cb.trigger("Some reason");
    cb.clear();
    expect(mockRealtime.publish).toHaveBeenCalledWith(
      "risk.circuit_breaker.cleared",
      expect.objectContaining({ message: "Circuit breaker cleared manually" })
    );
  });

  it("can be triggered again after being cleared", () => {
    const cb = makeBreaker();
    cb.trigger("First trigger");
    cb.clear();
    cb.trigger("Second trigger");
    expect(cb.isActive()).toBe(true);
    expect(cb.getReason()).toBe("Second trigger");
  });

  it("records events in history", () => {
    const cb = makeBreaker();
    cb.trigger("Event 1");
    cb.clear();
    cb.trigger("Event 2");
    const events = cb.getEvents();
    expect(events.length).toBe(3);
  });

  it("getLastTriggeredAt returns ISO timestamp", () => {
    const cb = makeBreaker();
    const before = Date.now();
    cb.trigger("Test");
    const ts = cb.getLastTriggeredAt();
    expect(ts).toBeDefined();
    expect(new Date(ts!).getTime()).toBeGreaterThanOrEqual(before);
  });
});
