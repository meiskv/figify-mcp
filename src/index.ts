import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.js";
import { sharedBridge } from "./server-state.js";
import { DevServerManager } from "./services/dev-server-manager.js";
import { ScreenshotService } from "./services/screenshot-service.js";
import { VERSION } from "./version.js";
import { type ToolContext, getToolDefinitions, handleToolCall } from "./tools/index.js";

async function initializeServices(): Promise<ToolContext> {
  const figmaBridge = sharedBridge;
  const devServerManager = new DevServerManager();
  const screenshotService = new ScreenshotService();

  await figmaBridge.start();

  return { figmaBridge, devServerManager, screenshotService };
}

function createMcpServer(): Server {
  return new Server(
    { name: "figify-mcp", version: VERSION },
    { capabilities: { tools: {} } },
  );
}

function registerHandlers(server: Server, context: ToolContext): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefinitions(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const { content, isError } = await handleToolCall(name, args ?? {}, context);
    return { content, isError };
  });
}

function setupSignalHandlers(cleanup: () => Promise<void>): void {
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

export async function main(): Promise<void> {
  logger.info("Starting MCP server");

  const context = await initializeServices();
  const server = createMcpServer();

  registerHandlers(server, context);

  const cleanup = async () => {
    logger.info("Shutting down");
    await context.screenshotService.close().catch((e) => logger.error("screenshotService.close failed", e));
    await context.devServerManager.stopServer().catch((e) => logger.error("devServerManager.stopServer failed", e));
    await context.figmaBridge.stop().catch((e) => logger.error("figmaBridge.stop failed", e));
    process.exit(0);
  };

  setupSignalHandlers(cleanup);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server running");
}

main().catch((error) => {
  logger.error("Fatal error", error);
  process.exit(1);
});
