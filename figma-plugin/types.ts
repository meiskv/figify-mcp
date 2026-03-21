/**
 * AUTO-GENERATED: Type definitions for Figma plugin
 * Generated from: src/types/layers.ts and src/types/index.ts
 * Do not edit manually - regenerate with: npm run generate:types
 */

// =============================================================================
// Layer Type Definitions (from src/types/layers.ts)
// =============================================================================

// Layer types for DOM-to-Figma extraction

type LayerType = "FRAME" | "TEXT" | "RECTANGLE";

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaFill {
  type: "SOLID";
  color: FigmaColor;
  opacity?: number;
}

interface FigmaStroke {
  type: "SOLID";
  color: FigmaColor;
}

interface FigmaDropShadow {
  type: "DROP_SHADOW";
  color: FigmaColor;
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
  visible: boolean;
  blendMode: "NORMAL";
}

type FigmaEffect = FigmaDropShadow;

interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameLayer extends BaseLayer {
  type: "FRAME";
  children: Layer[];
  fills?: FigmaFill[];
  cornerRadius?: number;
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  effects?: FigmaEffect[];
  // Auto Layout properties
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  // Child sizing (for when this frame is inside an auto layout parent)
  layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
  layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
}

interface TextLayer extends BaseLayer {
  type: "TEXT";
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textColor: FigmaColor;
  textAlign?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  lineHeight?: number;
}

interface RectangleLayer extends BaseLayer {
  type: "RECTANGLE";
  fills?: FigmaFill[];
  cornerRadius?: number;
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  effects?: FigmaEffect[];
}

type Layer = FrameLayer | TextLayer | RectangleLayer;

interface FigmaLayerTree {
  name: string;
  viewport: string;
  width: number;
  height: number;
  rootLayer: FrameLayer;
  screenshotFallback?: string; // Base64 PNG backup
}

interface LayersCreatedPayload {
  frameId: string;
  success: boolean;
  layersCreated: number;
  error?: string;
}

interface CreateLayersPayload {
  name: string;
  layers: FigmaLayerTree[];
}

// =============================================================================
// MCP Message Type Definitions (from src/types/index.ts)
// =============================================================================

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}
interface Screenshot {
  viewport: string;
  width: number;
  height: number;
  data: string; // base64 encoded
}
interface ImportPageResult {
  success: boolean;
  screenshots: Screenshot[];
  figmaFrameId?: string;
  error?: string;
}
interface FigmaMessage {
  id: string;
  type: string;
  payload: unknown;
}
interface FigmaCreateFramePayload {
  name: string;
  screenshots: Screenshot[];
}
interface FigmaFrameCreatedPayload {
  frameId: string;
  success: boolean;
  error?: string;
}
interface DevServerInfo {
  url: string;
  port: number;
  isExternal: boolean;
}
type ViewportType = "desktop" | "mobile";

// Re-export layer types
type {
  BaseLayer,
  CreateLayersPayload,
  FigmaColor,
  FigmaFill,
  FigmaLayerTree,
  FrameLayer,
  Layer,
  LayersCreatedPayload,
  LayerType,
  RectangleLayer,
  TextLayer,
} from "./layers.js";
