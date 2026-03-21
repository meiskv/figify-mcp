import { type DebugExtractionInput, DebugExtractionInputSchema } from "../registry.js";
import { createErrorResult } from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

/**
 * Minimal layer shape needed for debug tree visualization.
 * Uses a flexible interface to accommodate all layer variants (FRAME, TEXT, RECTANGLE).
 */
interface DebugLayer {
  id?: string;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  characters?: string;
  textColor?: { r: number; g: number; b: number; a?: number };
  fills?: Array<{ color: { r: number; g: number; b: number; a?: number } }>;
  strokes?: Array<{ color: { r: number; g: number; b: number } }>;
  effects?: Array<unknown>;
  children?: DebugLayer[];
  [key: string]: unknown;
}

function summarizeLayers(layer: DebugLayer, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return "";

  const indent = "  ".repeat(depth);
  const fills = layer.fills?.length ?? 0;
  const strokes = layer.strokes?.length ?? 0;
  const effects = layer.effects?.length ?? 0;

  let line = `${indent}${layer.name} (${layer.type})`;

  if (layer.type === "TEXT") {
    const tc = layer.textColor;
    const r = tc ? (tc.r * 255).toFixed(0) : "?";
    const g = tc ? (tc.g * 255).toFixed(0) : "?";
    const b = tc ? (tc.b * 255).toFixed(0) : "?";
    line += ` - text: "${layer.characters?.slice(0, 20)}..." color: rgb(${r}, ${g}, ${b})`;
  } else {
    const layerFills = layer.fills ?? [];
    line += ` - fills: ${fills}, strokes: ${strokes}, effects: ${effects}`;
    if (layerFills.length > 0 && layerFills[0]?.color) {
      const c = layerFills[0].color;
      line += ` [fill: rgba(${(c.r * 255).toFixed(0)}, ${(c.g * 255).toFixed(0)}, ${(c.b * 255).toFixed(0)}, ${c.a?.toFixed(2) ?? 1})]`;
    }
  }

  let result = line + "\n";

  if (layer.children) {
    for (const child of layer.children) {
      result += summarizeLayers(child, depth + 1, maxDepth);
    }
  }

  return result;
}

export async function handleDebugExtraction(
  input: DebugExtractionInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = DebugExtractionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { url } = parsed.data;

  try {
    const { layerTree } = await context.screenshotService.captureWithLayers(
      url,
      "desktop",
      "debug",
    );

    const summary = summarizeLayers(layerTree.rootLayer as DebugLayer, 0, 5);

    return {
      content: [
        {
          type: "text",
          text: `DOM Extraction Debug for ${url}\n\nLayer Tree (max depth 5):\n${summary}\n\nRoot layer dimensions: ${layerTree.width}x${layerTree.height}`,
        },
      ],
    };
  } catch (error) {
    return createErrorResult(error, "extracting DOM");
  }
}
