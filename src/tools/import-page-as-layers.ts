import { type ImportPageAsLayersInput, ImportPageAsLayersInputSchema } from "../registry.js";
import type { FigmaLayerTree, ViewportType } from "../types/index.js";
import { createErrorResult, extractPageName, requireFigmaConnection } from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleImportPageAsLayers(
  input: ImportPageAsLayersInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = ImportPageAsLayersInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { source, viewports, projectPath } = parsed.data;

  const connError = requireFigmaConnection(context);
  if (connError) return connError;

  try {
    const url = await context.devServerManager.resolveToUrl(source, projectPath);
    const pageName = extractPageName(source);

    const layerTrees: FigmaLayerTree[] = [];
    for (const viewport of viewports as ViewportType[]) {
      const { layerTree } = await context.screenshotService.captureWithLayers(
        url,
        viewport,
        pageName,
      );
      layerTrees.push(layerTree);
    }

    const result = await context.figmaBridge.createLayers(pageName, layerTrees);

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to create Figma layers: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully imported "${pageName}" as editable layers to Figma!\n\nFrame ID: ${result.frameId}\nViewports: ${viewports.join(", ")}\nLayers created: ${result.layersCreated}`,
        },
      ],
    };
  } catch (error) {
    return createErrorResult(error, "importing page as layers");
  }
}
