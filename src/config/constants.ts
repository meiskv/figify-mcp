/**
 * Central configuration for all hardcoded values.
 * All values can be overridden via environment variables.
 * Invalid (non-numeric) env var values throw at startup rather than silently
 * producing NaN that would break downstream logic.
 */

function requireInt(envKey: string, defaultValue: number): number {
  const raw = process.env[envKey];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Invalid configuration: ${envKey}="${raw}" is not a valid integer. Expected a number.`,
    );
  }
  return parsed;
}

// ──────────────────────────────────────────────────────────────────
// WebSocket & Communication
// ──────────────────────────────────────────────────────────────────

/** Port that the Figma plugin WebSocket server listens on */
export const WEBSOCKET_PORT = requireInt("WEBSOCKET_PORT", 19407);

/** Maximum time to wait for Figma plugin response (milliseconds) */
export const FIGMA_REQUEST_TIMEOUT = requireInt("FIGMA_REQUEST_TIMEOUT", 30_000);

/** Maximum number of pending Figma requests before rejecting new ones */
export const MAX_PENDING_REQUESTS = requireInt("MAX_PENDING_REQUESTS", 100);

// ──────────────────────────────────────────────────────────────────
// Browser & Page Capture
// ──────────────────────────────────────────────────────────────────

/** Maximum time to wait for page to load (milliseconds) */
export const PAGE_LOAD_TIMEOUT = requireInt("PAGE_LOAD_TIMEOUT", 30_000);

/** Maximum time to wait for network idle state (milliseconds) */
export const NETWORK_IDLE_TIMEOUT = requireInt("NETWORK_IDLE_TIMEOUT", 5_000);

/** Delay after page load before taking screenshot (milliseconds) */
export const ANIMATION_SETTLE_DELAY = requireInt("ANIMATION_SETTLE_DELAY", 500);

/** Maximum time for DOM extraction (milliseconds) */
export const DOM_EXTRACTION_TIMEOUT = requireInt("DOM_EXTRACTION_TIMEOUT", 15_000);

/** Browser device scale factor (DPI multiplier) */
export const DEVICE_SCALE_FACTOR = requireInt("DEVICE_SCALE_FACTOR", 2);

// ──────────────────────────────────────────────────────────────────
// Dev Server Management
// ──────────────────────────────────────────────────────────────────

/** Default port for Next.js development server */
export const DEV_SERVER_PORT = requireInt("DEV_SERVER_PORT", 3000);

/** Maximum time to wait for dev server to start (milliseconds) */
export const DEV_SERVER_STARTUP_TIMEOUT = requireInt("DEV_SERVER_STARTUP_TIMEOUT", 60_000);

/** Interval between dev server readiness checks (milliseconds) */
export const DEV_SERVER_POLL_INTERVAL = requireInt("DEV_SERVER_POLL_INTERVAL", 1_000);

/** Time to wait for external server check before timeout (milliseconds) */
export const EXTERNAL_SERVER_TIMEOUT = requireInt("EXTERNAL_SERVER_TIMEOUT", 2_000);

/** Grace period (ms) between SIGTERM and SIGKILL when stopping the dev server */
export const DEV_SERVER_KILL_TIMEOUT = requireInt("DEV_SERVER_KILL_TIMEOUT", 5_000);

// ──────────────────────────────────────────────────────────────────
// Viewport Dimensions
// ──────────────────────────────────────────────────────────────────

/** Desktop viewport width (pixels) */
export const DESKTOP_VIEWPORT_WIDTH = requireInt("DESKTOP_VIEWPORT_WIDTH", 1440);

/** Desktop viewport height (pixels) */
export const DESKTOP_VIEWPORT_HEIGHT = requireInt("DESKTOP_VIEWPORT_HEIGHT", 900);

/** Mobile viewport width (pixels) */
export const MOBILE_VIEWPORT_WIDTH = requireInt("MOBILE_VIEWPORT_WIDTH", 375);

/** Mobile viewport height (pixels) */
export const MOBILE_VIEWPORT_HEIGHT = requireInt("MOBILE_VIEWPORT_HEIGHT", 812);

// ──────────────────────────────────────────────────────────────────
// Validation & Constraints
// ──────────────────────────────────────────────────────────────────

/** Maximum allowed border radius value (caps Tailwind's rounded-full) */
export const MAX_BORDER_RADIUS = requireInt("MAX_BORDER_RADIUS", 1000);

/** Maximum depth for DOM recursion during extraction */
export const MAX_DOM_EXTRACTION_DEPTH = requireInt("MAX_DOM_EXTRACTION_DEPTH", 999);

// ──────────────────────────────────────────────────────────────────
// WebSocket reconnect (used by Figma plugin UI as documentation)
// ──────────────────────────────────────────────────────────────────

/** Auto-reconnect attempts for WebSocket before giving up */
export const WEBSOCKET_MAX_RECONNECT_ATTEMPTS = requireInt("WEBSOCKET_MAX_RECONNECT_ATTEMPTS", 5);

/** Delay between WebSocket reconnection attempts (milliseconds) */
export const WEBSOCKET_RECONNECT_DELAY = requireInt("WEBSOCKET_RECONNECT_DELAY", 2_000);

/** Maximum number of log entries to keep in Figma plugin UI */
export const MAX_UI_LOG_ENTRIES = requireInt("MAX_UI_LOG_ENTRIES", 100);

/** Export a frozen config object for easy inspection / debugging */
export const CONFIG = Object.freeze({
  WEBSOCKET_PORT,
  FIGMA_REQUEST_TIMEOUT,
  MAX_PENDING_REQUESTS,
  PAGE_LOAD_TIMEOUT,
  NETWORK_IDLE_TIMEOUT,
  ANIMATION_SETTLE_DELAY,
  DOM_EXTRACTION_TIMEOUT,
  DEVICE_SCALE_FACTOR,
  DEV_SERVER_PORT,
  DEV_SERVER_STARTUP_TIMEOUT,
  DEV_SERVER_POLL_INTERVAL,
  EXTERNAL_SERVER_TIMEOUT,
  DEV_SERVER_KILL_TIMEOUT,
  DESKTOP_VIEWPORT_WIDTH,
  DESKTOP_VIEWPORT_HEIGHT,
  MOBILE_VIEWPORT_WIDTH,
  MOBILE_VIEWPORT_HEIGHT,
  MAX_BORDER_RADIUS,
  MAX_DOM_EXTRACTION_DEPTH,
  WEBSOCKET_MAX_RECONNECT_ATTEMPTS,
  WEBSOCKET_RECONNECT_DELAY,
  MAX_UI_LOG_ENTRIES,
});
