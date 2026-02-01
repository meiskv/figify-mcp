export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface Screenshot {
  viewport: string;
  width: number;
  height: number;
  data: string; // base64 encoded
}

export interface ImportPageResult {
  success: boolean;
  screenshots: Screenshot[];
  figmaFrameId?: string;
  error?: string;
}

export interface FigmaMessage {
  id: string;
  type: string;
  payload: unknown;
}

export interface FigmaCreateFramePayload {
  name: string;
  screenshots: Screenshot[];
}

export interface FigmaFrameCreatedPayload {
  frameId: string;
  success: boolean;
  error?: string;
}

export interface DevServerInfo {
  url: string;
  port: number;
  process?: unknown;
  isExternal: boolean;
}

export type ViewportType = "desktop" | "mobile";
