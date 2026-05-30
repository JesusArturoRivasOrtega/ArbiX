import { describe, expect, it } from "vitest";
import { ReplayService } from "./replay.service.js";

describe("ReplayService", () => {
  const service = new ReplayService();

  it("returns all 4 expected demo scenarios", () => {
    const scenarios = service.getScenarios();
    expect(scenarios).toHaveLength(4);
  });

  it("includes profitable-arbitrage scenario", () => {
    const scenarios = service.getScenarios();
    const found = scenarios.find((s) => s.name === "profitable-arbitrage");
    expect(found).toBeDefined();
    expect(found!.label).toBeTruthy();
    expect(found!.description).toBeTruthy();
  });

  it("includes rejected-by-fees scenario", () => {
    const scenarios = service.getScenarios();
    expect(scenarios.some((s) => s.name === "rejected-by-fees")).toBe(true);
  });

  it("includes insufficient-liquidity scenario", () => {
    const scenarios = service.getScenarios();
    expect(scenarios.some((s) => s.name === "insufficient-liquidity")).toBe(true);
  });

  it("includes high-latency-circuit-breaker scenario", () => {
    const scenarios = service.getScenarios();
    expect(scenarios.some((s) => s.name === "high-latency-circuit-breaker")).toBe(true);
  });

  it("each scenario has name, label and description", () => {
    const scenarios = service.getScenarios();
    for (const scenario of scenarios) {
      expect(typeof scenario.name).toBe("string");
      expect(scenario.name.length).toBeGreaterThan(0);
      expect(typeof scenario.label).toBe("string");
      expect(scenario.label.length).toBeGreaterThan(0);
      expect(typeof scenario.description).toBe("string");
      expect(scenario.description.length).toBeGreaterThan(0);
    }
  });
});
