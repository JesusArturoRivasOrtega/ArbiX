import { describe, expect, it } from "vitest";
import { PartialFillService } from "./partial-fill.service.js";

describe("PartialFillService", () => {
  it("returns executable amount and remaining amount", () => {
    const service = new PartialFillService();
    const result = service.calculateVwap(
      [
        { price: 10, quantity: 2 },
        { price: 12, quantity: 1 }
      ],
      4
    );

    expect(result.filledAmount).toBe(3);
    expect(result.averagePrice).toBeCloseTo(10.666666);
    expect(result.isPartialFill).toBe(true);
    expect(result.remainingAmount).toBe(1);
  });
});
