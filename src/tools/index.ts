import {
  type CaptureScreenshotInput,
  type DebugExtractionInput,
  type ImportPageAsLayersInput,
  type ImportPageInput,
  TOOLS,
} from "../registry.js";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";
import { handleCaptureScreenshot } from "./capture-screenshot.js";
import { handleCheckConnection } from "./check-connection.js";
import { handleDebugExtraction } from "./debug-extraction.js";
import { handleImportPageAsLayers } from "./import-page-as-layers.js";
import { handleImportPage } from "./import-page.js";
import type { ToolContext, ToolResult } from "./shared.js";

export type { ToolContext, ToolResult };
export { createErrorResult, requireFigmaConnection } from "./shared.js";

export function getToolDefinitions() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
  }));
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "import_page":
      return handleImportPage(args as ImportPageInput, context);
    case "import_page_as_layers":
      return handleImportPageAsLayers(args as ImportPageAsLayersInput, context);
    case "check_figma_connection":
      return handleCheckConnection(context);
    case "capture_screenshot":
      return handleCaptureScreenshot(args as CaptureScreenshotInput, context);
    case "debug_extraction":
      return handleDebugExtraction(args as DebugExtractionInput, context);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
