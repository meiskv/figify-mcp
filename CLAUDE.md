# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

figify-mcp is an MCP (Model Context Protocol) server that creates Figma designs from code - a reverse design-to-code workflow. Instead of converting Figma designs to code, this tool converts code components into Figma designs.

## Architecture

```
Claude Code → MCP Server (stdio) → WebSocket → Figma Plugin → Figma API
                  ↓
            Playwright (renders pages, captures screenshots)
```

### Key Components

- **MCP Server** (`src/index.ts`): Entry point, registers tools with MCP SDK
- **Registry** (`src/registry.ts`): Tool definitions with Zod schemas
- **FigmaBridge** (`src/services/figma-bridge.ts`): WebSocket server on port 19407
- **ScreenshotService** (`src/services/screenshot-service.ts`): Playwright-based page capture
- **DevServerManager** (`src/services/dev-server-manager.ts`): Next.js dev server lifecycle
- **PageRenderer** (`src/services/page-renderer.ts`): URL resolution from file paths

### Figma Plugin

Located in `figma-plugin/`:
- `src/code.ts`: Figma API handlers (creates frames, images)
- `src/ui.html`: WebSocket client connecting to MCP server

## Development Commands

```bash
npm run dev       # Start dev server with tsx watch
npm run build     # Build TypeScript
npm run start     # Run compiled server
npm run lint      # Biome check
npm run format    # Biome format
npm run typecheck # TypeScript check
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `import_page` | Capture a Next.js page and import to Figma |
| `check_figma_connection` | Verify Figma plugin is connected |
| `capture_screenshot` | Standalone screenshot capture |

## Viewports

- Desktop: 1440x900
- Mobile: 375x812

## Configuration

- WebSocket port: 19407
- Retina screenshots (2x scale)
- Full-page capture with network idle wait
