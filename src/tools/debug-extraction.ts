import { type DebugExtractionInput, DebugExtractionInputSchema } from "../registry.js";
import { errorResult, parseInput, successResult, summarizeLayers } from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleDebugExtraction(
  input: DebugExtractionInput,
  context: ToolContext,
): Promise<ToolResult> {
  let parsed: { url: string };
  try {
    parsed = parseInput(DebugExtractionInputSchema, input) as typeof parsed;
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "Invalid input");
  }

  const { url } = parsed;

  try {
    const { layerTree } = await context.screenshotService.captureWithLayers(
      url,
      "desktop",
      "debug",
    );

    const summary = summarizeLayers(layerTree.rootLayer, 0, 5);

    return successResult(
      `DOM Extraction Debug for ${url}\n\nLayer Tree (max depth 5):\n${summary}\n\nRoot layer dimensions: ${layerTree.width}x${layerTree.height}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Error extracting DOM: ${message}`);
  }
}
