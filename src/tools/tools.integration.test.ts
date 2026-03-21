import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  handleToolCall,
  requireFigmaConnection,
  createErrorResult,
  type ToolContext,
  type ToolResult,
} from "./index.js";

// Mock context factory
function createMockContext(connected = true): ToolContext {
  return {
    figmaBridge: {
      isConnected: () => connected,
      createFrame: vi.fn(),
      createLayers: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    } as any,
    devServerManager: {
      resolveToUrl: vi.fn(async (source) => `http://localhost:3000${source}`),
      stopServer: vi.fn(),
      filePathToRoute: vi.fn(),
      findProjectRoot: vi.fn(),
      ensureDevServer: vi.fn(),
      checkExternalServer: vi.fn(),
    } as any,
    screenshotService: {
      initialize: vi.fn(),
      close: vi.fn(),
      capture: vi.fn(),
      captureWithLayers: vi.fn(),
    } as any,
  };
}

describe("Tool Helpers", () => {
  describe("requireFigmaConnection", () => {
    it("returns null when Figma is connected", () => {
      const context = createMockContext(true);
      const result = requireFigmaConnection(context);
      expect(result).toBeNull();
    });

    it("returns error result when Figma is not connected", () => {
      const context = createMockContext(false);
      const result = requireFigmaConnection(context);
      expect(result).toBeDefined();
      expect(result?.isError).toBe(true);
      expect(result?.content[0].text).toContain("Figma plugin is not connected");
    });

    it("provides helpful error message", () => {
      const context = createMockContext(false);
      const result = requireFigmaConnection(context);
      expect(result?.content[0].text).toContain(
        "Please open Figma and run the figify-mcp plugin first"
      );
    });
  });

  describe("createErrorResult", () => {
    it("formats error from Error object", () => {
      const error = new Error("Test error message");
      const result = createErrorResult(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error");
      expect(result.content[0].text).toContain("Test error message");
    });

    it("includes operation context in error message", () => {
      const error = new Error("Something went wrong");
      const result = createErrorResult(error, "test operation");

      expect(result.content[0].text).toContain("[test operation]");
      expect(result.content[0].text).toMatch(/Error \[test operation\]:/);
    });

    it("handles string errors", () => {
      const result = createErrorResult("String error message");
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("String error message");
    });

    it("handles unknown error types", () => {
      const result = createErrorResult({ unknown: "object" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error");
    });

    it("formats error without operation context", () => {
      const error = new Error("Standalone error");
      const result = createErrorResult(error);

      expect(result.content[0].text).toMatch(/^Error: /);
      expect(result.content[0].text).not.toContain("[");
    });
  });
});

describe("Tool Validation", () => {
  describe("check_figma_connection tool", () => {
    it("returns connected status when plugin is connected", async () => {
      const context = createMockContext(true);
      const result = await handleToolCall("check_figma_connection", {}, context);

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("connected");
    });

    it("returns disconnected status when plugin is not connected", async () => {
      const context = createMockContext(false);
      const result = await handleToolCall("check_figma_connection", {}, context);

      expect(result.content[0].text).toContain("not connected");
    });
  });

  describe("import_page tool", () => {
    it("rejects when Figma is not connected", async () => {
      const context = createMockContext(false);
      const result = await handleToolCall(
        "import_page",
        {
          source: "http://localhost:3000",
          viewports: ["desktop"],
        },
        context
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not connected");
    });

    it("validates input schema", async () => {
      const context = createMockContext(true);
      const result = await handleToolCall(
        "import_page",
        {
          source: "http://localhost:3000",
          viewports: ["invalid-viewport"],
        },
        context
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid input");
    });

    it("accepts valid input schema", async () => {
      const context = createMockContext(true);
      // Mock the service to return without error
      vi.mocked(context.screenshotService.capture).mockResolvedValue({
        viewport: "desktop",
        width: 1440,
        height: 900,
        data: "fake-base64-data",
      });
      vi.mocked(context.figmaBridge.createFrame).mockResolvedValue({
        frameId: "test-frame-id",
        success: true,
      });

      const result = await handleToolCall(
        "import_page",
        {
          source: "http://localhost:3000",
          viewports: ["desktop"],
        },
        context
      );

      expect(result.isError).toBeUndefined();
    });
  });

  describe("import_page_as_layers tool", () => {
    it("rejects when Figma is not connected", async () => {
      const context = createMockContext(false);
      const result = await handleToolCall(
        "import_page_as_layers",
        {
          source: "http://localhost:3000",
          viewports: ["desktop"],
        },
        context
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not connected");
    });

    it("validates input schema", async () => {
      const context = createMockContext(true);
      const result = await handleToolCall(
        "import_page_as_layers",
        {
          source: "http://localhost:3000",
          viewports: ["invalid"],
        },
        context
      );

      expect(result.isError).toBe(true);
    });
  });

  describe("Unknown tool", () => {
    it("returns error for unknown tool", async () => {
      const context = createMockContext(true);
      const result = await handleToolCall("unknown_tool", {}, context);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });
  });

  describe("Error handling in tools", () => {
    it("handles errors gracefully in import_page", async () => {
      const context = createMockContext(true);
      const error = new Error("Screenshot capture failed");
      vi.mocked(context.screenshotService.capture).mockRejectedValue(error);

      const result = await handleToolCall(
        "import_page",
        {
          source: "http://localhost:3000",
          viewports: ["desktop"],
        },
        context
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error");
      expect(result.content[0].text).toContain("importing page");
    });

    it("handles errors gracefully in capture_screenshot", async () => {
      const context = createMockContext(true);
      const error = new Error("Browser launch failed");
      vi.mocked(context.screenshotService.capture).mockRejectedValue(error);

      const result = await handleToolCall(
        "capture_screenshot",
        {
          url: "http://localhost:3000",
          viewports: ["desktop"],
        },
        context
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("capturing screenshot");
    });
  });
});
