/**
 * Centralized configuration constants for figify-mcp
 * Single source of truth for all timeout values, ports, and configuration parameters
 */

export const CONFIG = {
  // WebSocket / Figma Bridge Configuration
  websocket: {
    PORT: 19407,
    REQUEST_TIMEOUT: 30000, // 30 seconds
  },

  // Browser Automation / Screenshot Service Configuration
  screenshot: {
    PAGE_LOAD_TIMEOUT: 30000, // 30 seconds
    NETWORK_IDLE_TIMEOUT: 5000, // 5 seconds
    DEVICE_SCALE_FACTOR: 2, // Retina/2x for high quality screenshots
  },

  // Dev Server Management Configuration
  devServer: {
    DEFAULT_PORT: 3000,
    SERVER_READY_TIMEOUT: 60000, // 60 seconds
    POLL_INTERVAL_MS: 1000, // Check every 1 second
    READY_SETTLE_DELAY_MS: 1000, // Wait 1 second after "Ready" message
  },

  // CLI Configuration
  cli: {
    STARTUP_MESSAGE_DELAY: 500, // Initial welcome screen delay
    PLUGIN_FOLDER_OPEN_DELAY: 1000, // Delay after opening plugin folder
  },
} as const;
