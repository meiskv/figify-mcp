// Layer types for DOM-to-Figma extraction
import type { ViewportType } from "./index.js";

export type LayerType = "FRAME" | "TEXT" | "RECTANGLE";

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  /** Alpha channel (0–1). Always present; use 1 as the default. */
  a: number;
}

export interface FigmaFill {
  type: "SOLID";
  color: FigmaColor;
  opacity?: number;
}

export interface FigmaStroke {
  type: "SOLID";
  color: FigmaColor;
}

export interface FigmaDropShadow {
  type: "DROP_SHADOW";
  color: FigmaColor;
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
  visible: boolean;
  blendMode: "NORMAL";
}

export type FigmaEffect = FigmaDropShadow;

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameLayer extends BaseLayer {
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

export interface TextLayer extends BaseLayer {
  type: "TEXT";
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textColor: FigmaColor;
  textAlign?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
}

/**
 * RectangleLayer is defined for completeness but currently not produced
 * by the DOM extractor. All containers are represented as FrameLayers.
 */
export interface RectangleLayer extends BaseLayer {
  type: "RECTANGLE";
  fills?: FigmaFill[];
  cornerRadius?: number;
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  effects?: FigmaEffect[];
}

export type Layer = FrameLayer | TextLayer | RectangleLayer;

export interface FigmaLayerTree {
  name: string;
  viewport: ViewportType;
  width: number;
  height: number;
  rootLayer: FrameLayer;
  screenshotFallback?: string; // Base64 PNG backup
}

export interface LayersCreatedPayload {
  frameId: string;
  success: boolean;
  layersCreated: number;
  error?: string;
}

export interface CreateLayersPayload {
  name: string;
  layers: FigmaLayerTree[];
}

/** Summary info for a single top-level frame returned by list_frames. */
export interface FigmaFrameInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  type: string;
}

export interface FramesListedPayload {
  frames: FigmaFrameInfo[];
  pageId: string;
  pageName: string;
  success: boolean;
  error?: string;
}
