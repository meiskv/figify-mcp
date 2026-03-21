import { type ImportPageAsLayersInput, ImportPageAsLayersInputSchema } from "../registry.js";
import type { FigmaLayerTree, ViewportType } from "../types/index.js";
import {
  checkFigmaConnection,
  errorResult,
  extractPageName,
  parseInput,
  successResult,
} from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleImportPageAsLayers(
  input: ImportPageAsLayersInput,
  context: ToolContext,
): Promise<ToolResult> {
  let parsed: { source: string; viewports: ViewportType[]; projectPath?: string };
  try {
    parsed = parseInput(ImportPageAsLayersInputSchema, input) as typeof parsed;
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "Invalid input");
  }

  const { source, viewports, projectPath } = parsed;

  const connCheck = checkFigmaConnection(context.figmaBridge);
  if (connCheck) return connCheck;

  try {
    const url = await context.devServerManager.resolveToUrl(source, projectPath);
    const pageName = extractPageName(source);

    const layerTrees: FigmaLayerTree[] = [];
    for (const viewport of viewports) {
      const { layerTree } = await context.screenshotService.captureWithLayers(
        url,
        viewport,
        pageName,
      );
      layerTrees.push(layerTree);
    }

    const result = await context.figmaBridge.createLayers(pageName, layerTrees);

    if (!result.success) {
      return errorResult(`Failed to create Figma layers: ${result.error}`);
    }

    return successResult(
      `Successfully imported "${pageName}" as editable layers to Figma!\n\nFrame ID: ${result.frameId}\nViewports: ${viewports.join(", ")}\nLayers created: ${result.layersCreated}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Error importing page as layers: ${message}`);
  }
}
