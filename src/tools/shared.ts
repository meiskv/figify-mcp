import type { DevServerManager } from "../services/dev-server-manager.js";
import type { FigmaBridge } from "../services/figma-bridge.js";
import type { ScreenshotService } from "../services/screenshot-service.js";

export interface ToolContext {
  figmaBridge: FigmaBridge;
  devServerManager: DevServerManager;
  screenshotService: ScreenshotService;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Validates that the Figma plugin is connected.
 * @returns null if connected, or an error ToolResult if not connected
 */
export function requireFigmaConnection(context: ToolContext): ToolResult | null {
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
  return null;
}

/**
 * Creates a standardized error ToolResult.
 * @param error The error that occurred
 * @param operation Optional context about what operation was being performed
 */
export function createErrorResult(error: unknown, operation?: string): ToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const context = operation ? ` [${operation}]` : "";
  return {
    content: [{ type: "text", text: `Error${context}: ${errorMessage}` }],
    isError: true,
  };
}

/**
 * Extracts a human-readable page name from a file path or URL.
 * e.g. "@/app/journey/page.tsx" → "journey"
 */
export function extractPageName(source: string): string {
  if (source.includes("/")) {
    const parts = source.split("/");
    const pageIndex = parts.findIndex((p) => p === "page.tsx" || p === "page.ts");
    if (pageIndex > 0) {
      return parts[pageIndex - 1];
    }
    return parts[parts.length - 1].replace(/\.(tsx?|jsx?)$/, "");
  }
  return source;
}
