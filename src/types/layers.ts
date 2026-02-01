// Layer types for DOM-to-Figma extraction

export type LayerType = "FRAME" | "TEXT" | "RECTANGLE";

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
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
}

export interface TextLayer extends BaseLayer {
  type: "TEXT";
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textColor: FigmaColor;
  textAlign?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  lineHeight?: number;
}

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
  viewport: string;
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
