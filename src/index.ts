import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";
import { DevServerManager } from "./services/dev-server-manager.js";
import { FigmaBridge } from "./services/figma-bridge.js";
import { ScreenshotService } from "./services/screenshot-service.js";
import { type ToolContext, getToolDefinitions, handleToolCall } from "./tools/index.js";

// Read name/version from package.json so they stay in sync automatically.
// NOTE: console.error (stderr) is used intentionally throughout this file —
// console.log/warn write to stdout, which would corrupt the MCP stdio transport.
const require = createRequire(import.meta.url);
const { name: SERVER_NAME, version: SERVER_VERSION } = require("../package.json") as {
  name: string;
  version: string;
};

function log(message: string): void {
  console.error(`[${SERVER_NAME}] ${message}`);
}

async function initializeServices(): Promise<ToolContext> {
  const figmaBridge = new FigmaBridge();
  const devServerManager = new DevServerManager();
  const screenshotService = new ScreenshotService();

  await figmaBridge.start();

  return { figmaBridge, devServerManager, screenshotService };
}

function createMcpServer(): Server {
  return new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
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
  log("Starting MCP server");

  const context = await initializeServices();
  const server = createMcpServer();

  registerHandlers(server, context);

  const cleanup = async () => {
    log("Shutting down");
    await context.screenshotService.close().catch((e) => log(`screenshotService.close failed: ${e}`));
    await context.devServerManager.stopServer().catch((e) => log(`devServerManager.stopServer failed: ${e}`));
    await context.figmaBridge.stop().catch((e) => log(`figmaBridge.stop failed: ${e}`));
    process.exit(0);
  };

  setupSignalHandlers(cleanup);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log("MCP server running");
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
