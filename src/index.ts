import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DevServerManager } from "./services/dev-server-manager.js";
import { FigmaBridge } from "./services/figma-bridge.js";
import { ScreenshotService } from "./services/screenshot-service.js";
import { type ToolContext, getToolDefinitions, handleToolCall } from "./tools/index.js";

export async function main() {
  console.error("[figify-mcp] Starting MCP server");

  // Initialize services
  const figmaBridge = new FigmaBridge();
  const devServerManager = new DevServerManager();
  const screenshotService = new ScreenshotService();

  const context: ToolContext = {
    figmaBridge,
    devServerManager,
    screenshotService,
  };

  // Start WebSocket server for Figma plugin
  await figmaBridge.start();

  // Create MCP server
  const server = new Server(
    {
      name: "figify-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getToolDefinitions(),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(name, args ?? {}, context);
    return {
      content: result.content,
      isError: result.isError,
    };
  });

  // Handle shutdown
  const cleanup = async () => {
    console.error("[figify-mcp] Shutting down");
    await screenshotService.close();
    await devServerManager.stopServer();
    await figmaBridge.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[figify-mcp] MCP server running");
}

main().catch((error) => {
  console.error("[figify-mcp] Fatal error:", error);
  process.exit(1);
});
