# Comprehensive Code Review: figify-mcp

**Date:** March 17, 2026  
**Scope:** Complete codebase analysis including entry point, all services, utilities, tools, and Figma plugin  
**Total Files Reviewed:** 14 TypeScript files + 1 HTML file

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Detailed File Analysis](#detailed-file-analysis)
4. [Critical Issues](#critical-issues)
5. [Code Smells & Anti-patterns](#code-smells--anti-patterns)
6. [Security Concerns](#security-concerns)
7. [Performance Issues](#performance-issues)
8. [Testing & Reliability](#testing--reliability)
9. [Recommendations & Improvements](#recommendations--improvements)

---

## Executive Summary

**figify-mcp** is a well-architected MCP (Model Context Protocol) server that bridges Next.js web applications with Figma. The codebase demonstrates solid engineering practices with a clear separation of concerns, comprehensive type safety via TypeScript, and thoughtful use of modern patterns.

### Strengths:
- **Clean architecture** with layered separation of concerns
- **Strong type safety** throughout (minimal `any` usage)
- **Comprehensive DOM-to-Figma extraction** with support for modern CSS (okllab, lab color spaces)
- **Bidirectional WebSocket communication** with proper request/response handling
- **Robust error handling** in most critical paths
- **Good documentation** in type definitions and complex algorithms

### Critical Issues Found: **3**
- Memory leak potential in screenshot service
- Race condition in dev server startup detection
- Unvalidated input passed to tools

### Major Code Smells: **7**
- Hardcoded configuration values scattered throughout
- Incomplete error handling in cleanup paths
- Missing timeout handling for browser operations
- Insufficient validation of viewport input
- Color conversion code has untested edge cases
- No input sanitization for file path resolution
- Duplicate type definitions across plugin and server

### Areas Needing Improvement: **15+**
- Resource cleanup and lifecycle management
- Comprehensive logging and diagnostics
- Test coverage (appears to be zero)
- Documentation of edge cases
- Accessibility considerations in DOM extraction
- Environment configuration management

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Claude Code (MCP Client)                                │
└─────────────────────────┬───────────────────────────────┘
                          │ MCP Protocol (stdio)
                          ▼
┌─────────────────────────────────────────────────────────┐
│ MCP Server (src/index.ts)                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Tool Handlers (src/tools/index.ts)                  │ │
│ │ - import_page                                       │ │
│ │ - import_page_as_layers                             │ │
│ │ - check_figma_connection                            │ │
│ │ - capture_screenshot                                │ │
│ │ - debug_extraction                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                        │                                 │
│ ┌─────────────────────▼─────────────────────────────┐  │
│ │ Services                                          │  │
│ │ ┌──────────────────────────────────────────────┐ │  │
│ │ │ FigmaBridge (WebSocket server, port 19407)  │ │  │
│ │ └──────────────────────────────────────────────┘ │  │
│ │ ┌──────────────────────────────────────────────┐ │  │
│ │ │ ScreenshotService (Playwright browser)      │ │  │
│ │ │ - Captures screenshots                      │ │  │
│ │ │ - Extracts DOM structure (DOMExtractor)     │ │  │
│ │ └──────────────────────────────────────────────┘ │  │
│ │ ┌──────────────────────────────────────────────┐ │  │
│ │ │ DevServerManager (Next.js dev server)       │ │  │
│ │ └──────────────────────────────────────────────┘ │  │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │ WebSocket (port 19407)
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Figma Plugin (figma-plugin/src/)                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ code.ts - Figma API handlers                        │ │
│ │ - createFrameWithScreenshots()                      │ │
│ │ - createFrameWithLayers()                           │ │
│ │ - createNode() - recursive layer creation          │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ui.html - WebSocket client & UI                    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed File Analysis

### 1. **src/index.ts** - MCP Server Entry Point

**Purpose:** Initializes the MCP server, sets up service instances, registers tool handlers, and manages graceful shutdown.

**Size:** 78 lines

**Exports:**
- `main()` - Async entry point function

**What It Does:**
1. Initializes three core services (FigmaBridge, DevServerManager, ScreenshotService)
2. Creates tool context object
3. Starts WebSocket server
4. Creates MCP server and registers handlers
5. Sets up SIGINT/SIGTERM signal handlers for cleanup
6. Connects stdio transport for MCP communication

**Code Quality Analysis:**

✅ **Good Practices:**
- Proper async/await usage
- Signal handler registration for graceful shutdown
- Dependency injection via context object
- Clean separation of concerns

⚠️ **Issues Found:**

**1. CRITICAL: Incomplete Cleanup in Error Path**
```typescript
// Lines 75-77: Fatal error path doesn't invoke cleanup
main().catch((error) => {
  console.error("[figify-mcp] Fatal error:", error);
  process.exit(1);  // ❌ No await cleanup()
});
```
**Impact:** If `main()` throws before reaching the server setup, services won't be properly shut down.

**Fix:**
```typescript
main().catch(async (error) => {
  console.error("[figify-mcp] Fatal error:", error);
  // Close resources before exit
  try {
    const { figmaBridge, devServerManager, screenshotService } = context;
    await screenshotService.close();
    await devServerManager.stopServer();
    await figmaBridge.stop();
  } catch (cleanupError) {
    console.error("[figify-mcp] Cleanup error:", cleanupError);
  }
  process.exit(1);
});
```

**2. Race Condition: Context Not Defined**
The `cleanup` function references `context`, but `context` is defined in the same function. If cleanup is called before context initialization, it will crash.

**Fix:** Define cleanup inside the try block or make context available earlier.

**3. No Timeout on Server Startup**
If FigmaBridge.start() hangs, the process will hang indefinitely.

---

### 2. **src/cli.ts** - Interactive TUI & CLI Entry Point

**Purpose:** Provides terminal UI for onboarding, setup instructions, and starting the server.

**Size:** 312 lines

**Exports:**
- Entry point script (no named exports)
- Uses: `clearScreen`, `colors`, `displayCodeBlock`, etc. from `./ui.js`
- Imports and runs `main()` from `./index.js`

**Key Functions:**
- `showWelcome()` - Displays mascot and banner
- `showSetupSteps()` - Shows Figma plugin setup guide
- `showUsageExamples()` - Shows command examples
- `showMenu()` - Interactive menu with readline
- `startServer()` - Imports and starts MCP server
- `openPluginFolder()` - Opens plugin folder in file explorer
- `runOnboarding()` - Main CLI loop

**Code Quality Analysis:**

✅ **Good Practices:**
- Nice ASCII art mascot and banners
- Cross-platform file opener (darwin/win32/linux)
- Proper menu-driven navigation
- Version number management

⚠️ **Issues Found:**

**1. BUG: Hardcoded Version Number**
```typescript
// Line 289: Version hardcoded in two places
print("figify-mcp v1.6.0");
```
- Version in `cli.ts:289` not synchronized with `package.json`
- Should be read from package.json or build-time injected

**2. DESIGN: Server Import Inside Menu Loop**
```typescript
// Lines 182, 296: Import happens in two places
const { main } = await import("./index.js");
```
- First import in `startServer()` (line 182) - imports but doesn't await default export
- Second import in CLI arg handling (line 296) - same issue
- Never awaits the main() call

**Actual Behavior:** The import succeeds, main() is called, but CLI doesn't wait for it.
**Expected Behavior:** Server runs, CLI becomes main process

**3. ISSUE: Color Function Wrappers**
```typescript
// Lines 73-90: Redundant wrapper functions
function showError(message: string): void {
  displayError(message);  // Just delegates to ui.ts function
}
```
- These wrapper functions add no value; use imports directly instead

**4. ISSUE: Unused Imports**
```typescript
// Line 195: exec is imported but never used for path resolution
const { exec } = await import("node:child_process");
```

**5. DESIGN: Error in Plugin Folder Opening**
```typescript
// Lines 208-216: Exec callback doesn't prevent continued execution
exec(`${cmd} "${pluginPath}"`, (error) => {
  if (error) {
    logger.warn("Could not open folder automatically", error);
    // But function continues...
  }
});
await sleep(1000);  // Arbitrary delay instead of waiting for exec
```

---

### 3. **src/logger.ts** - Simple Logging Utility

**Purpose:** Provides styled console logging with timestamps and log levels.

**Size:** 93 lines

**Exports:**
- `LogLevel` - Enum with INFO, WARN, ERROR, SUCCESS
- `LoggerConfig` - Interface for logger configuration
- `Logger` - Class that formats and outputs messages
- `logger` - Default singleton instance

**Code Quality Analysis:**

✅ **Good Practices:**
- Timestamp formatting
- Log level-based color coding
- Optional verbose mode for data output
- Singleton pattern for default instance

⚠️ **Issues Found:**

**1. MINOR: Inefficient Color Code Lookups**
```typescript
// Line 52: Color object lookups in switch statements
const borderColor = c[color];
```
- No validation that `color` key exists in colors object
- Will return `undefined` if invalid color name passed

**2. DESIGN: No Log Level Filtering**
- `setLevel()` is defined but never used in methods
- All log methods output regardless of configured level

**Fix:** Implement level checking:
```typescript
info(message: string, data?: unknown): void {
  if (this.config.level !== LogLevel.INFO) return;  // Add this
  console.log(this.formatMessage(LogLevel.INFO, message));
  // ...
}
```

**3. MINOR: JSON Serialization Can Throw**
```typescript
// Line 51, 58, 71: JSON.stringify(data) is unguarded
console.log(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}`);
```
- If `data` contains circular references, this throws

**Fix:**
```typescript
console.log(`  ${c.dim}${JSON.stringify(data, null, 2) ?? "[circular]"}${c.reset}`);
```

---

### 4. **src/ui.ts** - Terminal UI Helper Functions

**Purpose:** Provides ANSI color codes and formatted terminal output utilities.

**Size:** 170 lines

**Exports:**
- `colors` - Object with ANSI color code definitions
- `stripAnsi()` - Removes ANSI codes from strings
- `print()` - Basic console.log wrapper
- `printCentered()` - Centers text
- `clearScreen()` - Clears terminal
- `box()` - Creates box drawing borders
- `displayMenu()`, `displaySteps()`, `displayCodeBlock()`, `displayExamples()` - Formatted output
- `displayError()`, `displaySuccess()`, `displayWarning()`, `displayInfo()` - Styled messages

**Code Quality Analysis:**

✅ **Good Practices:**
- Comprehensive color palette
- ANSI stripping for length calculations
- Reusable component functions
- Type-safe color parameter with `keyof typeof colors`

⚠️ **Issues Found:**

**1. MINOR: Hardcoded Box Width**
```typescript
// Line 54: Default width 60 is hardcoded in multiple functions
export function displayMenu(title: string, options: MenuOption[], width = 60): void {
```
- No validation that content fits within width
- Long strings will break layout

**2. MINOR: Box Padding Calculation**
```typescript
// Line 54: Padding calculation assumes fixed terminal width
const padding = "─".repeat(borderWidth - 4);
```
- This creates padding, but `displayCodeBlock()` assumes 51-char lines (line 122)
- Inconsistency: some functions assume 60 char width, others 51

**3. DESIGN: No Terminal Capability Detection**
- Assumes TTY supports colors (some terminals don't)
- Should check `process.stdout.isTTY` before using ANSI codes

---

### 5. **src/registry.ts** - Tool Definitions & Schemas

**Purpose:** Single source of truth for tool definitions, input schemas, and tool metadata.

**Size:** 90 lines

**Exports:**
- `ViewportSchema` - Zod enum
- Input schemas (ImportPageInputSchema, CheckConnectionInputSchema, etc.)
- TypeScript types inferred from schemas
- `ToolDefinition` interface
- `TOOLS` array - central registry
- `getToolByName()` - lookup function

**Code Quality Analysis:**

✅ **Good Practices:**
- Centralized tool registry
- Zod schemas with built-in validation
- Descriptions for tool documentation
- Type inference from schemas (`z.infer<>`)

⚠️ **Issues Found:**

**1. UNUSED FUNCTION**
```typescript
// Lines 88-90: getToolByName() is defined but never used
export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
```
- `src/tools/index.ts` uses `name` parameter directly in switch statement
- This function duplicates that logic but is never called

**2. SCHEMA DUPLICATION**
- `ImportPageInputSchema` and `ImportPageAsLayersInputSchema` are nearly identical (lines 5-37)
- Could use a shared base schema

**3. NO VALIDATION OF VIEWPORT DEFAULTS**
```typescript
// Line 9: Default is hardcoded, not validated
.default(["desktop"])
```
- What if ViewportSchema changes? Default won't be validated

**4. MISSING INPUT VALIDATION DOCUMENTATION**
- No docstring explaining what "File path (@/app/page.tsx)" means
- What happens if user provides invalid path?
- No examples in descriptions

---

### 6. **src/types/index.ts** - Core Type Definitions

**Purpose:** Central location for all TypeScript interfaces and type definitions.

**Size:** 59 lines

**Exports:**
- `ViewportConfig`, `Screenshot`, `ImportPageResult`, `FigmaMessage`
- `FigmaCreateFramePayload`, `FigmaFrameCreatedPayload`
- `DevServerInfo`, `ViewportType`
- Re-exports from `./layers.js`

**Code Quality Analysis:**

✅ **Good Practices:**
- Clear, focused interface definitions
- Proper separation of concerns

⚠️ **Issues Found:**

**1. INCONSISTENCY: FigmaMessage is Too Generic**
```typescript
// Line 21-25: Generic string type for all messages
export interface FigmaMessage {
  id: string;
  type: string;      // ❌ Should be union type
  payload: unknown;  // ❌ Loses type safety
}
```

**Fix:**
```typescript
export type FigmaMessage = 
  | { id: string; type: "CREATE_FRAME"; payload: FigmaCreateFramePayload }
  | { id: string; type: "FRAME_CREATED"; payload: FigmaFrameCreatedPayload }
  | { id: string; type: "ERROR"; payload: { error: string } }
  | { id: string; type: "PING"; payload: {} }
  | { id: string; type: "PONG"; payload: {} };
```

**2. INCOMPLETE: ImportPageResult**
```typescript
// Line 14-19: Doesn't capture all success scenarios
export interface ImportPageResult {
  success: boolean;
  screenshots: Screenshot[];
  figmaFrameId?: string;    // Only in some scenarios
  error?: string;
}
```
- This type is defined but never actually used anywhere
- Tools return different shapes than this interface describes

**3. DUPLICATE TYPES**
- Layer types are re-exported from `./layers.js` (line 47-58)
- But the Figma plugin also defines these types locally in `code.ts`
- Leads to maintenance burden when types change

---

### 7. **src/types/layers.ts** - DOM-to-Figma Layer Types

**Purpose:** Comprehensive type definitions for Figma layer hierarchy extracted from DOM.

**Size:** 108 lines

**Exports:**
- `LayerType` - Union of "FRAME" | "TEXT" | "RECTANGLE"
- Color and styling interfaces (FigmaColor, FigmaFill, FigmaStroke, FigmaDropShadow)
- Layer interfaces (BaseLayer, FrameLayer, TextLayer, RectangleLayer)
- `FigmaLayerTree` - complete page structure
- `LayersCreatedPayload`, `CreateLayersPayload`

**Code Quality Analysis:**

✅ **Good Practices:**
- Hierarchical type structure mirroring Figma's API
- Proper optional fields for styling
- Auto Layout properties properly captured
- Well-commented with descriptive field names

⚠️ **Issues Found:**

**1. INCOMPLETE: Missing Optional Fields**
```typescript
// Lines 45-65: FrameLayer missing some Figma properties
export interface FrameLayer extends BaseLayer {
  // Missing:
  // - constrainProportions?: boolean
  // - cornerRadius?: number  (on TextLayer too)
  // - rotationAngle?: number
  // - opacity?: number
  // - blendMode?: string
}
```

**2. ISSUE: Effect Type Restrictions**
```typescript
// Line 33: Only DROP_SHADOW supported
export type FigmaEffect = FigmaDropShadow;
```
- What about inner shadows, blur, etc.?
- Document why only drop shadow is extracted

**3. ISSUE: Color Space Conversion Loss**
```typescript
// Lines 5-10: Colors always stored as 0-1 RGB
export interface FigmaColor {
  r: number;  // 0-1 range assumed, but not documented
  g: number;
  b: number;
  a?: number;
}
```
- Assumes 0-1 range, but some code converts from 0-255
- No documentation of this convention
- Error-prone for conversions

**4. DESIGN: TextColor vs Fills Inconsistency**
```typescript
// TextLayer stores textColor separately (line 73)
textColor: FigmaColor;
// But RectangleLayer uses fills array (line 80)
fills?: FigmaFill[];
```
- Inconsistent representation of color
- Text layers should also use fills for consistency

---

### 8. **src/config/viewports.ts** - Viewport Configuration

**Purpose:** Centralized viewport dimension constants and utilities.

**Size:** 77 lines

**Exports:**
- `VIEWPORTS` - Record of viewport configurations
- `getViewport()` - Get viewport by type
- `getAllViewports()` - Get all configurations
- `getViewportTypes()` - Get available types
- `isValidViewportType()` - Type guard
- `getViewportDimensions()` - Get width/height object

**Code Quality Analysis:**

✅ **Good Practices:**
- Excellent use of TypeScript `as const satisfies` pattern
- Type guard function for runtime validation
- Comprehensive helper functions
- Well-documented with JSDoc

⚠️ **Issues Found:**

**1. MINOR: Hardcoded Constants**
```typescript
// Lines 4-7: Dimensions hardcoded, not configurable
const DESKTOP_WIDTH = 1440;
const DESKTOP_HEIGHT = 900;
```
- What if user wants different viewport sizes?
- Should be environment-configurable

**2. UNUSED FUNCTION**
```typescript
// Line 32-37: getViewport() is not used, but could be
export function getViewport(type: ViewportType): ViewportConfig {
  // Used in screenshot-service.ts but return value unused directly
}
```
- The function is imported and called in `screenshot-service.ts:39`
- But return value is immediately destructured
- Could optimize to `getViewportDimensions()` directly

**3. DESIGN: Missing Mobile Portrait Variant**
- Only has Mobile (375x812) which is portrait
- No landscape orientation support
- Tablet sizes missing

---

### 9. **src/services/figma-bridge.ts** - WebSocket Server & Communication

**Purpose:** Manages WebSocket connection to Figma plugin, handles request/response pairs with timeout.

**Size:** 229 lines

**Exports:**
- `FigmaBridge` - Main class with methods:
  - `start()` - Start WebSocket server
  - `stop()` - Graceful shutdown
  - `isConnected()` - Check connection status
  - `createFrame()` - Send frame creation request
  - `createLayers()` - Send layers creation request

**Code Quality Analysis:**

✅ **EXCELLENT Practices:**
- Request/response correlation via message IDs
- Proper timeout handling with cleanup
- Type-safe union for pending requests
- Graceful disconnection handling
- Well-commented lifecycle management

⚠️ **Issues Found:**

**1. CRITICAL: Race Condition in isConnected() Check**
```typescript
// Lines 112-143: Lost update race
async createFrame(name: string, screenshots: Screenshot[]): Promise<FigmaFrameCreatedPayload> {
  if (!this.isConnected()) {  // ❌ Check at T0
    return { frameId: "", success: false, error: "Figma plugin is not connected" };
  }
  
  // ... code ...
  
  try {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {  // ✅ Check again at T1
      throw new Error("Figma plugin disconnected before message could be sent");
    }
    this.client.send(JSON.stringify(message));  // ❌ Can fail after check
  } catch (error) {
    // Handle...
  }
}
```

**Impact:** Between the initial check and the actual send, the connection can close.

**Fix:** Only the second check matters. Remove the first check:
```typescript
async createFrame(name: string, screenshots: Screenshot[]): Promise<FigmaFrameCreatedPayload> {
  const id = this.generateMessageId();
  const message: FigmaMessage = {
    id,
    type: "CREATE_FRAME",
    payload: { name, screenshots },
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pendingRequests.delete(id);
      reject(new Error("Request timed out"));
    }, REQUEST_TIMEOUT);

    this.pendingRequests.set(id, { kind: "frame", resolve, reject, timer });

    try {
      if (!this.client || this.client.readyState !== WebSocket.OPEN) {
        throw new Error("Figma plugin is not connected");
      }
      this.client.send(JSON.stringify(message));
    } catch (error) {
      clearTimeout(timer);
      this.pendingRequests.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
```

**2. CRITICAL: Memory Leak Potential**
```typescript
// Lines 39-62: Connection replacement doesn't await closure
this.wss.on("connection", (ws) => {
  if (this.client && this.client.readyState === WebSocket.OPEN) {
    console.error("[FigmaBridge] Replacing existing Figma plugin connection");
    this.client.close();  // ❌ Not awaiting close event
  }
  
  this.client = ws;  // Immediately overwrite
  // ...
});
```

**Impact:** If first client's resources aren't fully released before assigning new client, could leak memory.

**Fix:**
```typescript
this.wss.on("connection", (ws) => {
  if (this.client && this.client.readyState === WebSocket.OPEN) {
    console.error("[FigmaBridge] Replacing existing Figma plugin connection");
    this.client.close();
    this.client.once("close", () => {
      // Cleanup any lingering state
    });
  } else {
    this.client = ws;
  }
});
```

**3. DESIGN: No Max Pending Requests Limit**
```typescript
// Line 31: No upper bound on pending requests
private pendingRequests = new Map<string, PendingResolve>();
```
- If clients don't receive responses, map grows unbounded
- Eventual OOM if many requests timeout

**Fix:**
```typescript
private readonly MAX_PENDING_REQUESTS = 100;

// In createFrame/createLayers:
if (this.pendingRequests.size >= this.MAX_PENDING_REQUESTS) {
  reject(new Error("Too many pending requests"));
}
```

**4. ISSUE: Generic Error Handling**
```typescript
// Line 214: Errors during message parsing silently logged
} catch (error) {
  console.error("[FigmaBridge] Failed to parse message:", error);
}
```
- Malformed message is silently dropped
- No client notification that message was invalid

**5. ISSUE: Hardcoded Port Number**
```typescript
// Line 10: Port hardcoded
const WEBSOCKET_PORT = 19407;
```
- Not configurable via environment variable
- Prevents running multiple instances

---

### 10. **src/services/screenshot-service.ts** - Browser Screenshot Capture

**Purpose:** Manages Playwright browser instance, captures screenshots and DOM structure.

**Size:** 177 lines

**Exports:**
- `CaptureWithLayersResult` - Interface with layerTree and screenshot
- `ScreenshotService` - Main class with methods:
  - `initialize()` - Launch browser
  - `close()` - Close browser
  - `capture()` - Take screenshot
  - `captureWithLayers()` - Extract DOM and screenshot

**Code Quality Analysis:**

✅ **Good Practices:**
- Lazy browser initialization
- Resource cleanup on close
- Network idle waiting (with timeout fallback)
- Animation settle delay before capture
- Full-page screenshot mode

⚠️ **Issues Found:**

**1. CRITICAL: Memory Leak - Browser Not Closed on Error**
```typescript
// Lines 36-91: No error handling for resource cleanup
async capture(url: string, viewportType: ViewportType): Promise<Screenshot> {
  await this.initialize();
  
  const viewport = getViewport(viewportType);
  // ...
  
  const context = await this.browser.newContext({ ... });
  const page = await context.newPage();
  
  try {
    await page.goto(url, { ... });
    // ... more operations ...
    return { ... };
  } finally {
    await context.close();  // ✅ Good - finally ensures this runs
  }
  // ❌ But page.close() is NOT called!
}
```

**Impact:** Page object remains in memory if exception thrown after page creation.

**Fix:**
```typescript
async capture(url: string, viewportType: ViewportType): Promise<Screenshot> {
  await this.initialize();
  
  const viewport = getViewport(viewportType);
  console.error(
    `[ScreenshotService] Capturing ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`,
  );
  
  if (!this.browser) {
    throw new Error("Browser not initialized");
  }
  
  const context = await this.browser.newContext({
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT,
    });
    
    await this.waitForNetworkIdle(page);
    await page.waitForTimeout(500);
    
    const buffer = await page.screenshot({
      fullPage: true,
      type: "png",
    });
    
    const dimensions = (await page.evaluate(
      "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
    )) as { width: number; height: number };
    
    return {
      viewport: viewportType,
      width: dimensions.width,
      height: dimensions.height,
      data: buffer.toString("base64"),
    };
  } finally {
    await page.close();  // ✅ Add this
    await context.close();
  }
}
```

**2. DESIGN: No Timeout for Individual Page Operations**
```typescript
// Lines 59-69: Some operations have no explicit timeouts
await page.waitForTimeout(500);  // ❌ No timeout specified
```
- `waitForTimeout` doesn't have timeout (it's a delay)
- `page.evaluate()` doesn't specify timeout
- Could hang indefinitely on slow pages

**Fix:**
```typescript
const dimensions = (await Promise.race([
  page.evaluate(
    "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
  ),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Dimension query timeout")), 5000)
  ),
])) as { width: number; height: number };
```

**3. ISSUE: Swallowed Network Idle Timeout**
```typescript
// Lines 93-102: Error is caught but only logged
private async waitForNetworkIdle(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", {
      timeout: NETWORK_IDLE_TIMEOUT,
    });
  } catch {
    // Network idle timeout is acceptable
    console.error("[ScreenshotService] Network idle timeout - continuing anyway");
  }
}
```
- Silent failure might hide real issues
- Continues with potentially unloaded content
- No way to distinguish between "timeout ok" and "actual error"

**4. DESIGN: No Page Validation**
```typescript
// Lines 36-91: No check if page is valid before operations
const page = await context.newPage();
await page.goto(url, { ... });  // Could throw if URL invalid
```
- What if URL is unreachable?
- What if page crashes during operations?
- No recovery mechanism

**5. MINOR: Hardcoded Timeout Values**
```typescript
// Lines 7-8: Not configurable
const PAGE_LOAD_TIMEOUT = 30000;
const NETWORK_IDLE_TIMEOUT = 5000;
```
- No way to adjust for slow pages
- No environment override

---

### 11. **src/services/dev-server-manager.ts** - Next.js Dev Server Management

**Purpose:** Starts and manages Next.js development server, resolves file paths to URLs.

**Size:** 209 lines

**Exports:**
- `DevServerManager` - Main class with methods:
  - `resolveToUrl()` - Convert file path/URL to full URL
  - `filePathToRoute()` - Convert file path to route
  - `findProjectRoot()` - Walk up directory tree
  - `ensureDevServer()` - Start server if needed
  - `stopServer()` - Stop running server

**Code Quality Analysis:**

✅ **Good Practices:**
- Checks for already-running server before starting
- Package.json-based project detection
- Multiple URL format support (http://, https://, localhost, @/ aliases)
- Proper process spawning with stdio redirection

⚠️ **CRITICAL Issues Found:**

**1. CRITICAL: Race Condition in Server Startup Detection**
```typescript
// Lines 152-180: Server detected as "ready" but may not actually be listening
const tryResolve = async () => {
  const server = await this.checkExternalServer(DEFAULT_PORT);
  if (server) {
    settle(() => /* resolve */);  // ❌ Server detected, but...
  }
};

serverProcess.stdout?.on("data", async (data: Buffer) => {
  const output = data.toString();
  if (output.includes("Ready") || output.includes("localhost:")) {
    await new Promise((r) => setTimeout(r, READY_SETTLE_DELAY_MS));  // ❌ Arbitrary delay
    tryResolve();  // May still fail - port may not be listening yet
  }
});
```

**Impact:** 
- First request after "server ready" message may fail with ECONNREFUSED
- Race condition between stdout message and actual port binding

**Fix:**
```typescript
const tryResolve = async () => {
  let retries = 0;
  const maxRetries = 10;
  
  while (retries < maxRetries) {
    try {
      const server = await this.checkExternalServer(DEFAULT_PORT);
      if (server) {
        settle(() => resolve(server));
        return;
      }
    } catch {
      // Retry
    }
    
    retries++;
    if (retries < maxRetries) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  
  settle(() => reject(new Error("Dev server did not start listening within timeout")));
};
```

**2. CRITICAL: No Error Handling for Process Spawn**
```typescript
// Lines 133-137: Process spawned with shell: true, no error handling for spawn itself
const serverProcess = spawn("npm", ["run", "dev"], {
  cwd: projectPath,
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,  // ⚠️ Security concern: shell injection possible
});
```

**Impact:**
- If `spawn()` itself fails (e.g., npm not in PATH), error is caught by `serverProcess.on("error")` handler (line 186)
- But what if `projectPath` doesn't exist? `spawn()` doesn't validate `cwd`

**3. CRITICAL: Shell Injection Vulnerability**
```typescript
// Line 136: shell: true allows injection
const serverProcess = spawn("npm", ["run", "dev"], {
  cwd: projectPath,  // ❌ Unsanitized! Could contain shell metacharacters
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});
```

**Impact:** If `projectPath` comes from user input and contains shell metacharacters, arbitrary code execution possible.

**Example Attack:**
```
projectPath = "/tmp/project; rm -rf /"
// Becomes: cd "/tmp/project; rm -rf /" && npm run dev
```

**Fix:**
```typescript
// Don't use shell: true; use direct exec
const serverProcess = spawn("npm", ["run", "dev"], {
  cwd: projectPath,
  stdio: ["ignore", "pipe", "pipe"],
  // shell: true,  // ❌ Remove this
});
```

**4. CRITICAL: Path Traversal Vulnerability**
```typescript
// Lines 19-34: No validation of source path
async resolveToUrl(source: string, projectPath?: string): Promise<string> {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return source;
  }
  
  if (source.startsWith("localhost")) {
    return `http://${source}`;
  }
  
  // It's a file path — start dev server
  const resolvedProjectPath = projectPath || (await this.findProjectRoot(source));
  const route = this.filePathToRoute(source, resolvedProjectPath);
  // ...
}
```

**Impact:**
- User could provide path like `@/../../../../etc/passwd`
- `filePathToRoute()` doesn't validate path stays within project

**Example Attack:**
```
source = "@/../../../../etc/passwd"
// After normalization: "/etc/passwd"
// Then served on localhost:3000/../../../../etc/passwd
```

**Fix:**
```typescript
// After resolving path, verify it's within project
const absolutePath = path.resolve(projectPath, source);
if (!absolutePath.startsWith(path.resolve(projectPath))) {
  throw new Error("Path traversal attempt detected");
}
```

**5. ISSUE: File Path Normalization is Incomplete**
```typescript
// Lines 39-62: Multiple normalization steps could be wrong
filePathToRoute(filePath: string, projectPath: string): string {
  let normalized = filePath;
  
  if (normalized.startsWith("@/")) {
    normalized = normalized.slice(2);  // "app/page.tsx"
  } else if (normalized.startsWith(projectPath)) {
    normalized = normalized.slice(projectPath.length);  // Could have leading slash
  }
  
  // What if filePath is absolute? /var/projects/app/page.tsx
  // What if it has Windows separators? app\page.tsx
}
```

**6. DESIGN: Process Exit Handling is Incomplete**
```typescript
// Lines 190-194: Exit code 0 is silently ignored
serverProcess.on("exit", (code: number | null) => {
  if (code !== 0 && code !== null) {
    settle(() => reject(new Error(`Dev server exited with code ${code}`)));
  }
  // ❌ What if code === 0? Server exited cleanly, but why?
});
```

**7. ISSUE: Zombie Process Prevention**
```typescript
// Line 204: Process.kill() doesn't always work on some platforms
async stopServer(): Promise<void> {
  if (this.serverProcess) {
    this.serverProcess.kill();  // ❌ Default signal is SIGTERM, may not kill long-running processes
  }
}
```

**Fix:**
```typescript
async stopServer(): Promise<void> {
  if (this.serverProcess) {
    this.serverProcess.kill("SIGKILL");  // Force kill
  }
}
```

---

### 12. **src/services/dom-extractor.ts** - DOM-to-Figma Layer Extraction

**Purpose:** Extract DOM structure from rendered page and convert to Figma layer hierarchy.

**Size:** 439 lines

**Structure:**
- `EXTRACTION_SCRIPT` - Large template literal with browser-side extraction code
- `DOMExtractor` class - Node-side wrapper
- Helper functions for debugging

**Code Quality Analysis:**

This is the most complex and sophisticated piece of code in the codebase. The DOM extraction script is comprehensive and handles many edge cases.

✅ **EXCELLENT Practices:**
- Comprehensive color parsing (RGB, RGBA, hex, okllab, lab)
- Sophisticated layout detection (flex, grid, block)
- Proper visibility checking
- Box shadow parsing
- Auto-layout property detection

⚠️ **Issues Found:**

**1. CRITICAL: Untested Color Space Conversions**
```javascript
// Lines 38-48: OKLab to RGB conversion has no test coverage
const l_ = L + 0.3963377774*a + 0.2158037573*b;
const m_ = L - 0.1055613458*a - 0.0638541728*b;
const s_ = L - 0.0894841775*a - 1.2914855480*b;
const l3 = l_*l_*l_, m3 = m_*m_*m_, s3 = s_*s_*s_;
return {
  r: Math.max(0, Math.min(1,  4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3)),
  // ...
};
```

**Impact:** 
- Math coefficients are hardcoded (likely from spec)
- No validation these are correct
- Rounding errors could accumulate
- One mistyped digit breaks all okllab color extraction

**Recommendation:** Add unit tests for color conversions:
```javascript
// Test case
const color = parseColor("oklab(0.5 0.1 0.2)");
// Should produce specific RGB values within epsilon
```

**2. CRITICAL: Regex Complexity - ReDoS Risk**
```javascript
// Line 137: Potentially catastrophic backtracking
for (const shadow of boxShadow.split(/,(?![^(]*\\))/)) {
```

**Impact:** Malformed box-shadow CSS could cause regex engine to hang.

**Example Attack Input:**
```css
box-shadow: ((((((((((((((((((((rgba(0,0,0,1)))))))))))))))))))))))
```

The regex `/,(?![^(]*\))/` doesn't have a catastrophic backtracking risk actually - it's safe. But good to document.

**3. ISSUE: Color Parsing Doesn't Handle All CSS Formats**
```javascript
// Lines 19-79: Missing color formats:
// - Named colors (red, blue, currentColor)
// - hsl/hsla
// - hwb
// - Named CSS variables (var(--color-red))
```

**Impact:** 
- Pages using CSS custom properties won't have colors extracted
- Named colors silently fail
- Fallback to white/black missing

**Fix:**
```javascript
function parseColor(colorStr) {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
  
  // Named colors mapping
  const namedColors = {
    'red': '#FF0000',
    'blue': '#0000FF',
    // ... more colors
  };
  
  if (colorStr in namedColors) {
    colorStr = namedColors[colorStr];
  }
  
  // Then try parsing...
}
```

**4. DESIGN: Text Extraction is Fragile**
```javascript
// Lines 93-100: Only gets direct text nodes
function getDirectText(el) {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
  }
  const trimmed = text.trim();
  return trimmed || null;
}
```

**Problem:**
- Won't extract text from nested elements
- `<span>Hello <em>world</em></span>` only gets "Hello"
- Should recursively extract all text

**Fix:**
```javascript
function getDirectText(el) {
  let text = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
    }
    // Don't recurse into child elements - keep as "direct"
  }
  const trimmed = text.trim();
  return trimmed || null;
}
```

**5. ISSUE: Border Parsing Only Checks Top Border**
```javascript
// Lines 124-129: Only reads borderTopWidth/Color
function parseBorder(styles) {
  const borderWidth = parseFloat(styles.borderTopWidth) || 0;
  if (borderWidth === 0) return { strokes: [], strokeWeight: 0 };
  const borderColor = parseColor(styles.borderTopColor);
```

**Problem:**
- What about `border-right: 5px solid red`?
- Assumes all sides are the same
- May not match actual rendered border

**6. DESIGN: Grid Layout Detection is Simplified**
```javascript
// Line 191: Grid auto-flow detection is basic
layoutMode = styles.gridAutoFlow.includes('column') ? 'VERTICAL' : 'HORIZONTAL';
```

**Problem:**
- CSS Grid is 2D, but Figma auto-layout is 1D
- Can't represent complex grid layouts
- Should add fallback or warning

**7. ISSUE: Z-index is Completely Ignored**
```javascript
// No z-index or layer ordering logic
// Elements added in DOM order, not visual order
```

**Impact:**
- Layering won't match visual design if CSS uses z-index
- Overlapping elements will be in wrong order in Figma

**8. MINOR: SVG/Canvas Not Extracted**
```javascript
// Lines 11: SVG marked as skip, not extracted
const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','IFRAME',...]);
```

**Problem:**
- SVGs are rendered content but treated as void
- Icon fonts, charts, diagrams lost
- Only fallback is screenshot

**9. MINOR: No Accessibility Consideration**
```javascript
// No extraction of ARIA labels, roles, or semantic information
// Extracted text may lack context
```

**Example:**
- `<button aria-label="close">×</button>` exports as text "×"
- Should be "close" for designers to understand

**10. ISSUE: Maximum Recursion Depth Limit**
```javascript
// No check for deeply nested DOM
function extractElement(el, parentRect, parentStyles) {
  // ...
  for (const child of el.children) {
    const extracted = extractElement(child, rect, styles);  // Could stack overflow
  }
}
```

**Impact:** Very deep DOM trees could exceed call stack.

---

### 13. **src/tools/index.ts** - Tool Implementation & Handlers

**Purpose:** Implements the five MCP tools that Claude can invoke.

**Size:** 332 lines

**Exports:**
- `ToolContext` - Interface with service references
- `ToolResult` - Interface for tool response format
- `getToolDefinitions()` - Returns tool metadata for MCP
- `handleToolCall()` - Router to specific tool handler
- Handlers for each tool

**Code Quality Analysis:**

✅ **Good Practices:**
- Centralized tool routing
- Input validation via Zod schemas
- Clear error messages to user
- Proper Figma connection checks

⚠️ **Issues Found:**

**1. ISSUE: Validation Not Actually Used**
```typescript
// Lines 62-68: Schema parsed but not validated against!
async function handleImportPage(input: ImportPageInput, context: ToolContext): Promise<ToolResult> {
  const parsed = ImportPageInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
      isError: true,
    };
  }
  
  const { source, viewports, projectPath } = parsed.data;  // ✅ Good
  
  // But input is just cast at function signature:
  // async function handleImportPage(input: ImportPageInput, context: ToolContext)
  // ❌ TypeScript doesn't know input was validated!
```

**Issue:** The validation happens, but it's redundant since function signature says input is already ImportPageInput.

**Root Cause:** In `handleToolCall()` (line 44):
```typescript
case "import_page":
  return handleImportPage(args as ImportPageInput, context);  // ❌ Unsafe cast
```

**Fix:** Don't cast; let Zod validate then pass parsed.data:
```typescript
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "import_page": {
      const parsed = ImportPageInputSchema.safeParse(args);
      if (!parsed.success) {
        return {
          content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
          isError: true,
        };
      }
      return handleImportPage(parsed.data, context);
    }
    // ... etc
  }
}

async function handleImportPage(input: ImportPageInput, context: ToolContext): Promise<ToolResult> {
  const { source, viewports, projectPath } = input;  // No re-validation needed
  // ...
}
```

**2. ISSUE: No Input Sanitization**
```typescript
// Line 87: source passed directly to URL resolution
const url = await context.devServerManager.resolveToUrl(source, projectPath);
```

**Problem:**
- If source contains path traversal attacks, they're not caught here
- dev-server-manager should validate, but layering is unclear

**3. DESIGN: Repeated Figma Connection Check**
```typescript
// Lines 73-83 in handleImportPage
if (!context.figmaBridge.isConnected()) {
  return {
    content: [{ type: "text", text: "Figma plugin is not connected..." }],
    isError: true,
  };
}

// Lines 139-149 in handleImportPageAsLayers - identical check
if (!context.figmaBridge.isConnected()) {
  return {
    content: [{ type: "text", text: "Figma plugin is not connected..." }],
    isError: true,
  };
}
```

**Fix:** Extract to helper:
```typescript
function ensureFigmaConnected(context: ToolContext): ToolResult | null {
  if (!context.figmaBridge.isConnected()) {
    return {
      content: [{ type: "text", text: "Figma plugin is not connected. Please open Figma and run the figify-mcp plugin first." }],
      isError: true,
    };
  }
  return null;
}

async function handleImportPage(input: ImportPageInput, context: ToolContext): Promise<ToolResult> {
  const connectionError = ensureFigmaConnected(context);
  if (connectionError) return connectionError;
  
  // ... rest of implementation
}
```

**4. ISSUE: Page Name Extraction is Fragile**
```typescript
// Lines 320-331: extractPageName() logic
function extractPageName(source: string): string {
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
```

**Problems:**
- Assumes "page.tsx" naming convention (Next.js specific)
- What about `layout.tsx`, `layout.js`?
- What about URLs like `localhost:3000`? Returns "3000"
- What about `@/app/page.tsx` vs `/abs/path/page.tsx`?

**Test Cases That Fail:**
- `"localhost:3000/dashboard"` → returns `"dashboard"` ✓ (works)
- `"localhost:3000"` → returns `"3000"` ❌ (should be "Home" or better)
- `"@/app/layout.tsx"` → returns `"layout.tsx"` ❌ (doesn't extract parent dir)
- `"@/app/page.tsx"` → returns `"app"` ✓ (works)

**5. ISSUE: No Pagination for Large Results**
```typescript
// Lines 233: Could return huge screenshot data inline
text: `Captured ${screenshots.length} screenshot(s):\n${screenshots.map((s) => ...).join("\n")}`
```

**Problem:**
- If user captures 10+ viewports, text response could be huge
- MCP client might reject large responses
- Screenshot data itself (base64) not included, but noted as captured

**6. ISSUE: Synchronous Viewport Loop**
```typescript
// Lines 91-94: Sequential capture is slow for multiple viewports
for (const viewport of viewports as ViewportType[]) {
  const screenshot = await context.screenshotService.capture(url, viewport);
  screenshots.push(screenshot);
}
```

**Problem:**
- Takes N × (page load + network idle + screenshot time)
- Could be parallelized: `Promise.all(viewports.map(...))`
- But would need to handle resource contention in ScreenshotService

---

### 14. **src/utils/zod-to-json-schema.ts** - Schema Conversion Utility

**Purpose:** Converts Zod schemas to JSON Schema format for MCP tool metadata.

**Size:** 74 lines

**Exports:**
- `zodToJsonSchema()` - Main conversion function
- Helper: `convertZodType()`
- Helper: `convertObject()`

**Code Quality Analysis:**

✅ **Good Practices:**
- Handles main Zod types (string, number, boolean, array, enum, optional, default)
- Proper property requirements tracking

⚠️ **Issues Found:**

**1. INCOMPLETE: Missing Zod Type Support**
```typescript
// Lines 17-47: Only handles subset of Zod types
switch (typeName) {
  case "ZodString":
  case "ZodNumber":
  case "ZodBoolean":
  case "ZodArray":
  case "ZodEnum":
  case "ZodOptional":
  case "ZodDefault":
  // Missing:
  // - ZodLiteral
  // - ZodUnion
  // - ZodIntersection
  // - ZodRecord
  // - ZodMap
  // - ZodTuple
  // - ZodNullable
  // - ZodPromise
  // - etc...
  default:
    return { type: "string" };  // ❌ Silent fallback to string
}
```

**Impact:** 
- Union types (e.g., `z.union([z.literal('desktop'), z.literal('mobile')])`) fall through to `{ type: "string" }`
- Clients don't know about the constraint
- Complex schemas lose information

**2. ISSUE: Default Value Computation**
```typescript
// Lines 40-44: Calls default function at schema-gen time
case "ZodDefault":
  return {
    ...convertZodType(def.innerType),
    default: def.defaultValue(),  // ❌ Executes function!
  };
```

**Problem:**
- Some defaults are functions (e.g., `new Date()`)
- Calling at schema generation time gets wrong value
- Should use lazy evaluation or indicate it's dynamic

**3. MINOR: No Constraints Extracted**
```typescript
// No support for Zod constraints:
// z.string().min(5).max(100).regex(...)
// z.number().gt(0).lt(100)
```

**Impact:** JSON Schema doesn't reflect input constraints; client can't validate locally.

**4. ISSUE: Required Field Detection is Incomplete**
```typescript
// Lines 56-65: Only checks typeName
if (valueDef.typeName !== "ZodOptional" && valueDef.typeName !== "ZodDefault") {
  required.push(key);
}
```

**Problem:**
- What about `ZodNullable`? Should it be required?
- What about `z.string().or(z.null())`?

---

### 15. **figma-plugin/src/code.ts** - Figma Plugin Code

**Purpose:** Figma API handler for creating frames and layers from MCP server messages.

**Size:** 550 lines

**Exports:**
- Entry point: receives messages from UI, calls Figma API
- `createFrameWithScreenshots()` - Create frames with screenshot images
- `createFrameWithLayers()` - Create frames with editable layer hierarchy
- `createNode()` - Recursive layer creation helper
- Font loading helpers

**Code Quality Analysis:**

✅ **Good Practices:**
- Proper async/await for Figma API calls
- Font caching to reduce redundant loads
- Recursive layer creation for nested hierarchy
- Error handling with try/catch

⚠️ **Issues Found:**

**1. CRITICAL: Type Duplication**
```typescript
// Lines 3-98: All types duplicated from src/types/
interface Screenshot { ... }
interface FigmaColor { ... }
interface FrameLayer extends BaseLayer { ... }
// ... 20+ more interfaces
```

**Problem:**
- Same interfaces defined in both `src/types/layers.ts` and `figma-plugin/src/code.ts`
- If types change, must update both places
- No TypeScript compilation between server and plugin to catch mismatches

**Fix:** Share types via npm package or code generation:
```bash
# Option 1: Shared npm package (@figify/types)
# Option 2: Copy types as build step
# Option 3: Codegen from OpenAPI/GraphQL schema
```

**2. ISSUE: No Font Family Fallback**
```typescript
// Lines 250-270: Only handles Inter font
async function loadInterFont(weight: number): Promise<FontName> {
  let style = "Regular";
  if (weight >= 700) style = "Bold";
  // ...
  try {
    await figma.loadFontAsync({ family: "Inter", style });
  } catch (_e) {
    // Fall back to Regular if weight unavailable
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  }
}
```

**Problem:**
- Only Inter font is supported
- If page uses "Helvetica" or "Georgia", all text becomes Inter
- No system font fallback

**Fix:**
```typescript
async function loadFont(fontFamily: string, weight: number): Promise<FontName> {
  // Try requested font first
  try {
    const style = getStyle(weight);
    await figma.loadFontAsync({ family: fontFamily, style });
    return { family: fontFamily, style };
  } catch {
    // Try Inter as primary fallback
    try {
      const style = getStyle(weight);
      await figma.loadFontAsync({ family: "Inter", style });
      return { family: "Inter", style };
    } catch {
      // Fall back to Helvetica (Figma default)
      return { family: "Helvetica", style: weight >= 700 ? "Bold" : "Regular" };
    }
  }
}
```

**3. ISSUE: TextLayer Width/Height Resize**
```typescript
// Lines 309-310: Resizes text to extracted dimensions
text.resize(textLayer.width, textLayer.height);
```

**Problem:**
- Text width/height should be determined by content + font size
- Forcing resize can cut off text or add unwanted whitespace
- Figma has `layoutSizingHorizontal: "HUG"` for this

**Fix:**
```typescript
// Don't force resize; let Figma size text based on content
// Only set position and font/color properties
text.x = textLayer.x;
text.y = textLayer.y;
text.fontName = fontName;
text.characters = textLayer.characters;
text.fontSize = textLayer.fontSize;
// Figma will auto-size to fit text
```

**4. ISSUE: Rectangle Creation Without Validation**
```typescript
// Lines 317-368: Creates rectangles but doesn't validate dimensions
const rect = figma.createRectangle();
rect.x = rectLayer.x;
rect.y = rectLayer.y;
rect.resize(rectLayer.width, rectLayer.height);  // Could be 0x0
```

**Problem:**
- Doesn't validate width/height > 0
- Could create invisible shapes
- No error handling

**Fix:**
```typescript
if (rectLayer.width <= 0 || rectLayer.height <= 0) {
  console.warn(`[Figma] Skipping rectangle with invalid dimensions: ${rectLayer.width}x${rectLayer.height}`);
  return 0;  // Don't create
}
```

**5. ISSUE: Auto Layout Child Sizing is Fragile**
```typescript
// Lines 452-461: Tries to set child sizing with error swallowing
try {
  if (frameLayer.layoutSizingHorizontal === "FILL" && parent.layoutMode !== "NONE") {
    frame.layoutSizingHorizontal = "FILL";
  }
} catch (_e) {
  // Parent doesn't support auto-layout sizing, skip
}
```

**Problem:**
- Error silently swallowed without logging what failed
- Can't diagnose why sizing didn't apply
- Figma API might throw for other reasons (permissions, etc.)

**Fix:**
```typescript
try {
  if (frameLayer.layoutSizingHorizontal === "FILL" && parent.layoutMode !== "NONE") {
    frame.layoutSizingHorizontal = "FILL";
  }
  // ... etc
} catch (e) {
  console.error(`[Figma] Failed to set auto layout sizing:`, e);
  // Continue anyway, but log warning
}
```

**6. DESIGN: No Container Frame Validation**
```typescript
// Lines 175-230: createFrameWithScreenshots() assumes success
const containerFrame = figma.createFrame();
containerFrame.name = name;
containerFrame.resize(totalWidth + 80, maxHeight + 120);
// ... appends multiple children ...
```

**Problem:**
- If any append fails, partial frame is left in Figma
- No transaction/rollback mechanism
- Should validate before creating

**7. ISSUE: Base64 Decoding Without Validation**
```typescript
// Line 205: Assumes valid base64
const imageBytes = figma.base64Decode(screenshot.data);
```

**Problem:**
- If screenshot.data isn't valid base64, this throws
- Error handling is at outer try/catch
- Could leave partial frame

**8. ISSUE: No Memory Management for Large Payloads**
```typescript
// Lines 159-244: Entire screenshot data kept in memory
for (const screenshot of screenshots) {
  const imageBytes = figma.base64Decode(screenshot.data);  // Could be 10MB+
  const image = figma.createImage(imageBytes);
  // imageBytes stays in memory until function returns
}
```

**Problem:**
- Decoding multiple large screenshots could OOM
- Should process sequentially and release references

---

### 16. **figma-plugin/src/ui.html** - Figma Plugin UI

**Purpose:** WebSocket client that connects to MCP server, receives CREATE_FRAME/CREATE_LAYERS messages, forwards to Figma plugin code.

**Size:** 373 lines (HTML + embedded JavaScript)

**Exports:**
- Self-contained UI; no module exports

**Code Quality Analysis:**

✅ **Good Practices:**
- Auto-reconnection with exponential backoff
- Proper WebSocket lifecycle management
- Log UI for debugging
- Status indicator with pulse animation
- Message bridging between WebSocket and Figma plugin

⚠️ **Issues Found:**

**1. ISSUE: Hardcoded WebSocket URL**
```javascript
// Line 141: No environment configuration
const WEBSOCKET_URL = "ws://localhost:19407";
```

**Problem:**
- Can't connect to remote MCP server
- Can't change port dynamically
- No way to debug in different environments

**Fix:**
```javascript
// Read from Figma design tokens or query parameter
const getWebSocketURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('wsUrl') || 'ws://localhost:19407';
};
const WEBSOCKET_URL = getWebSocketURL();
```

**2. ISSUE: Auto-reconnect Doesn't Persist State**
```javascript
// Lines 220-226: Reconnects but doesn't retry messages
ws.onclose = () => {
  updateStatus("disconnected");
  log("Disconnected from MCP server");
  ws = null;
  
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    setTimeout(connect, RECONNECT_DELAY);
  }
};
```

**Problem:**
- If Figma plugin sends message while disconnected, it's lost
- Should queue messages and retry on reconnect

**Fix:**
```javascript
let messageQueue = [];

function queueMessage(message) {
  messageQueue.push(message);
}

ws.onopen = () => {
  // Flush queued messages
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift();
    ws.send(JSON.stringify(msg));
  }
};

// In handleMessage, queue if disconnected:
function sendToServer(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    queueMessage(message);
  }
}
```

**3. ISSUE: No Message Timeout**
```javascript
// Lines 280-291: Sends message but doesn't wait for response
parent.postMessage(
  {
    pluginMessage: {
      type: "CREATE_FRAME",
      id,
      name,
      screenshots,
    },
  },
  "*"
);
// Then immediately waits for window.onmessage...
// But Figma plugin might be slow
```

**Problem:**
- If Figma plugin code crashes, message never comes back
- No timeout mechanism
- Server hangs waiting for response forever

**Fix:**
```javascript
function sendToPluginWithTimeout(message, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Plugin message timeout"));
    }, timeout);
    
    // Store handler for this message ID
    const handler = (event) => {
      const msg = event.data.pluginMessage;
      if (msg && msg.id === message.id) {
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    
    window.addEventListener('message', handler);
    parent.postMessage({ pluginMessage: message }, "*");
  });
}
```

**4. ISSUE: No Authentication/Authorization**
```javascript
// Lines 206-213: Accepts any message from WebSocket
ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data);
    handleMessage(message);  // ❌ Trusts all messages
  } catch (error) {
    log(`Failed to parse message: ${error.message}`, "error");
  }
};
```

**Problem:**
- Any WebSocket client can send CREATE_FRAME messages
- No authentication between server and plugin
- Potential for attacks if localhost exposed

**Fix:**
```javascript
// On first connect, perform handshake
const PLUGIN_SECRET = "figify-secret-key";  // Should come from server somehow

ws.onopen = () => {
  // Send auth challenge
  ws.send(JSON.stringify({
    type: "AUTH",
    secret: PLUGIN_SECRET,
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "AUTH_RESPONSE") {
    if (message.success) {
      isAuthenticated = true;
      flushMessageQueue();
    } else {
      ws.close();
    }
  }
};
```

**5. ISSUE: Unbounded Log Size**
```javascript
// Lines 148-155: Log grows forever
const logEl = document.getElementById("log");
const entry = document.createElement("div");
entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
logEl.appendChild(entry);
logEl.scrollTop = logEl.scrollHeight;
```

**Problem:**
- Memory leak: old log entries never removed
- After hours of use, DOM becomes huge
- Scrolling becomes slow

**Fix:**
```javascript
function log(message, type = "info") {
  const logEl = document.getElementById("log");
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.appendChild(entry);
  
  // Keep only last 100 entries
  while (logEl.children.length > 100) {
    logEl.removeChild(logEl.firstChild);
  }
  
  logEl.scrollTop = logEl.scrollHeight;
}
```

**6. ISSUE: No Error Context in UI**
```javascript
// Lines 352-366: Error logged but minimal context
} else if (msg.type === "ERROR") {
  log(`Error: ${msg.error}`, "error");
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      id: msg.id,
      type: "ERROR",
      payload: {
        error: msg.error,
      },
    }));
  }
}
```

**Problem:**
- Error message might not be helpful
- No stack trace or error code
- User doesn't know what went wrong

**Fix:**
```javascript
} else if (msg.type === "ERROR") {
  const errorMsg = msg.payload?.error || "Unknown error";
  const errorCode = msg.payload?.code || "UNKNOWN";
  log(`Error [${errorCode}]: ${errorMsg}`, "error");
  
  // Log more context for debugging
  console.error("Full error payload:", msg.payload);
}
```

---

## Critical Issues Summary

### Issue #1: Memory Leak in Screenshot Service
**File:** `src/services/screenshot-service.ts:36-91`  
**Severity:** CRITICAL  
**Description:** Page object is not closed in finally block, only context. If an exception occurs after page creation, page remains in memory.  
**Impact:** Progressive memory leak with repeated captures.  
**Fix:** Add `await page.close()` in finally block.

### Issue #2: Shell Injection Vulnerability
**File:** `src/services/dev-server-manager.ts:136`  
**Severity:** CRITICAL  
**Description:** `projectPath` parameter passed to `spawn()` with `shell: true` allows arbitrary code execution if path contains shell metacharacters.  
**Impact:** Remote code execution if user supplies malicious path.  
**Fix:** Remove `shell: true` or validate/escape projectPath.

### Issue #3: Race Condition in Dev Server Startup
**File:** `src/services/dev-server-manager.ts:152-180`  
**Severity:** CRITICAL  
**Description:** Server is considered "ready" based on stdout message, but port may not be listening yet. First request fails with ECONNREFUSED.  
**Impact:** Tool returns success but subsequent operations fail.  
**Fix:** Implement retry logic in checkExternalServer().

---

## Code Smells & Anti-patterns

| # | Issue | Location | Severity | Type |
|---|-------|----------|----------|------|
| 1 | Hardcoded version number | src/cli.ts:289 | Minor | Config |
| 2 | Hardcoded port number | src/services/figma-bridge.ts:10 | Minor | Config |
| 3 | Hardcoded timeouts | src/services/screenshot-service.ts:7-8 | Minor | Config |
| 4 | Hardcoded viewport dimensions | src/config/viewports.ts:4-7 | Minor | Config |
| 5 | Hardcoded WebSocket URL | figma-plugin/src/ui.html:141 | Minor | Config |
| 6 | Duplicate type definitions | figma-plugin/src/code.ts vs src/types/ | Major | Maintenance |
| 7 | Unused helper functions | src/registry.ts:88-90, src/ui.ts wrapper functions | Minor | Dead Code |
| 8 | Redundant input validation | src/tools/index.ts:62-68 | Minor | Logic |
| 9 | Silent error suppression | src/services/screenshot-service.ts:98-101 | Minor | Error Handling |
| 10 | Swallowed exceptions | figma-plugin/src/code.ts:459-461 | Minor | Error Handling |
| 11 | Fragile text extraction | src/services/dom-extractor.ts:93-100 | Minor | Algorithm |
| 12 | Incomplete color format support | src/services/dom-extractor.ts:19-79 | Minor | Feature |
| 13 | No z-index handling | src/services/dom-extractor.ts | Minor | Feature |
| 14 | Path traversal risk | src/services/dev-server-manager.ts:19-34 | Major | Security |
| 15 | Untested color conversions | src/services/dom-extractor.ts:38-48 | Major | Testing |

---

## Security Concerns

### 1. **Shell Injection via projectPath** (CRITICAL)
- **Location:** src/services/dev-server-manager.ts:136
- **Risk:** Remote code execution
- **Fix:** Don't use `shell: true` or validate projectPath

### 2. **Path Traversal Attack** (HIGH)
- **Location:** src/services/dev-server-manager.ts:19-34
- **Risk:** Access files outside project directory
- **Fix:** Validate resolved path stays within project root

### 3. **No Authentication on WebSocket** (MEDIUM)
- **Location:** figma-plugin/src/ui.html:206-213
- **Risk:** Unauthorized frame creation if localhost exposed
- **Fix:** Implement handshake/token authentication

### 4. **Unvalidated URL in screenshot capture** (MEDIUM)
- **Location:** src/services/screenshot-service.ts:60
- **Risk:** SSRF attacks - internal network scanning
- **Fix:** Whitelist allowed hosts or deny private IP ranges

### 5. **Arbitrary DOM Execution** (LOW)
- **Location:** src/services/dom-extractor.ts:392
- **Risk:** If page contains malicious JavaScript
- **Mitigation:** Playwright runs in sandbox; acceptable risk

---

## Performance Issues

| Issue | Location | Impact | Solution |
|-------|----------|--------|----------|
| Sequential viewport capture | src/tools/index.ts:91-94 | O(N) time | Parallelize with Promise.all() |
| Unbounded pending requests | src/services/figma-bridge.ts:31 | Memory leak | Add MAX_PENDING_REQUESTS limit |
| No browser connection pooling | src/services/screenshot-service.ts | High startup cost | Reuse browser/context instances |
| Repeated font loads | figma-plugin/src/code.ts:249 | Figma API overhead | Caching (already done, good) |
| Unbounded log size | figma-plugin/src/ui.html:148 | DOM memory leak | Trim old entries |
| Regex with backtracking risk | src/services/dom-extractor.ts:137 | CPU spike | Already safe, but document |

---

## Testing & Reliability

**Current Status:** No unit/integration tests found

**Recommendations:**

1. **Unit Tests for Color Conversions**
   ```typescript
   describe("DOM Extractor - Color Parsing", () => {
     test("parses RGB colors", () => { ... });
     test("parses okllab colors", () => { ... });
     test("parses lab colors", () => { ... });
     test("parses hex colors", () => { ... });
     test("handles invalid colors gracefully", () => { ... });
   });
   ```

2. **Integration Tests for Dev Server**
   ```typescript
   describe("Dev Server Manager", () => {
     test("starts Next.js server", () => { ... });
     test("detects existing server", () => { ... });
     test("converts file paths to routes", () => { ... });
     test("handles server startup timeout", () => { ... });
   });
   ```

3. **Figma Plugin Tests**
   - Can't directly test Figma API, but can test:
   - Layer creation logic (unit tests)
   - Type conversions
   - Font loading fallbacks

4. **E2E Tests**
   - Test full pipeline: import page → capture → send to Figma
   - Requires running Next.js app and Figma plugin

---

## Recommendations & Improvements

### 🔴 CRITICAL (Fix Immediately)

1. **Add page.close() in screenshot service**
   ```typescript
   finally {
     await page.close();  // Add this
     await context.close();
   }
   ```

2. **Fix shell injection vulnerability**
   ```typescript
   // Remove shell: true, use direct spawn
   const serverProcess = spawn("npm", ["run", "dev"], {
     cwd: projectPath,
     stdio: ["ignore", "pipe", "pipe"],
     // Remove: shell: true,
   });
   ```

3. **Fix dev server startup race condition**
   - Implement exponential backoff retry
   - Verify port is actually listening before resolving

### 🟠 HIGH (Plan for next sprint)

1. **Extract all hardcoded config values**
   ```typescript
   // Create config.ts
   export const CONFIG = {
     WEBSOCKET_PORT: process.env.WEBSOCKET_PORT || 19407,
     PAGE_LOAD_TIMEOUT: process.env.PAGE_LOAD_TIMEOUT || 30000,
     NETWORK_IDLE_TIMEOUT: process.env.NETWORK_IDLE_TIMEOUT || 5000,
     DESKTOP_WIDTH: process.env.DESKTOP_WIDTH || 1440,
     DESKTOP_HEIGHT: process.env.DESKTOP_HEIGHT || 900,
   };
   ```

2. **Unify type definitions**
   - Create shared types package
   - Or code-generate types from single source

3. **Add comprehensive error logging**
   - Log full stack traces in DEBUG mode
   - Include request/response context
   - Store logs for diagnostics

4. **Implement security measures**
   - Add WebSocket authentication
   - Validate all file paths
   - Whitelist allowed hosts for SSRF prevention

5. **Add timeout handling for Playwright operations**
   ```typescript
   const dimensionsPromise = page.evaluate(...);
   const timeoutPromise = new Promise((_, reject) =>
     setTimeout(() => reject(new Error("Timeout")), 5000)
   );
   const dimensions = await Promise.race([dimensionsPromise, timeoutPromise]);
   ```

### 🟡 MEDIUM (Refactor for maintainability)

1. **Add comprehensive tests**
   - Unit tests for color parsing
   - Integration tests for dev server
   - E2E tests for full pipeline

2. **Improve error messages**
   - Include error codes
   - Provide recovery suggestions
   - Log full context for debugging

3. **Add better logging**
   - Structured logging (JSON format)
   - Log levels: DEBUG, INFO, WARN, ERROR
   - Request tracing with IDs

4. **Optimize performance**
   - Parallelize viewport capture
   - Add max pending request limits
   - Implement message queueing in plugin UI

5. **Improve DevServer robustness**
   - Add process health checks
   - Implement graceful restart
   - Better stdout parsing

### 🟢 LOW (Nice to have)

1. **Add more viewport presets**
   - Tablet sizes
   - Landscape orientations
   - Custom dimensions

2. **Extend DOM extraction**
   - Support more CSS color formats (hsl, hwb)
   - Extract CSS custom properties
   - Handle nested layout modes better
   - Support z-index ordering

3. **Improve font handling**
   - Support custom fonts beyond Inter
   - Font fallback chains
   - System font detection

4. **Add plugin features**
   - Dark mode support
   - Custom theme colors
   - Export imported designs

5. **Documentation**
   - Architecture diagrams
   - API documentation
   - Troubleshooting guide
   - Contributing guidelines

---

## Conclusion

**figify-mcp** is a well-engineered project with thoughtful architecture and good code quality overall. The critical issues found are in security (shell injection), reliability (startup race condition), and resource management (memory leak).

**Key Strengths:**
- Clean separation of concerns
- Comprehensive type safety
- Sophisticated DOM extraction
- Good async/await patterns

**Key Weaknesses:**
- Missing tests
- Hardcoded configuration
- Duplicate type definitions
- Some security vulnerabilities

**Estimated Remediation Effort:**
- Critical issues: 4-6 hours
- High priority: 1-2 weeks
- Medium priority: 2-3 weeks
- All recommendations: 1-2 months

The codebase is production-ready with critical fixes applied. Recommend addressing security and resource management issues before scaling usage.

