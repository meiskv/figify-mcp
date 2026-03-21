# Quick Start Refactoring Guide

This document provides ready-to-use code snippets for the highest-impact refactoring opportunities.

---

## 1. Message Builders (Highest Impact - 15+ lines of duplication)

**Create**: `src/utils/messages.ts`

```typescript
import type { ToolResult } from "../tools/index.js";

/**
 * Creates a text content array for MCP tool results
 */
export function createTextContent(text: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}

/**
 * Creates an error tool result
 */
export function createErrorResult(error: unknown, operation?: string): ToolResult {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const context = operation ? ` [${operation}]` : "";
  return {
    content: createTextContent(`Error${context}: ${errorMessage}`),
    isError: true,
  };
}

/**
 * Creates a connection error result (common pattern)
 */
export function createConnectionErrorResult(): ToolResult {
  return createErrorResult(
    new Error("Figma plugin is not connected. Please open Figma and run the figify-mcp plugin first."),
  );
}

/**
 * Creates a validation error result
 */
export function createValidationErrorResult(message: string): ToolResult {
  return createErrorResult(new Error(`Invalid input: ${message}`));
}

/**
 * Creates a success result with key-value details
 */
export function createSuccessResult(title: string, details: Record<string, string | number>): ToolResult {
  const lines = [title];
  for (const [key, value] of Object.entries(details)) {
    lines.push(`${key}: ${value}`);
  }
  return {
    content: createTextContent(lines.join("\n")),
  };
}

/**
 * Creates a simple success message
 */
export function createSimpleSuccess(message: string): ToolResult {
  return {
    content: createTextContent(message),
  };
}
```

**Usage in `/src/tools/index.ts`**:

Replace lines 62-74 with:
```typescript
// Remove the old createErrorResult function entirely
// Import the new one: import { createErrorResult, createConnectionErrorResult, ... } from "../utils/messages.js";

// In handleImportPage (replace lines 101-107):
const parsed = ImportPageInputSchema.safeParse(input);
if (!parsed.success) {
  return createValidationErrorResult(parsed.error.message);
}

// In handleImportPage (replace lines 112-113):
const connError = requireFigmaConnection(context);
if (connError) return connError;

// In handleImportPage (replace lines 137-144):
return createSuccessResult(`Successfully imported "${pageName}" to Figma!`, {
  "Frame ID": result.frameId,
  "Viewports": viewports.join(", "),
  "Screenshots": screenshots.length,
});

// In handleImportPageAsLayers (replace lines 195-200):
return createSuccessResult(`Successfully imported "${pageName}" as editable layers to Figma!`, {
  "Frame ID": result.frameId,
  "Viewports": viewports.join(", "),
  "Layers created": result.layersCreated,
});

// In handleCaptureScreenshot (replace lines 242-248):
return {
  content: createTextContent(
    `Captured ${screenshots.length} screenshot(s):\n${screenshots.map((s) => `- ${s.viewport}: ${s.width}x${s.height}`).join("\n")}`
  ),
};
```

---

## 2. Input Validation Utility (12 lines of duplication × 4)

**Create**: `src/utils/validation.ts`

```typescript
import type { z } from "zod";
import type { ToolResult } from "../tools/index.js";
import { createValidationErrorResult } from "./messages.js";

/**
 * Validates input against a Zod schema
 * Returns either the parsed data or an error ToolResult
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; result: ToolResult } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      result: createValidationErrorResult(parsed.error.message),
    };
  }
  return { success: true, data: parsed.data };
}
```

**Usage in `/src/tools/index.ts`**:

Replace in `handleImportPage()` (lines 101-107):
```typescript
import { validateInput } from "../utils/validation.js";

// Old code:
// const parsed = ImportPageInputSchema.safeParse(input);
// if (!parsed.success) {
//   return { content: [{ type: "text", text: `Invalid input: ${parsed.error.message}` }], isError: true };
// }
// const { source, viewports, projectPath } = parsed.data;

// New code:
const validation = validateInput(ImportPageInputSchema, input);
if (!validation.success) return validation.result;
const { source, viewports, projectPath } = validation.data;
```

Apply the same pattern to lines 154-162, 225-231, and 259-265.

---

## 3. Batch Screenshot Capture (9 lines of duplication × 3)

**Create**: `src/utils/screenshot-batch.ts`

```typescript
import type { Screenshot, ViewportType } from "../types/index.js";
import type { ScreenshotService } from "../services/screenshot-service.js";

/**
 * Captures screenshots for multiple viewports
 */
export async function captureScreenshots(
  url: string,
  viewports: ViewportType[],
  screenshotService: ScreenshotService,
): Promise<Screenshot[]> {
  const screenshots: Screenshot[] = [];
  for (const viewport of viewports as ViewportType[]) {
    const screenshot = await screenshotService.capture(url, viewport);
    screenshots.push(screenshot);
  }
  return screenshots;
}

/**
 * Captures layer trees for multiple viewports
 */
export async function captureWithLayers(
  url: string,
  viewports: ViewportType[],
  screenshotService: ScreenshotService,
  pageName: string,
) {
  const results: Array<{ layerTree: any; screenshot: Screenshot }> = [];
  for (const viewport of viewports as ViewportType[]) {
    const result = await screenshotService.captureWithLayers(url, viewport, pageName);
    results.push(result);
  }
  return results;
}
```

**Usage in `/src/tools/index.ts`**:

Replace in `handleImportPage()` (lines 119-125):
```typescript
import { captureScreenshots } from "../utils/screenshot-batch.js";

// Old code removed, replace with:
const screenshots = await captureScreenshots(url, viewports, context.screenshotService);
```

Replace in `handleImportPageAsLayers()` (lines 173-182):
```typescript
import { captureWithLayers } from "../utils/screenshot-batch.js";

// Old code removed, replace with:
const results = await captureWithLayers(url, viewports, context.screenshotService, pageName);
const layerTrees = results.map(r => r.layerTree);
```

Replace in `handleCaptureScreenshot()` (lines 237-240):
```typescript
const screenshots = await captureScreenshots(url, viewports, context.screenshotService);
```

---

## 4. Layer Tree Traversal Utility (Advanced)

**Create**: `src/utils/layer-tree.ts`

```typescript
import type { FrameLayer, Layer } from "../types/index.js";

/**
 * Generic visitor function for processing layers
 */
export type LayerVisitor<T> = (layer: Layer, depth: number) => T;

/**
 * Recursively traverse a layer tree with a visitor function
 * Returns array of visitor results
 */
export function traverseLayerTree<T>(
  layer: Layer,
  visitor: LayerVisitor<T>,
  depth: number = 0,
  maxDepth: number = Infinity,
): T[] {
  if (depth > maxDepth) return [];

  const result = [visitor(layer, depth)];

  if (layer.type === "FRAME" && "children" in layer) {
    const frameLayer = layer as FrameLayer;
    for (const child of frameLayer.children) {
      result.push(...traverseLayerTree(child, visitor, depth + 1, maxDepth));
    }
  }

  return result;
}

/**
 * Count all layers in a tree (including root)
 */
export function countLayers(layer: Layer): number {
  const counts = traverseLayerTree(layer, () => 1);
  return counts.length;
}

/**
 * Get all layers at a specific depth
 */
export function getLayersAtDepth(layer: Layer, targetDepth: number): Layer[] {
  const layers: Layer[] = [];
  traverseLayerTree(layer, (l, depth) => {
    if (depth === targetDepth) layers.push(l);
    return null;
  });
  return layers;
}
```

**Usage in `/src/services/dom-extractor.ts`**:

Replace `countLayers()` function (lines 436-439) with an import:
```typescript
import { countLayers } from "../utils/layer-tree.js";

// Remove the function, it's now imported
```

Then in the `extract()` method (line 393), use:
```typescript
const total = countLayers(rootLayer);
```

For `debugLogLayers`, refactor to use the visitor pattern:
```typescript
import { traverseLayerTree } from "../utils/layer-tree.js";

function logLayerDebugInfo(layer: Layer, depth: number): void {
  // Move the logging logic from debugLogLayers here
  const indent = "  ".repeat(depth);
  const frame = layer.type === "FRAME" ? (layer as FrameLayer) : null;
  console.error(
    `${indent}[Layer] ${layer.name} (${layer.type}) - fills: ${frame?.fills?.length ?? 0}, ...`
  );
  // ... rest of logging ...
}

// In extract() method:
traverseLayerTree(rootLayer, logLayerDebugInfo, 0, 3);
```

---

## 5. Unified Logging Adoption (20+ console.error calls)

**Modify**: Replace `console.error()` with `logger.error()` in service files

**In `/src/services/screenshot-service.ts`**:

```typescript
// Add import at top:
import { logger } from "../logger.js";

// Replace line 19:
// Before: console.error("[ScreenshotService] Launching browser");
// After:
logger.info("Launching browser");

// Replace line 28:
logger.info("Closing browser");

// Replace lines 36-38:
logger.info(
  `Capturing ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`
);

// Replace line 65:
logger.warn("Network idle timeout - continuing anyway");

// Replace lines 134-136:
logger.info(
  `Capturing with layers ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`
);
```

**In `/src/services/figma-bridge.ts`**:

```typescript
// Add import:
import { logger } from "../logger.js";

// Replace all console.error calls:
// Line 40: logger.error("Replacing existing Figma plugin connection");
// Line 44: logger.info("Figma plugin connected");
// Line 52: logger.info("Figma plugin disconnected");
// Line 59: logger.error("WebSocket error", error);
// Line 64: logger.info(`WebSocket server listening on port ${CONFIG.websocket.PORT}`);
// Line 69: logger.error("Server error", error);
// Line 212: logger.error("Failed to parse message", error);
```

**Benefits**:
- Consistent formatting with timestamps and colors
- Easier to redirect logs or add log levels
- Better error context propagation

---

## 6. Color Formatting Utilities (Optional but Nice-to-Have)

**Create**: `src/utils/color-format.ts`

```typescript
import type { FigmaColor } from "../types/index.js";

/**
 * Format a color to RGB string (e.g., "rgb(255, 0, 128)")
 */
export function colorToRgb(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Format a color to RGBA string (e.g., "rgba(255, 0, 128, 0.5)")
 */
export function colorToRgba(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? color.a : 1;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Format a color to hex string (e.g., "#FF0080")
 */
export function colorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, "0");
  const g = Math.round(color.g * 255).toString(16).padStart(2, "0");
  const b = Math.round(color.b * 255).toString(16).padStart(2, "0");
  const hex = `${r}${g}${b}`.toUpperCase();

  if (color.a !== undefined && color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, "0");
    return `#${hex}${a.toUpperCase()}`;
  }
  return `#${hex}`;
}

/**
 * Format a color for display in debug output
 */
export function colorDebugString(color: FigmaColor): string {
  return `r=${color.r?.toFixed(2)}, g=${color.g?.toFixed(2)}, b=${color.b?.toFixed(2)}, a=${(color.a ?? 1).toFixed(2)}`;
}
```

**Usage in `/src/tools/index.ts`**:

In `summarizeLayers()`, replace line 325:
```typescript
import { colorToRgb, colorToRgba } from "../utils/color-format.js";

// Old:
// line += ` - text: "${layer.characters?.slice(0, 20)}..." color: rgb(${(tc?.r * 255).toFixed(0)}, ${(tc?.g * 255).toFixed(0)}, ${(tc?.b * 255).toFixed(0)})`;

// New:
if (tc) {
  line += ` - text: "${layer.characters?.slice(0, 20)}..." color: ${colorToRgb(tc)}`;
}

// Line 330:
// Old: `[fill: rgba(${(c.r * 255).toFixed(0)}, ${(c.g * 255).toFixed(0)}, ${(c.b * 255).toFixed(0)}, ${c.a?.toFixed(2) ?? 1})]`
// New:
line += ` [fill: ${colorToRgba(c)}]`;
```

---

## Implementation Checklist

### Phase 1 (Day 1 - 1-2 hours)
- [ ] Create `src/utils/messages.ts`
- [ ] Create `src/utils/validation.ts`
- [ ] Create `src/utils/screenshot-batch.ts`
- [ ] Update `src/tools/index.ts` to use new utilities
- [ ] Run tests to verify functionality

### Phase 2 (Day 2 - 2-3 hours)
- [ ] Replace all `console.error()` with `logger.error()` in services
- [ ] Create `src/utils/color-format.ts`
- [ ] Update color formatting in `src/tools/index.ts`
- [ ] Update debug logging in `src/services/dom-extractor.ts`
- [ ] Test logging output

### Phase 3 (Day 3+ - 4+ hours)
- [ ] Create `src/utils/layer-tree.ts`
- [ ] Refactor `debugLogLayers` in `src/services/dom-extractor.ts`
- [ ] Remove old `countLayers` function
- [ ] Consider WebSocket message handler consolidation in `figma-bridge.ts`
- [ ] Run full integration tests

---

## Testing Strategy

After each refactoring, run:

```bash
npm test
npm run build
```

Key test files to verify:
- `src/tools/tools.integration.test.ts` - Tool functionality
- `src/utils/color-parsing.test.ts` - Color utilities

---

## Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Duplicated lines (tools/index.ts) | 120 | 70 | -42% |
| Error handling patterns | 5 variations | 2 (message builders, createErrorResult) | Unified |
| Logging methods | 20+ console.error calls | Unified logger | Consistent |
| Viewport iteration | 3 duplicate loops | 1 shared utility | -66% |
| File count | 18 | 23 (5 new utilities) | +28% (but more modular) |
| Testability | Limited | Higher (utility functions) | Better |

