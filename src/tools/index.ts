import {
  type CaptureScreenshotInput,
  CaptureScreenshotInputSchema,
  type DebugExtractionInput,
  DebugExtractionInputSchema,
  type ImportPageAsLayersInput,
  ImportPageAsLayersInputSchema,
  type ImportPageInput,
  ImportPageInputSchema,
  TOOLS,
} from "../registry.js";
import type { DevServerManager } from "../services/dev-server-manager.js";
import type { FigmaBridge } from "../services/figma-bridge.js";
import type { ScreenshotService } from "../services/screenshot-service.js";
import type { FigmaLayerTree, Screenshot, ViewportType } from "../types/index.js";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";
import {
  type ToolResult,
  checkFigmaConnection,
  errorResult,
  extractPageName,
  parseInput,
  successResult,
  summarizeLayers,
} from "./shared.js";

export type { ToolResult };

export interface ToolContext {
  figmaBridge: FigmaBridge;
  devServerManager: DevServerManager;
  screenshotService: ScreenshotService;
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
    case "debug_extraction":
      return handleDebugExtraction(args as DebugExtractionInput, context);
    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}

async function handleImportPage(input: ImportPageInput, context: ToolContext): Promise<ToolResult> {
  let parsed: { source: string; viewports: ViewportType[]; projectPath?: string };
  try {
    parsed = parseInput(ImportPageInputSchema, input) as typeof parsed;
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "Invalid input");
  }

  const { source, viewports, projectPath } = parsed;

  // Check Figma connection first
  const connCheck = checkFigmaConnection(context.figmaBridge);
  if (connCheck) return connCheck;

  try {
    // Resolve URL and capture screenshots for each viewport
    const url = await context.devServerManager.resolveToUrl(source, projectPath);
    const screenshots: Screenshot[] = [];
    for (const viewport of viewports as ViewportType[]) {
      screenshots.push(await context.screenshotService.capture(url, viewport));
    }

    // Send to Figma
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

async function handleImportPageAsLayers(
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

async function handleCheckConnection(context: ToolContext): Promise<ToolResult> {
  const connected = context.figmaBridge.isConnected();
  return successResult(
    connected
      ? "Figma plugin is connected and ready."
      : "Figma plugin is not connected. Please open Figma and run the figify-mcp plugin.",
  );
}

async function handleCaptureScreenshot(
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
    const screenshots: Screenshot[] = [];
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

async function handleDebugExtraction(
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
