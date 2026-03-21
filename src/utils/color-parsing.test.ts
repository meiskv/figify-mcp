import { describe, it, expect } from "vitest";
import { parseColor, rgbToHex } from "./color-parsing";

describe("Color Parsing Utilities", () => {
  describe("parseColor - RGB/RGBA", () => {
    it("parses modern space-separated rgb()", () => {
      const result = parseColor("rgb(255 0 0)");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it("parses modern space-separated rgba() with slash separator", () => {
      const result = parseColor("rgba(255 0 0 / 0.5)");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    });

    it("parses legacy comma-separated rgb()", () => {
      const result = parseColor("rgb(255, 0, 0)");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it("parses legacy comma-separated rgba()", () => {
      const result = parseColor("rgba(255, 0, 0, 0.5)");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 0.5 });
    });

    it("normalizes RGB values to 0-1 range", () => {
      const result = parseColor("rgb(128 128 128)");
      expect(result?.r).toBeCloseTo(128 / 255, 2);
      expect(result?.g).toBeCloseTo(128 / 255, 2);
      expect(result?.b).toBeCloseTo(128 / 255, 2);
    });

    it("defaults alpha to 1 when not specified", () => {
      const result = parseColor("rgb(100 200 50)");
      expect(result?.a).toBe(1);
    });
  });

  describe("parseColor - Hex", () => {
    it("parses #rgb format", () => {
      const result = parseColor("#f00");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it("parses #rrggbb format", () => {
      const result = parseColor("#ff0000");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it("parses #rrggbbaa format", () => {
      const result = parseColor("#ff000080");
      expect(result?.r).toBe(1);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(0);
      expect(result?.a).toBeCloseTo(128 / 255, 2);
    });

    it("handles mixed case hex", () => {
      const result = parseColor("#FF0000");
      expect(result).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });

    it("doubles single digits in #rgb", () => {
      const result = parseColor("#abc");
      expect(result?.r).toBeCloseTo(0xaa / 255, 2);
      expect(result?.g).toBeCloseTo(0xbb / 255, 2);
      expect(result?.b).toBeCloseTo(0xcc / 255, 2);
    });
  });

  describe("parseColor - OKLab", () => {
    it("parses oklab() with space-separated values", () => {
      const result = parseColor("oklab(0.5 0 0)");
      expect(result).toBeDefined();
      expect(result?.a).toBe(1);
    });

    it("parses oklab() with slash-separated alpha", () => {
      const result = parseColor("oklab(0.5 0 0 / 0.8)");
      expect(result?.a).toBe(0.8);
    });

    it("converts OKLab to RGB correctly", () => {
      // oklab(0.5 0 0) should convert to neutral gray
      const result = parseColor("oklab(0.5 0 0)");
      expect(result).toBeDefined();
      if (result) {
        // All components should be roughly equal (gray)
        expect(Math.abs(result.r - result.g)).toBeLessThan(0.01);
        expect(Math.abs(result.g - result.b)).toBeLessThan(0.01);
      }
    });

    it("clamps RGB values to 0-1 range", () => {
      const result = parseColor("oklab(1 0.4 0.4)");
      expect(result?.r).toBeLessThanOrEqual(1);
      expect(result?.g).toBeLessThanOrEqual(1);
      expect(result?.b).toBeLessThanOrEqual(1);
      expect(result?.r).toBeGreaterThanOrEqual(0);
      expect(result?.g).toBeGreaterThanOrEqual(0);
      expect(result?.b).toBeGreaterThanOrEqual(0);
    });
  });

  describe("parseColor - LAB", () => {
    it("parses lab() with space-separated values", () => {
      const result = parseColor("lab(50 0 0)");
      expect(result).toBeDefined();
      expect(result?.a).toBe(1);
    });

    it("parses lab() with slash-separated alpha", () => {
      const result = parseColor("lab(50 0 0 / 0.5)");
      expect(result?.a).toBe(0.5);
    });

    it("converts LAB to RGB correctly", () => {
      // lab(50 0 0) should convert to neutral gray
      const result = parseColor("lab(50 0 0)");
      expect(result).toBeDefined();
      if (result) {
        // All components should be roughly equal (gray)
        expect(Math.abs(result.r - result.g)).toBeLessThan(0.01);
        expect(Math.abs(result.g - result.b)).toBeLessThan(0.01);
      }
    });

    it("clamps RGB values to 0-1 range", () => {
      const result = parseColor("lab(100 100 100)");
      expect(result?.r).toBeLessThanOrEqual(1);
      expect(result?.g).toBeLessThanOrEqual(1);
      expect(result?.b).toBeLessThanOrEqual(1);
      expect(result?.r).toBeGreaterThanOrEqual(0);
      expect(result?.g).toBeGreaterThanOrEqual(0);
      expect(result?.b).toBeGreaterThanOrEqual(0);
    });
  });

  describe("parseColor - Special Cases", () => {
    it("returns null for transparent", () => {
      expect(parseColor("transparent")).toBeNull();
    });

    it("returns null for rgba(0, 0, 0, 0)", () => {
      expect(parseColor("rgba(0, 0, 0, 0)")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseColor("")).toBeNull();
    });

    it("returns null for unsupported color format", () => {
      expect(parseColor("red")).toBeNull();
      expect(parseColor("invalid")).toBeNull();
      expect(parseColor("color(srgb 1 0 0)")).toBeNull();
    });
  });

  describe("rgbToHex", () => {
    it("converts parsed color to hex without alpha", () => {
      const color = { r: 1, g: 0, b: 0, a: 1 };
      expect(rgbToHex(color)).toBe("#ff0000");
    });

    it("converts partial color to hex", () => {
      const color = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
      expect(rgbToHex(color)).toBe("#808080");
    });

    it("includes alpha when requested and less than 1", () => {
      const color = { r: 1, g: 0, b: 0, a: 0.5 };
      expect(rgbToHex(color, true)).toBe("#ff000080");
    });

    it("ignores alpha when includeAlpha is false", () => {
      const color = { r: 1, g: 0, b: 0, a: 0.5 };
      expect(rgbToHex(color, false)).toBe("#ff0000");
    });

    it("omits alpha when includeAlpha is true but alpha is 1", () => {
      const color = { r: 1, g: 0, b: 0, a: 1 };
      expect(rgbToHex(color, true)).toBe("#ff0000");
    });

    it("pads hex values with leading zeros", () => {
      const color = { r: 0.05, g: 0.1, b: 0.15, a: 1 };
      const hex = rgbToHex(color);
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe("Round-trip conversion", () => {
    it("converts hex -> rgb -> hex correctly", () => {
      const original = "#ff5500";
      const parsed = parseColor(original);
      expect(parsed).toBeDefined();
      if (parsed) {
        const converted = rgbToHex(parsed);
        expect(converted).toBe(original);
      }
    });

    it("converts rgb -> hex -> rgb preserves values", () => {
      const original = "rgb(100 150 200)";
      const parsed = parseColor(original);
      expect(parsed).toBeDefined();
      if (parsed) {
        const hex = rgbToHex(parsed);
        const reparsed = parseColor(hex);
        expect(reparsed?.r).toBeCloseTo(parsed.r, 2);
        expect(reparsed?.g).toBeCloseTo(parsed.g, 2);
        expect(reparsed?.b).toBeCloseTo(parsed.b, 2);
      }
    });
  });
});
