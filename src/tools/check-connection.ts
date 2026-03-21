import type { ToolContext, ToolResult } from "./shared.js";

export async function handleCheckConnection(context: ToolContext): Promise<ToolResult> {
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
