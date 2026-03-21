import { type CaptureScreenshotInput, CaptureScreenshotInputSchema } from "../registry.js";
import type { Screenshot, ViewportType } from "../types/index.js";
import { createErrorResult } from "./shared.js";
import type { ToolContext, ToolResult } from "./shared.js";

export async function handleCaptureScreenshot(
  input: CaptureScreenshotInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = CaptureScreenshotInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { url, viewports } = parsed.data;

  try {
    const screenshots: Screenshot[] = [];
    for (const viewport of viewports as ViewportType[]) {
      const screenshot = await context.screenshotService.capture(url, viewport);
      screenshots.push(screenshot);
    }

    return {
      content: [
        {
          type: "text",
          text: `Captured ${screenshots.length} screenshot(s):\n${screenshots.map((s) => `- ${s.viewport}: ${s.width}x${s.height}`).join("\n")}`,
        },
      ],
    };
  } catch (error) {
    return createErrorResult(error, "capturing screenshot");
  }
}
