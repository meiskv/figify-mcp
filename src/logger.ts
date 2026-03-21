import { colors } from "./ui.js";

const c = colors;

const PREFIX = "[figify]";

function formatMessage(colorCode: string, symbol: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `${c.dim}${timestamp}${c.reset} ${PREFIX} ${colorCode}${symbol}${c.reset} ${message}`;
}

export const logger = {
  info(message: string): void {
    console.log(formatMessage(c.cyan, "ℹ", message));
  },

  warn(message: string, error?: unknown): void {
    console.warn(formatMessage(c.yellow, "⚠", message));
    if (error instanceof Error) {
      console.warn(`  ${c.dim}${error.message}${c.reset}`);
    }
  },

  error(message: string, error?: unknown): void {
    console.error(formatMessage(c.red, "✗", message));
    if (error instanceof Error) {
      console.error(`  ${c.dim}${error.message}${c.reset}`);
    }
  },

  success(message: string): void {
    console.log(formatMessage(c.green, "✓", message));
  },
} as const;
