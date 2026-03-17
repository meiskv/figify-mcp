import type { ViewportConfig, ViewportType } from "../types/index.js";
import {
  DESKTOP_VIEWPORT_HEIGHT,
  DESKTOP_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
  MOBILE_VIEWPORT_WIDTH,
} from "./constants.js";

/**
 * Viewport configurations for different device types.
 * Used by the screenshot service to capture pages at different resolutions.
 * Dimensions are configurable via environment variables (see src/config/constants.ts).
 */
export const VIEWPORTS: Record<ViewportType, ViewportConfig> = {
  desktop: {
    name: "Desktop",
    width: DESKTOP_VIEWPORT_WIDTH,
    height: DESKTOP_VIEWPORT_HEIGHT,
  },
  mobile: {
    name: "Mobile",
    width: MOBILE_VIEWPORT_WIDTH,
    height: MOBILE_VIEWPORT_HEIGHT,
  },
};

export function getViewport(type: ViewportType): ViewportConfig {
  return VIEWPORTS[type];
}

export function getAllViewports(): ViewportConfig[] {
  return Object.values(VIEWPORTS);
}
