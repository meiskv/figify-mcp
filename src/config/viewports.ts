import type { ViewportConfig, ViewportType } from "../types/index.js";

export const VIEWPORTS: Record<ViewportType, ViewportConfig> = {
  desktop: {
    name: "Desktop",
    width: 1440,
    height: 900,
  },
  mobile: {
    name: "Mobile",
    width: 375,
    height: 812,
  },
};

export function getViewport(type: ViewportType): ViewportConfig {
  return VIEWPORTS[type];
}

export function getAllViewports(): ViewportConfig[] {
  return Object.values(VIEWPORTS);
}
