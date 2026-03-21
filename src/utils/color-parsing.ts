/**
 * Color parsing utilities for DOM element extraction
 * Converts CSS color strings to normalized RGB values for Figma
 *
 * Supports:
 * - RGB/RGBA (both modern space-separated and legacy comma-separated)
 * - OKLab (Tailwind CSS v3+) with full color space conversion
 * - CIELAB with XYZ conversion to RGB
 * - Hex (#rgb, #rrggbb, #rrggbbaa)
 */

export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parse CSS color string to normalized RGB values (0-1 range)
 * @param colorStr CSS color string
 * @returns Normalized color object or null if parsing fails
 */
export function parseColor(colorStr: string): ParsedColor | null {
  if (!colorStr || colorStr === "transparent" || colorStr === "rgba(0, 0, 0, 0)") {
    return null;
  }

  // Handle rgb() and rgba() - both modern (space-separated) and legacy (comma-separated)
  // Matches: rgb(255 0 0), rgba(255 0 0 / 0.5), rgb(255, 0, 0), rgba(255, 0, 0, 0.5)
  const rgbMatch = colorStr.match(/rgba?\(([\d.]+)[,\s]\s*([\d.]+)[,\s]\s*([\d.]+)(?:[,\s/]\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: Math.min(1, parseFloat(rgbMatch[1]) / 255),
      g: Math.min(1, parseFloat(rgbMatch[2]) / 255),
      b: Math.min(1, parseFloat(rgbMatch[3]) / 255),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // Handle oklab() - OKLab color space (Tailwind CSS v3+)
  // oklab(L a b / alpha)
  // Reference: https://oklch.com/
  const oklabMatch = colorStr.match(/oklab\(([\d.]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (oklabMatch) {
    const L = parseFloat(oklabMatch[1]);
    const a = parseFloat(oklabMatch[2]);
    const b = parseFloat(oklabMatch[3]);
    const alpha = oklabMatch[4] !== undefined ? parseFloat(oklabMatch[4]) : 1;

    // OKLab to Linear RGB conversion
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    return {
      r: Math.max(0, Math.min(1, 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)),
      g: Math.max(0, Math.min(1, -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)),
      b: Math.max(0, Math.min(1, -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3)),
      a: alpha,
    };
  }

  // Handle lab() - CIELAB color space
  // lab(L a b / alpha)
  // Reference: https://en.wikipedia.org/wiki/CIELAB_color_space
  const labMatch = colorStr.match(/lab\(([\d.]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (labMatch) {
    const L = parseFloat(labMatch[1]);
    const aLab = parseFloat(labMatch[2]);
    const bLab = parseFloat(labMatch[3]);
    const alpha = labMatch[4] !== undefined ? parseFloat(labMatch[4]) : 1;

    // LAB to XYZ conversion
    const fy = (L + 16) / 116;
    const fx = aLab / 500 + fy;
    const fz = fy - bLab / 200;

    // Inverse companding function
    const cube = (f: number): number => (f > 0.206897 ? f * f * f : (f - 16 / 116) / 7.787);

    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    const X = cube(fx) * xn;
    const Y = L > 8 ? Math.pow((L + 16) / 116, 3) * yn : (L / 903.3) * yn;
    const Z = cube(fz) * zn;

    // XYZ to linear RGB conversion (D65 illuminant)
    const gamma = (c: number): number =>
      c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;

    return {
      r: Math.max(0, Math.min(1, gamma(3.2406 * X - 1.5372 * Y - 0.4986 * Z))),
      g: Math.max(0, Math.min(1, gamma(-0.9689 * X + 1.8758 * Y + 0.0415 * Z))),
      b: Math.max(0, Math.min(1, gamma(0.0557 * X - 0.204 * Y + 1.057 * Z))),
      a: alpha,
    };
  }

  // Handle hex colors: #rgb, #rrggbb, #rrggbbaa
  const hexMatch = colorStr.match(/^#([a-fA-F0-9]{3,8})$/);
  if (hexMatch) {
    const hex = hexMatch[1];

    if (hex.length === 3) {
      // #rgb - duplicate each digit
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: 1,
      };
    }

    if (hex.length === 6) {
      // #rrggbb
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: 1,
      };
    }

    if (hex.length === 8) {
      // #rrggbbaa
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // Unsupported color format
  return null;
}

/**
 * Convert normalized RGB (0-1) to hex string
 * @param color Parsed color object
 * @param includeAlpha Whether to include alpha channel
 * @returns Hex color string (#rrggbb or #rrggbbaa)
 */
export function rgbToHex(color: ParsedColor, includeAlpha = false): string {
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, "0");

  if (includeAlpha && color.a < 1) {
    const a = Math.round(color.a * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
}
