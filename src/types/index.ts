export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface Screenshot {
  viewport: ViewportType; // narrowed from string
  width: number;
  height: number;
  data: string; // base64 encoded PNG
}

export interface FigmaMessage {
  id: string;
  type: string;
  payload: unknown;
}

export interface FigmaFrameCreatedPayload {
  frameId: string;
  success: boolean;
  error?: string;
}

export interface DevServerInfo {
  url: string;
  port: number;
  isExternal: boolean;
}

export type ViewportType = "desktop" | "mobile";

// Re-export layer types
export type {
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
