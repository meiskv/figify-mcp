# Service Layer Architecture

This document describes the services in `src/services/` that form the core runtime of figify-mcp.

## Data Flow

```
MCP Tool Call
     |
     v
DevServerManager          (resolve source to URL, manage Next.js dev server)
     |
     v
ScreenshotService         (launch Playwright, navigate page, capture screenshots)
     |  \
     |   v
     |  DOMExtractor       (extract DOM tree as Figma-compatible layer structure)
     |   |
     v   v
FigmaBridge               (send screenshots / layers to Figma plugin via WebSocket)
     |
     v
Figma Plugin              (create frames and layers in Figma)

MetricsService            (cross-cutting: timing & observability for all operations)
```

## Service Summaries

### DevServerManager (`dev-server-manager.ts`, 262 lines)

Responsible for resolving user-provided sources (file paths or URLs) into fully-qualified URLs and managing the Next.js development server lifecycle.

**Key responsibilities:**

- **URL resolution** (`resolveToUrl`) -- Accepts a raw source string and returns a URL. Handles three forms: full URLs (passed through), `localhost:*` shorthand (prefixed with `http://`), and Next.js file paths (converted to routes and served via a dev server).
- **File-to-route conversion** (`filePathToRoute`) -- Converts `@/app/journey/page.tsx` into `/journey`. Strips the `@/` alias or absolute project prefix, removes `app/` and `page.tsx` segments, and normalises slashes.
- **Project root detection** (`findProjectRoot`) -- Walks up the directory tree looking for a `package.json` that lists `next` as a dependency.
- **Dev server lifecycle** (`ensureDevServer`, `startServer`, `stopServer`) -- Checks for an existing external server first; if none is found, spawns `npm run dev` as a child process and polls until the port is accepting connections. Uses exponential backoff when the server reports readiness.
- **Path traversal protection** (`validatePathWithinProject`) -- Ensures resolved paths don't escape the project root.

**Configuration used:** `DEV_SERVER_PORT`, `DEV_SERVER_STARTUP_TIMEOUT`, `DEV_SERVER_POLL_INTERVAL`, `EXTERNAL_SERVER_TIMEOUT` (from `config/constants.ts`).

**State:** Holds a reference to the spawned `ChildProcess` and the current project path. Only one dev server runs at a time.

---

### ScreenshotService (`screenshot-service.ts`, 233 lines)

Manages a headless Chromium browser via Playwright to capture full-page screenshots and extract DOM layer trees.

**Key responsibilities:**

- **Browser lifecycle** (`initialize`, `close`) -- Lazily launches a Chromium instance on first use. A deduplication promise (`initPromise`) prevents concurrent launches.
- **Screenshot capture** (`capture`) -- Creates a browser context with the requested viewport and device scale factor, navigates to the URL, waits for network idle plus an animation settle delay, and returns a base64-encoded PNG.
- **Layer capture** (`captureWithLayers`) -- Same navigation flow as `capture`, but additionally runs the `DOMExtractor` in parallel with the screenshot to produce a `FigmaLayerTree` structure.
- **Page navigation** (`navigatePage`) -- Shared private helper that creates a context + page, navigates with `domcontentloaded`, waits for network idle (with a tolerant timeout), waits for animation settle, and evaluates the page's scroll dimensions. Callers are responsible for closing the page and context.

**Configuration used:** `PAGE_LOAD_TIMEOUT`, `NETWORK_IDLE_TIMEOUT`, `ANIMATION_SETTLE_DELAY`, `DEVICE_SCALE_FACTOR` (from `config/constants.ts`). Viewport presets come from `config/viewports.ts`.

**Dependencies:** `DOMExtractor`, `MetricsService`.

---

### DOMExtractor (`dom-extractor.ts`, 450 lines)

Extracts a page's visible DOM into a Figma-compatible layer tree by evaluating a JavaScript script inside the browser page.

**Key responsibilities:**

- **Browser-side extraction** (`EXTRACTION_SCRIPT`) -- A self-contained IIFE (~385 lines) that runs in `page.evaluate()`. It recursively walks the DOM starting from `<body>`, reads computed styles, and builds a tree of `FrameLayer` and `TextLayer` nodes. Handles:
  - Color parsing for `rgb()`, `rgba()`, `oklab()`, `lab()`, and hex formats.
  - Background fills (solid colors and gradient fallback to first color).
  - Border strokes and box-shadow effects.
  - Flexbox, grid, and block layout mapping to Figma auto-layout properties.
  - Child sizing inference (`HUG` vs `FILL`) based on parent display mode.
  - Text extraction with font properties, alignment, and color.
  - Visibility filtering (`display: none`, `visibility: hidden`, zero-dimension elements).
  - Skipping of non-visual tags (`SCRIPT`, `STYLE`, `SVG`, `IFRAME`, etc.).
- **Node-side orchestration** (`DOMExtractor.extract`) -- Calls `page.evaluate()` with a timeout guard (`DOM_EXTRACTION_TIMEOUT`) using `Promise.race` to prevent hangs.
- **Debug logging** (`debugLogLayers`) -- Prints the first 3 levels of the extracted tree to stderr for diagnostics.
- **Layer counting** (`countLayers`) -- Recursively counts all nodes in the tree.

**Configuration used:** `DOM_EXTRACTION_TIMEOUT` (from `config/constants.ts`).

**Dependencies:** `MetricsService` (imported but timing is handled by the calling `ScreenshotService`).

---

### FigmaBridge (`figma-bridge.ts`, 267 lines)

WebSocket server that communicates with the Figma plugin running inside Figma's desktop application.

**Key responsibilities:**

- **WebSocket server** (`start`, `stop`) -- Listens on a fixed port (default 19407). Accepts one client connection at a time; replaces any existing connection when a new one arrives.
- **Connection status** (`isConnected`, `getConnectionInfo`) -- Reports whether a Figma plugin client is currently connected, along with connection timestamp and pending request count.
- **Frame creation** (`createFrame`) -- Sends a `CREATE_FRAME` message containing the page name and base64 screenshots. Returns a promise that resolves when the plugin responds with `FRAME_CREATED`.
- **Layer creation** (`createLayers`) -- Sends a `CREATE_LAYERS` message containing the page name and `FigmaLayerTree[]`. Returns a promise that resolves when the plugin responds with `LAYERS_CREATED`.
- **Request/response correlation** -- Each outgoing message gets a unique ID (`msg_{counter}_{timestamp}`). Responses are matched by ID via a `pendingRequests` map. Requests time out after `FIGMA_REQUEST_TIMEOUT` and are capped at `MAX_PENDING_REQUESTS`.
- **Heartbeat** -- Responds to `PING` messages from the plugin with `PONG`.
- **Graceful shutdown** (`stop`, `rejectAllPending`) -- Rejects all outstanding requests on shutdown, closes the client socket, then closes the server.

**Configuration used:** `WEBSOCKET_PORT`, `FIGMA_REQUEST_TIMEOUT`, `MAX_PENDING_REQUESTS` (from `config/constants.ts`).

**Events emitted:** `connect`, `disconnect` (extends `EventEmitter`).

---

### MetricsService (`metrics.ts`, 153 lines)

Cross-cutting observability service for tracking operation timings and success rates. Exported as a singleton (`metricsService`).

**Key responsibilities:**

- **Timer management** (`startTimer`, `recordMetric`) -- Start a named timer, then record the result with operation type, status (`success` | `failure` | `timeout`), and optional metadata (URL, viewport, screenshot size, layer count, retry count).
- **Querying** (`getMetrics`, `getMetricsByOperation`, `getOperationStats`) -- Retrieve raw metrics or computed statistics (count, average/min/max duration, success rate) for a given operation type.
- **Logging** (`logMetric`) -- Prints each recorded metric to stderr with a status indicator.
- **Cleanup** (`clear`) -- Resets all stored metrics and active timers.

**Tracked operations:** `resolve_url`, `capture_screenshot`, `extract_dom`, `create_frame`, `page_navigation`, `network_idle`.

**Usage pattern:** The `ScreenshotService` is the primary consumer, bracketing each capture with `startTimer` / `recordMetric` calls.

---

## Service Interactions

| Caller | Service | Method | Purpose |
|--------|---------|--------|---------|
| Tool handlers | `DevServerManager` | `resolveToUrl()` | Convert source input to a navigable URL |
| Tool handlers | `ScreenshotService` | `capture()` | Get base64 screenshot for a viewport |
| Tool handlers | `ScreenshotService` | `captureWithLayers()` | Get screenshot + DOM layer tree |
| Tool handlers | `FigmaBridge` | `createFrame()` | Send screenshots to Figma |
| Tool handlers | `FigmaBridge` | `createLayers()` | Send layer trees to Figma |
| Tool handlers | `FigmaBridge` | `isConnected()` | Guard Figma-dependent operations |
| `ScreenshotService` | `DOMExtractor` | `extract()` | Run in-browser DOM extraction |
| `ScreenshotService` | `MetricsService` | `startTimer()` / `recordMetric()` | Track capture performance |
| MCP server init | `FigmaBridge` | `start()` | Open WebSocket server on startup |
| MCP server init | `ScreenshotService` | `initialize()` | Lazily launch browser |

## Ownership & Lifecycle

All services are instantiated once in the MCP server entry point (`src/index.ts`) and passed to tool handlers via a `ToolContext` object. The `MetricsService` is a module-level singleton imported directly. Services are torn down on server shutdown (`FigmaBridge.stop()`, `ScreenshotService.close()`, `DevServerManager.stopServer()`).
