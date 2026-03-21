import { type ImportPageInput, ImportPageInputSchema } from "../registry.js";
import type { Screenshot, ViewportType } from "../types/index.js";
import { createErrorResult, extractPageName, requireFigmaConnection } from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleImportPage(
  input: ImportPageInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = ImportPageInputSchema.safeParse(input);
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

    const screenshots: Screenshot[] = [];
    for (const viewport of viewports as ViewportType[]) {
      const screenshot = await context.screenshotService.capture(url, viewport);
      screenshots.push(screenshot);
    }

    const pageName = extractPageName(source);
    const result = await context.figmaBridge.createFrame(pageName, screenshots);

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Failed to create Figma frame: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully imported "${pageName}" to Figma!\n\nFrame ID: ${result.frameId}\nViewports: ${viewports.join(", ")}\nScreenshots: ${screenshots.length}`,
        },
      ],
    };
  } catch (error) {
    return createErrorResult(error, "importing page");
  }
}
