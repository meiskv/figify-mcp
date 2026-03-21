import { type ImportPageInput, ImportPageInputSchema } from "../registry.js";
import type { ViewportType } from "../types/index.js";
import {
  checkFigmaConnection,
  errorResult,
  extractPageName,
  parseInput,
  successResult,
} from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleImportPage(
  input: ImportPageInput,
  context: ToolContext,
): Promise<ToolResult> {
  let parsed: { source: string; viewports: ViewportType[]; projectPath?: string };
  try {
    parsed = parseInput(ImportPageInputSchema, input) as typeof parsed;
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "Invalid input");
  }

  const { source, viewports, projectPath } = parsed;

  const connCheck = checkFigmaConnection(context.figmaBridge);
  if (connCheck) return connCheck;

  try {
    const url = await context.devServerManager.resolveToUrl(source, projectPath);
    const screenshots = [];
    for (const viewport of viewports) {
      screenshots.push(await context.screenshotService.capture(url, viewport));
    }

    const pageName = extractPageName(source);
    const result = await context.figmaBridge.createFrame(pageName, screenshots);

    if (!result.success) {
      return errorResult(`Failed to create Figma frame: ${result.error}`);
    }

    return successResult(
      `Successfully imported "${pageName}" to Figma!\n\nFrame ID: ${result.frameId}\nViewports: ${viewports.join(", ")}\nScreenshots: ${screenshots.length}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Error importing page: ${message}`);
  }
}
