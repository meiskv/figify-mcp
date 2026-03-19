import { FigmaBridge } from "./services/figma-bridge.js";

// Shared singleton so the CLI can observe server state without coupling
// to the MCP server internals. The bridge instance is set by main() in
// index.ts when the server starts, and can be read by cli.ts for status.
export const sharedBridge = new FigmaBridge();
