import { type CaptureScreenshotInput, CaptureScreenshotInputSchema } from "../registry.js";
import type { ViewportType } from "../types/index.js";
import { errorResult, parseInput, successResult } from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleCaptureScreenshot(
  input: CaptureScreenshotInput,
  context: ToolContext,
): Promise<ToolResult> {
  let parsed: { url: string; viewports: ViewportType[] };
  try {
    parsed = parseInput(CaptureScreenshotInputSchema, input) as typeof parsed;
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "Invalid input");
  }

  const { url, viewports } = parsed;

  try {
    const screenshots = [];
    for (const viewport of viewports) {
      screenshots.push(await context.screenshotService.capture(url, viewport));
    }

    return successResult(
      `Captured ${screenshots.length} screenshot(s):\n${screenshots.map((s) => `- ${s.viewport}: ${s.width}x${s.height}`).join("\n")}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Error capturing screenshot: ${message}`);
  }
}
