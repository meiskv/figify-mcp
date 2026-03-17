/**
 * Central configuration for all hardcoded values.
 * All values can be overridden via environment variables.
 */

// ──────────────────────────────────────────────────────────────────
// WebSocket & Communication
// ──────────────────────────────────────────────────────────────────

/** Port that the Figma plugin WebSocket server listens on */
export const WEBSOCKET_PORT = Number.parseInt(process.env.WEBSOCKET_PORT ?? "19407", 10);

/** Maximum time to wait for Figma plugin response (milliseconds) */
export const FIGMA_REQUEST_TIMEOUT = Number.parseInt(
  process.env.FIGMA_REQUEST_TIMEOUT ?? "30000",
  10,
);

/** Maximum number of pending Figma requests before rejecting new ones */
export const MAX_PENDING_REQUESTS = Number.parseInt(process.env.MAX_PENDING_REQUESTS ?? "100", 10);

// ──────────────────────────────────────────────────────────────────
// Browser & Page Capture
// ──────────────────────────────────────────────────────────────────

/** Maximum time to wait for page to load (milliseconds) */
export const PAGE_LOAD_TIMEOUT = Number.parseInt(process.env.PAGE_LOAD_TIMEOUT ?? "30000", 10);

/** Maximum time to wait for network idle state (milliseconds) */
export const NETWORK_IDLE_TIMEOUT = Number.parseInt(process.env.NETWORK_IDLE_TIMEOUT ?? "5000", 10);

/** Delay after page load before taking screenshot (milliseconds) */
export const ANIMATION_SETTLE_DELAY = Number.parseInt(
  process.env.ANIMATION_SETTLE_DELAY ?? "500",
  10,
);

/** Browser device scale factor (DPI multiplier) */
export const DEVICE_SCALE_FACTOR = Number.parseInt(process.env.DEVICE_SCALE_FACTOR ?? "2", 10);

// ──────────────────────────────────────────────────────────────────
// Dev Server Management
// ──────────────────────────────────────────────────────────────────

/** Default port for Next.js development server */
export const DEV_SERVER_PORT = Number.parseInt(process.env.DEV_SERVER_PORT ?? "3000", 10);

/** Maximum time to wait for dev server to start (milliseconds) */
export const DEV_SERVER_STARTUP_TIMEOUT = Number.parseInt(
  process.env.DEV_SERVER_STARTUP_TIMEOUT ?? "60000",
  10,
);

/** Interval between dev server readiness checks (milliseconds) */
export const DEV_SERVER_POLL_INTERVAL = Number.parseInt(
  process.env.DEV_SERVER_POLL_INTERVAL ?? "1000",
  10,
);

/** Delay after "Ready" message before checking port (milliseconds) */
export const DEV_SERVER_READY_SETTLE_DELAY = Number.parseInt(
  process.env.DEV_SERVER_READY_SETTLE_DELAY ?? "100",
  10,
);

/** Time to wait for external server check before timeout (milliseconds) */
export const EXTERNAL_SERVER_TIMEOUT = Number.parseInt(
  process.env.EXTERNAL_SERVER_TIMEOUT ?? "2000",
  10,
);

// ──────────────────────────────────────────────────────────────────
// Viewport Dimensions
// ──────────────────────────────────────────────────────────────────

/** Desktop viewport width (pixels) */
export const DESKTOP_VIEWPORT_WIDTH = Number.parseInt(
  process.env.DESKTOP_VIEWPORT_WIDTH ?? "1440",
  10,
);

/** Desktop viewport height (pixels) */
export const DESKTOP_VIEWPORT_HEIGHT = Number.parseInt(
  process.env.DESKTOP_VIEWPORT_HEIGHT ?? "900",
  10,
);

/** Mobile viewport width (pixels) */
export const MOBILE_VIEWPORT_WIDTH = Number.parseInt(
  process.env.MOBILE_VIEWPORT_WIDTH ?? "375",
  10,
);

/** Mobile viewport height (pixels) */
export const MOBILE_VIEWPORT_HEIGHT = Number.parseInt(
  process.env.MOBILE_VIEWPORT_HEIGHT ?? "812",
  10,
);

// ──────────────────────────────────────────────────────────────────
// UI & Logging
// ──────────────────────────────────────────────────────────────────

/** Maximum number of log entries to keep in Figma plugin UI */
export const MAX_UI_LOG_ENTRIES = Number.parseInt(process.env.MAX_UI_LOG_ENTRIES ?? "100", 10);

/** Auto-reconnect attempts for WebSocket before giving up */
export const WEBSOCKET_MAX_RECONNECT_ATTEMPTS = Number.parseInt(
  process.env.WEBSOCKET_MAX_RECONNECT_ATTEMPTS ?? "5",
  10,
);

/** Delay between WebSocket reconnection attempts (milliseconds) */
export const WEBSOCKET_RECONNECT_DELAY = Number.parseInt(
  process.env.WEBSOCKET_RECONNECT_DELAY ?? "2000",
  10,
);

// ──────────────────────────────────────────────────────────────────
// Validation & Constraints
// ──────────────────────────────────────────────────────────────────

/** Maximum allowed border radius value (caps Tailwind's rounded-full) */
export const MAX_BORDER_RADIUS = Number.parseInt(process.env.MAX_BORDER_RADIUS ?? "1000", 10);

/** Maximum depth for DOM recursion during extraction */
export const MAX_DOM_EXTRACTION_DEPTH = Number.parseInt(
  process.env.MAX_DOM_EXTRACTION_DEPTH ?? "999",
  10,
);

/** Export a frozen config object for easy inspection */
export const CONFIG = {
  WEBSOCKET_PORT,
  FIGMA_REQUEST_TIMEOUT,
  MAX_PENDING_REQUESTS,
  PAGE_LOAD_TIMEOUT,
  NETWORK_IDLE_TIMEOUT,
  ANIMATION_SETTLE_DELAY,
  DEVICE_SCALE_FACTOR,
  DEV_SERVER_PORT,
  DEV_SERVER_STARTUP_TIMEOUT,
  DEV_SERVER_POLL_INTERVAL,
  DEV_SERVER_READY_SETTLE_DELAY,
  EXTERNAL_SERVER_TIMEOUT,
  DESKTOP_VIEWPORT_WIDTH,
  DESKTOP_VIEWPORT_HEIGHT,
  MOBILE_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
  MAX_UI_LOG_ENTRIES,
  WEBSOCKET_MAX_RECONNECT_ATTEMPTS,
  WEBSOCKET_RECONNECT_DELAY,
  MAX_BORDER_RADIUS,
  MAX_DOM_EXTRACTION_DEPTH,
} as const;
