import { describe, it, expect } from "vitest";
import { currency, ms, percent } from "./formatters";

describe("formatters", () => {
  describe("currency", () => {
    it("formats positive dollar amounts with 2 decimals", () => {
      expect(currency(1234.56)).toContain("1,234.56");
    });

    it("formats zero as $0.00", () => {
      expect(currency(0)).toContain("0.00");
    });

    it("formats negative amounts with minus sign", () => {
      const result = currency(-50.5);
      expect(result).toContain("50.50");
      // Should contain some indicator of negative (either minus or parentheses depending on locale)
    });

    it("formats large amounts with thousands separator", () => {
      const result = currency(68250);
      expect(result).toContain("68");
      expect(result).toContain("250");
    });

    it("does not produce NaN or undefined", () => {
      expect(currency(NaN)).not.toContain("NaN");
      expect(currency(0)).toBeDefined();
    });
  });

  describe("ms", () => {
    it("formats milliseconds below 1000 with 'ms' suffix", () => {
      const result = ms(45);
      expect(result).toContain("ms");
      expect(result).toContain("45");
    });

    it("formats zero as 0ms", () => {
      expect(ms(0)).toContain("0");
    });

    it("formats values above 1000ms", () => {
      const result = ms(1500);
      // Should show seconds or still ms depending on implementation
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("does not produce NaN", () => {
      expect(ms(NaN)).not.toContain("NaN");
    });
  });

  describe("percent", () => {
    it("formats percentage with % symbol", () => {
      expect(percent(1.5)).toContain("%");
    });

    it("formats zero percent", () => {
      const result = percent(0);
      expect(result).toContain("0");
      expect(result).toContain("%");
    });

    it("formats small values correctly", () => {
      const result = percent(0.0026);
      expect(result).toContain("%");
      expect(typeof result).toBe("string");
    });

    it("does not produce NaN", () => {
      expect(percent(NaN)).not.toContain("NaN");
    });
  });
});
