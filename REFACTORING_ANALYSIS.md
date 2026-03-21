# Figify-MCP Codebase Analysis: Code Reuse & Utility Opportunities

## Executive Summary

This analysis identifies **8 high-value refactoring opportunities** to improve code organization, reduce duplication, and enhance maintainability. The codebase is well-structured but has several patterns that could be extracted into reusable utilities.

---

## 1. INPUT VALIDATION DUPLICATION

### Issue
Input validation using Zod's `safeParse()` is repeated in 4 tool handlers with identical error formatting.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:101-107` (handleImportPage)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:154-160` (handleImportPageAsLayers)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:225-231` (handleCaptureScreenshot)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:259-265` (handleDebugExtraction)

### Current Code Pattern
```typescript
const parsed = ImportPageInputSchema.safeParse(input);
if (!parsed.success) {
  return {
    content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }],
    isError: true,
  };
}
```

### Refactoring Opportunity
Extract a validation utility function:
```typescript
// In src/utils/validation.ts
export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { data: T } | ToolResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return createErrorResult(new Error(`Invalid input: ${parsed.error.message}`));
  }
  return { data: parsed.data };
}
```

**Impact**: Eliminates 4 repeated blocks (12 lines), centralizes validation logic.

---

## 2. ERROR RESULT FORMATTING - STANDARDIZED MESSAGE STRUCTURE

### Issue
Error messages and success messages are manually constructed throughout the file with inconsistent formatting.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:44-51` (connection error)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:64-73` (createErrorResult function)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:132-135` (frame creation error)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:189-191` (layers creation error)
- Multiple success message constructions (lines 137-144, 195-200, 242-248)

### Current Patterns
- Manual `isError: true` flag passed with content
- Inconsistent error context formatting
- Success messages manually formatted with `\n\n` separators

### Refactoring Opportunity
Create message builder utilities:
```typescript
// In src/utils/messages.ts
export function createTextContent(text: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}

export function createSuccessMessage(title: string, details: Record<string, string | number>): ToolResult {
  const lines = [title];
  for (const [key, value] of Object.entries(details)) {
    lines.push(`${key}: ${value}`);
  }
  return {
    content: createTextContent(lines.join("\n")),
  };
}

export function createFailureMessage(title: string, error: string): ToolResult {
  return {
    content: createTextContent(`${title}: ${error}`),
    isError: true,
  };
}
```

**Current Occurrences**:
- `{ type: "text", text: ... }` pattern appears **25+ times** across tools and handlers

**Impact**: Centralizes message formatting, ensures consistency, reduces redundancy.

---

## 3. VIEWPORT ITERATION PATTERN (SCREENSHOT CAPTURE DUPLICATION)

### Issue
Viewport iteration and screenshot capture is duplicated in 3 functions with nearly identical logic.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:119-125` (handleImportPage)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:173-182` (handleImportPageAsLayers)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:237-240` (handleCaptureScreenshot)

### Current Code
```typescript
// Pattern repeated 3 times:
const screenshots: Screenshot[] = [];
for (const viewport of viewports as ViewportType[]) {
  const screenshot = await context.screenshotService.capture(url, viewport);
  screenshots.push(screenshot);
}
```

### Refactoring Opportunity
Create a utility to handle batch screenshot capture:
```typescript
// In src/utils/screenshot-batch.ts
export async function captureViewports(
  url: string,
  viewports: ViewportType[],
  screenshotService: ScreenshotService,
): Promise<Screenshot[]> {
  const screenshots: Screenshot[] = [];
  for (const viewport of viewports) {
    const screenshot = await screenshotService.capture(url, viewport);
    screenshots.push(screenshot);
  }
  return screenshots;
}
```

**Impact**: Reduces code duplication (9 lines × 3 functions), ensures consistent viewport handling.

---

## 4. CONNECTION CHECK & ERROR HANDLING PATTERN

### Issue
Figma connection validation is performed identically in multiple handlers.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:41-54` (requireFigmaConnection function)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:112-113` (handleImportPage)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:165-166` (handleImportPageAsLayers)
- Used in both places with identical pattern

### Current Code
```typescript
const connError = requireFigmaConnection(context);
if (connError) return connError;
```

**Status**: Already partially extracted via `requireFigmaConnection()` - GOOD PATTERN. Can be leveraged further for other pre-condition checks.

### Enhancement Opportunity
Extend this pattern to create a general pre-condition check utility:
```typescript
// In src/utils/preconditions.ts
export function requireConnection(context: ToolContext): ToolResult | null {
  return requireFigmaConnection(context);
}

export async function withPreconditions<T>(
  checks: Array<() => ToolResult | null>,
  handler: () => Promise<T>,
): Promise<T | ToolResult> {
  for (const check of checks) {
    const error = check();
    if (error) return error;
  }
  return handler();
}
```

**Impact**: Centralizes guard clause logic, enables composition of multiple preconditions.

---

## 5. LOGGING PATTERNS - MIXED CONSOLE VS LOGGER

### Issue
Logging is inconsistent across the codebase:
- Some files use `console.error()` directly
- `logger.ts` exists but has limited adoption
- No structured logging for errors with context

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/index.ts:10,58,72,76` (uses console.error)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/screenshot-service.ts:19,28,36-38,65` (console.error)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/dev-server-manager.ts:127,169,179,199` (console.error)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/figma-bridge.ts:40,44,52,59,64,69` (console.error)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/logger.ts:13-33` (logger module defined)

### Current Logger
```typescript
// src/logger.ts - defined but underutilized
export const logger = {
  info(message: string): void
  warn(message: string, error?: unknown): void
  error(message: string, error?: unknown): void
  success(message: string): void
}
```

### Refactoring Opportunity
1. Replace all `console.error()` with `logger.error()` for consistency
2. Create context-aware logging for services:
```typescript
// In src/logger.ts or src/utils/logging.ts
export function createServiceLogger(serviceName: string) {
  return {
    info: (msg: string) => logger.info(`[${serviceName}] ${msg}`),
    error: (msg: string, err?: unknown) => logger.error(`[${serviceName}] ${msg}`, err),
    warn: (msg: string, err?: unknown) => logger.warn(`[${serviceName}] ${msg}`, err),
    debug: (msg: string) => logger.info(`[${serviceName}] DEBUG: ${msg}`),
  };
}
```

**Current Instances**: 20+ direct `console.error()` calls that should use logger

**Impact**: Unified logging, easier to redirect logs, better context tracking.

---

## 6. WEBSOCKET MESSAGE HANDLING - DUPLICATION IN PENDING REQUEST CLEANUP

### Issue
In `FigmaBridge.createFrame()` and `FigmaBridge.createLayers()`, there are duplicate patterns for setting up promises, timeouts, and error handling.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/figma-bridge.ts:110-142` (createFrame)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/figma-bridge.ts:144-180` (createLayers)

### Current Code Pattern (repeated twice)
```typescript
return new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    this.pendingRequests.delete(id);
    reject(new Error("Request timed out..."));
  }, CONFIG.websocket.REQUEST_TIMEOUT);

  this.pendingRequests.set(id, { kind: "...", resolve, reject, timer });

  try {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      throw new Error("Figma plugin disconnected...");
    }
    this.client.send(JSON.stringify(message));
  } catch (error) {
    clearTimeout(timer);
    this.pendingRequests.delete(id);
    reject(error instanceof Error ? error : new Error(String(error)));
  }
});
```

### Refactoring Opportunity
Extract a generic message request handler:
```typescript
// In FigmaBridge or a utility
private async sendMessage<T extends PendingResolve>(
  message: FigmaMessage,
  pendingRequest: T,
): Promise<T["resolve"] extends (v: infer R) => void ? R : never> {
  return new Promise((resolve, reject) => {
    const timer = this.setupTimeout(message.id, reject);
    this.pendingRequests.set(message.id, { ...pendingRequest, timer });

    try {
      this.validateAndSendMessage(message);
      // Type ensures correct resolve path
    } catch (error) {
      this.cleanupPendingRequest(message.id, timer, error);
    }
  });
}
```

**Impact**: Eliminates 40 lines of duplicated error handling logic.

---

## 7. LAYER SUMMARIZATION & COLOR FORMATTING

### Issue
Color formatting to RGB string appears in multiple places with slightly different implementations.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:325` (color formatting in summarizeLayers)
  ```typescript
  `rgb(${(tc?.r * 255).toFixed(0)}, ${(tc?.g * 255).toFixed(0)}, ${(tc?.b * 255).toFixed(0)})`
  ```
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:330` (fill color formatting)
  ```typescript
  `rgba(${(c.r * 255).toFixed(0)}, ${(c.g * 255).toFixed(0)}, ${(c.b * 255).toFixed(0)}, ${c.a?.toFixed(2) ?? 1})`
  ```
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/dom-extractor.ts:417` (debug logging)
  ```typescript
  `r=${t.textColor?.r?.toFixed(2)}, g=${t.textColor?.g?.toFixed(2)}, b=${t.textColor?.b?.toFixed(2)}`
  ```

### Refactoring Opportunity
Create color formatting utilities in `/Users/SXOF/Desktop/dev/figify-mcp/src/utils/color-parsing.ts`:
```typescript
export function colorToRgbString(color: FigmaColor): string {
  return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
}

export function colorToRgbaString(color: FigmaColor): string {
  const a = color.a ?? 1;
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${a.toFixed(2)})`;
}

export function colorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  const a = color.a !== undefined && color.a < 1 ? Math.round(color.a * 255).toString(16).padStart(2, '0') : '';
  return `#${r}${g}${b}${a}`.toUpperCase();
}
```

**Note**: `src/utils/color-parsing.ts` (171 lines) already exists and contains similar logic but is focused on parsing CSS colors, not formatting Figma colors for output.

**Impact**: Centralizes color formatting, ensures consistency across debug output and logging.

---

## 8. LAYER TREE TRAVERSAL PATTERN

### Issue
Recursive layer tree traversal with similar logic appears in multiple locations.

### Locations
- `/Users/SXOF/Desktop/dev/figify-mcp/src/tools/index.ts:313-343` (summarizeLayers function)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/dom-extractor.ts:404-434` (debugLogLayers function)
- `/Users/SXOF/Desktop/dev/figify-mcp/src/services/dom-extractor.ts:436-439` (countLayers function)

### Current Patterns
```typescript
// Pattern 1: Summarization
function summarizeLayers(layer: DebugLayer, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return "";
  // ... process layer ...
  if (layer.children) {
    for (const child of layer.children) {
      result += summarizeLayers(child, depth + 1, maxDepth);
    }
  }
  return result;
}

// Pattern 2: Debug logging
function debugLogLayers(layer: Layer, depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;
  // ... log layer ...
  if (frame) {
    for (const child of frame.children) {
      debugLogLayers(child, depth + 1, maxDepth);
    }
  }
}

// Pattern 3: Counting
function countLayers(layer: Layer): number {
  if (layer.type !== "FRAME") return 1;
  return 1 + (layer as FrameLayer).children.reduce((sum, c) => sum + countLayers(c), 0);
}
```

### Refactoring Opportunity
Create a generic tree traversal utility:
```typescript
// In src/utils/layer-tree.ts
export type LayerVisitor<T> = (layer: Layer, depth: number) => T;

export function traverseLayerTree<T>(
  layer: Layer,
  visitor: LayerVisitor<T>,
  depth: number = 0,
  maxDepth: number = Infinity,
): T[] {
  if (depth > maxDepth) return [];

  const result = [visitor(layer, depth)];

  if (layer.type === "FRAME" && "children" in layer) {
    const children = (layer as FrameLayer).children;
    for (const child of children) {
      result.push(...traverseLayerTree(child, visitor, depth + 1, maxDepth));
    }
  }

  return result;
}

// Usage examples:
const summary = traverseLayerTree(rootLayer, (layer, depth) => summarizeLayer(layer, depth));
const count = traverseLayerTree(rootLayer, () => 1).length;
```

**Impact**: Eliminates 3 similar recursive functions, enables reusable tree operations.

---

## Summary Table: Refactoring Opportunities

| Priority | Category | Opportunity | Files Affected | Lines Saved | Complexity |
|----------|----------|-------------|-----------------|-------------|-----------|
| High | Validation | Extract `validateInput()` utility | tools/index.ts | 12 | Low |
| High | Messages | Create message builders | tools/index.ts | 15-20 | Low |
| High | Screenshots | Batch viewport capture utility | tools/index.ts (3×) | 27 | Low |
| High | Logging | Unified logger adoption | 5 services | 20+ calls | Medium |
| Medium | WebSocket | Generic message request handler | figma-bridge.ts | 40 | High |
| Medium | Colors | Format color output utilities | tools, dom-extractor | 8-10 | Low |
| Medium | Trees | Generic layer tree traversal | tools, dom-extractor | 30-40 | Medium |
| Low | Guards | Compose precondition checks | tools/index.ts | 5-10 | Low |

---

## Implementation Priority Recommendation

### Phase 1 (Quick Wins - 1-2 hours)
1. **Message builders** - Highest impact for readability and consistency
2. **Input validation utility** - Eliminates duplicated error handling
3. **Viewport batch capture** - Clear duplication pattern

### Phase 2 (Medium Effort - 2-4 hours)
1. **Unified logging** - Replace all `console.error()` with logger
2. **Color formatting utilities** - Extend existing color-parsing module
3. **Layer tree traversal** - Generic tree visitor pattern

### Phase 3 (Advanced - 4+ hours)
1. **WebSocket message handler consolidation** - Requires careful type management
2. **Precondition composition** - Can wait until more complex checks needed

---

## Notes for Implementation

1. **Logging**: The logger module at `/Users/SXOF/Desktop/dev/figify-mcp/src/logger.ts` is well-designed but underused. Focus on adoption rather than redesign.

2. **Message Types**: The MCP SDK defines a specific format for tool results. Ensure any message builder respects `{ type: "text"; text: string }[]` format.

3. **Type Safety**: The codebase uses TypeScript effectively. Extracting utilities should maintain type safety, especially for generic tree traversal and message builders.

4. **Testing**: Several duplicated patterns are already in tests (`tools.integration.test.ts`). After refactoring, update tests to use new utilities.

5. **Color Parsing**: The existing `src/utils/color-parsing.ts` is focused on input (CSS → Figma color). New utilities should handle output (Figma color → string format).

---

## Files to Create/Modify

**New Files**:
- `src/utils/messages.ts` - Message builders
- `src/utils/validation.ts` - Input validation
- `src/utils/screenshot-batch.ts` - Batch screenshot capture
- `src/utils/layer-tree.ts` - Generic tree traversal
- `src/utils/color-format.ts` - Color output formatting

**Modified Files**:
- `src/tools/index.ts` - Use new utilities
- `src/services/figma-bridge.ts` - Consolidate message handling
- `src/services/screenshot-service.ts` - Use batch capture utility
- `src/services/dom-extractor.ts` - Use tree traversal utility
- `src/logger.ts` - Possibly add service logger factory (optional)
- All service files - Migrate to unified logger
