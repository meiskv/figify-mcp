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
    case "debug_extraction":
      return handleDebugExtraction(args as DebugExtractionInput, context);
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

async function handleDebugExtraction(
  input: DebugExtractionInput,
  context: ToolContext,
): Promise<ToolResult> {
  const parsed = DebugExtractionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }

  const { url } = parsed.data;

  try {
    const { layerTree } = await context.screenshotService.captureWithLayers(
      url,
      "desktop",
      "debug",
    );

    // Summarize the layer data
    const summary = summarizeLayers(layerTree.rootLayer, 0, 5);

    return {
      content: [
        {
          type: "text",
          text: `DOM Extraction Debug for ${url}\n\nLayer Tree (max depth 5):\n${summary}\n\nRoot layer dimensions: ${layerTree.width}x${layerTree.height}`,
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error extracting DOM: ${message}` }],
      isError: true,
    };
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Need flexible access for debug output
function summarizeLayers(layer: any, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return "";

  const indent = "  ".repeat(depth);
  const fills = layer.fills?.length ?? 0;
  const strokes = layer.strokes?.length ?? 0;
  const effects = layer.effects?.length ?? 0;

  let line = `${indent}${layer.name} (${layer.type})`;

  if (layer.type === "TEXT") {
    const tc = layer.textColor;
    line += ` - text: "${layer.characters?.slice(0, 20)}..." color: rgb(${(tc?.r * 255).toFixed(0)}, ${(tc?.g * 255).toFixed(0)}, ${(tc?.b * 255).toFixed(0)})`;
  } else {
    line += ` - fills: ${fills}, strokes: ${strokes}, effects: ${effects}`;
    if (fills > 0 && layer.fills[0]?.color) {
      const c = layer.fills[0].color;
      line += ` [fill: rgba(${(c.r * 255).toFixed(0)}, ${(c.g * 255).toFixed(0)}, ${(c.b * 255).toFixed(0)}, ${c.a?.toFixed(2) ?? 1})]`;
    }
  }

  let result = line + "\n";

  if (layer.children) {
    for (const child of layer.children) {
      result += summarizeLayers(child, depth + 1, maxDepth);
    }
  }

  return result;
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
