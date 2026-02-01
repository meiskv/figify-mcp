# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

figify-mcp is an MCP (Model Context Protocol) server that creates Figma designs from code - a reverse design-to-code workflow. Instead of converting Figma designs to code, this tool captures rendered Next.js pages and imports them as frames into Figma.

## Architecture

```
Claude Code → MCP Server (stdio) → WebSocket → Figma Plugin → Figma API
                  ↓
            Playwright (renders pages, captures screenshots)
```

### Component Overview

| Component | File | Purpose |
|-----------|------|---------|
| MCP Server | `src/index.ts` | Entry point, registers tools with MCP SDK, handles stdio transport |
| Registry | `src/registry.ts` | Tool definitions with Zod schemas (single source of truth) |
| Tools | `src/tools/index.ts` | Tool handlers and JSON schema generation |
| FigmaBridge | `src/services/figma-bridge.ts` | WebSocket server on port 19407, request/response with message IDs |
| ScreenshotService | `src/services/screenshot-service.ts` | Playwright-based page capture, 2x retina quality |
| DevServerManager | `src/services/dev-server-manager.ts` | Next.js dev server lifecycle, auto-starts if needed |
| PageRenderer | `src/services/page-renderer.ts` | URL resolution from file paths |
| Viewports | `src/config/viewports.ts` | Desktop (1440x900), Mobile (375x812) presets |
| Types | `src/types/index.ts` | TypeScript interfaces for all data structures |

### Figma Plugin

Located in `figma-plugin/`:
- `manifest.json` - Plugin configuration, network access for localhost
- `src/code.ts` - Figma API handlers (createFrame, createImage with base64 decode)
- `src/ui.html` - WebSocket client, auto-connects to localhost:19407

## Development Commands

```bash
npm run dev       # Start dev server with tsx watch
npm run build     # Build TypeScript to dist/
npm run start     # Run compiled server (node dist/index.js)
npm run lint      # Biome check
npm run format    # Biome format --write
npm run typecheck # TypeScript type checking (tsc --noEmit)
```

### Figma Plugin Build

```bash
cd figma-plugin
npm install
npm run build     # Compiles src/code.ts to dist/code.js
```

## MCP Tools

### `import_page`
Capture a Next.js page and import to Figma.

**Input Schema:**
```typescript
{
  source: string,           // File path (@/app/page.tsx) or URL (localhost:3000)
  viewports: ("desktop" | "mobile")[],  // Default: ["desktop"]
  projectPath?: string      // Next.js root (auto-detected if not provided)
}
```

### `check_figma_connection`
Verify that the Figma plugin is connected via WebSocket.

### `capture_screenshot`
Capture screenshots without sending to Figma (for testing).

**Input Schema:**
```typescript
{
  url: string,              // URL to capture
  viewports: ("desktop" | "mobile")[]   // Default: ["desktop"]
}
```

## Key Configuration

| Setting | Value | Location |
|---------|-------|----------|
| WebSocket Port | 19407 | `src/services/figma-bridge.ts` |
| Page Load Timeout | 30s | `src/services/screenshot-service.ts` |
| Network Idle Timeout | 5s | `src/services/screenshot-service.ts` |
| Request Timeout | 30s | `src/services/figma-bridge.ts` |
| Device Scale Factor | 2x | `src/services/screenshot-service.ts` |
| Dev Server Timeout | 60s | `src/services/dev-server-manager.ts` |

## File Path Resolution

The `DevServerManager` converts file paths to routes:

| Input | Output |
|-------|--------|
| `@/app/page.tsx` | `/` |
| `@/app/journey/page.tsx` | `/journey` |
| `@/app/dashboard/settings/page.tsx` | `/dashboard/settings` |
| `localhost:3000/about` | `http://localhost:3000/about` |
| `http://example.com` | `http://example.com` |

## WebSocket Protocol

Messages between MCP server and Figma plugin:

```typescript
// Server → Plugin
{ id: string, type: "CREATE_FRAME", payload: { name: string, screenshots: Screenshot[] } }

// Plugin → Server
{ id: string, type: "FRAME_CREATED", payload: { frameId: string, success: boolean } }
{ id: string, type: "ERROR", payload: { error: string } }

// Heartbeat
{ id: string, type: "PING", payload: {} }
{ id: string, type: "PONG", payload: {} }
```

## Dependencies

**Runtime:**
- `@modelcontextprotocol/sdk` - MCP server implementation
- `playwright` - Headless browser for screenshots
- `ws` - WebSocket server
- `zod` - Schema validation

**Development:**
- `typescript` - Type checking
- `@biomejs/biome` - Linting and formatting
- `tsx` - TypeScript execution for dev mode
- `@types/node`, `@types/ws` - Type definitions

## Usage Flow

1. Build the MCP server: `npm run build`
2. Install Playwright browsers: `npx playwright install chromium`
3. Load `figma-plugin/` in Figma (Plugins > Development > Import plugin from manifest)
4. Run the plugin in Figma to establish WebSocket connection
5. Configure MCP server in Claude Code settings:
   ```json
   {
     "mcpServers": {
       "figify-mcp": {
         "command": "node",
         "args": ["/path/to/figify-mcp/dist/index.js"]
       }
     }
   }
   ```
6. Use commands like: `"import localhost:3000 to figma - desktop and mobile views"`

## Testing

Use MCP Inspector for debugging:
```bash
npx @modelcontextprotocol/inspector ./dist/index.js
```
