import {
  type CaptureScreenshotInput,
  CaptureScreenshotInputSchema,
  type ImportPageAsLayersInput,
  ImportPageAsLayersInputSchema,
  type ImportPageInput,
  ImportPageInputSchema,
  TOOLS,
} from "../registry.js";
import type { FigmaBridge } from "../services/figma-bridge.js";
import type { PageRenderer } from "../services/page-renderer.js";
import type { ScreenshotService } from "../services/screenshot-service.js";
import type { FigmaLayerTree, Screenshot, ViewportType } from "../types/index.js";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";

export interface ToolContext {
  figmaBridge: FigmaBridge;
  pageRenderer: PageRenderer;
  screenshotService: ScreenshotService;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

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
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

async function handleImportPage(input: ImportPageInput, context: ToolContext): Promise<ToolResult> {
  const parsed = ImportPageInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { source, viewports, projectPath } = parsed.data;

  // Check Figma connection first
  if (!context.figmaBridge.isConnected()) {
    return {
      content: [
        {
          type: "text",
          text: "Figma plugin is not connected. Please open Figma and run the figify-mcp plugin first.",
        },
      ],
      isError: true,
    };
  }

  try {
    // Resolve URL from source
    const url = await context.pageRenderer.resolveUrl(source, projectPath);

    // Capture screenshots for each viewport
    const screenshots: Screenshot[] = [];
    for (const viewport of viewports as ViewportType[]) {
      const screenshot = await context.screenshotService.capture(url, viewport);
      screenshots.push(screenshot);
    }

    // Send to Figma
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
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error importing page: ${message}` }],
      isError: true,
    };
  }
}

async function handleImportPageAsLayers(
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

  // Check Figma connection first
  if (!context.figmaBridge.isConnected()) {
    return {
      content: [
        {
          type: "text",
          text: "Figma plugin is not connected. Please open Figma and run the figify-mcp plugin first.",
        },
      ],
      isError: true,
    };
  }

  try {
    // Resolve URL from source
    const url = await context.pageRenderer.resolveUrl(source, projectPath);
    const pageName = extractPageName(source);

    // Capture with layers for each viewport
    const layerTrees: FigmaLayerTree[] = [];
    for (const viewport of viewports as ViewportType[]) {
      const { layerTree } = await context.screenshotService.captureWithLayers(
        url,
        viewport,
        pageName,
      );
      layerTrees.push(layerTree);
    }

    // Send layers to Figma
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
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error importing page as layers: ${message}` }],
      isError: true,
    };
  }
}

async function handleCheckConnection(context: ToolContext): Promise<ToolResult> {
  const connected = context.figmaBridge.isConnected();
  return {
    content: [
      {
        type: "text",
        text: connected
          ? "Figma plugin is connected and ready."
          : "Figma plugin is not connected. Please open Figma and run the figify-mcp plugin.",
      },
    ],
  };
}

async function handleCaptureScreenshot(
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
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error capturing screenshot: ${message}` }],
      isError: true,
    };
  }
}

function extractPageName(source: string): string {
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
