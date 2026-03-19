import type { z } from "zod";
import type { FigmaBridge } from "../services/figma-bridge.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Parse input against a Zod schema and throw if invalid. */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid input: ${result.error.message}`);
  }
  return result.data;
}

/** Create an error result. */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/** Create a success result. */
export function successResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

/** Check if Figma is connected; return an error result if not, or null if connected. */
export function checkFigmaConnection(figmaBridge: FigmaBridge): ToolResult | null {
  if (figmaBridge.isConnected()) return null;
  return errorResult(
    "Figma plugin is not connected. Please open Figma and run the figify-mcp plugin first.",
  );
}

/** Extract a human-readable page name from a source path or URL. */
export function extractPageName(source: string): string {
  // Handle file paths like @/app/journey/page.tsx
  if (source.includes("/")) {
    const parts = source.split("/");
    // Find the meaningful part (not page.tsx)
    const pageIndex = parts.findIndex((p) => p === "page.tsx" || p === "page.ts");
    if (pageIndex > 0) {
      return parts[pageIndex - 1];
    }
    return parts[parts.length - 1].replace(/\.(tsx?|jsx?)$/, "");
  }
  return source;
}

/** Recursively summarize a layer tree for debug output. */
// biome-ignore lint/suspicious/noExplicitAny: Need flexible access for debug output
export function summarizeLayers(layer: any, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return "";

  const indent = "  ".repeat(depth);
  const fills = layer.fills?.length ?? 0;
  const strokes = layer.strokes?.length ?? 0;
  const effects = layer.effects?.length ?? 0;

  let line = `${indent}${layer.name} (${layer.type})`;

  if (layer.type === "TEXT") {
    const tc = layer.textColor;
    line += ` - text: "${layer.characters?.slice(0, 20)}..." color: rgb(${(tc?.r * 255).toFixed(0)}, ${(tc?.g * 255).toFixed(0)}, ${(tc?.b * 255).toFixed(0)})`;
  } else {
    line += ` - fills: ${fills}, strokes: ${strokes}, effects: ${effects}`;
    if (fills > 0 && layer.fills[0]?.color) {
      const c = layer.fills[0].color;
      line += ` [fill: rgba(${(c.r * 255).toFixed(0)}, ${(c.g * 255).toFixed(0)}, ${(c.b * 255).toFixed(0)}, ${c.a?.toFixed(2) ?? 1})]`;
    }
  }

  let result = `${line}\n`;

  if (layer.children) {
    for (const child of layer.children) {
      result += summarizeLayers(child, depth + 1, maxDepth);
    }
  }

  return result;
}
