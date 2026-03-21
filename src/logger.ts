import { colors } from "./ui.js";

const c = colors;

export enum LogLevel {
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  SUCCESS = "success",
}

export interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  private config: LoggerConfig;

  constructor(config?: LoggerConfig) {
    this.config = {
      level: LogLevel.INFO,
      prefix: "figify",
      ...config,
    };
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : "";

    switch (level) {
      case LogLevel.INFO:
        return `${c.dim}${timestamp}${c.reset} ${prefix} ${c.cyan}ℹ${c.reset} ${message}`;
      case LogLevel.WARN:
        return `${c.dim}${timestamp}${c.reset} ${prefix} ${c.yellow}⚠${c.reset} ${message}`;
      case LogLevel.ERROR:
        return `${c.dim}${timestamp}${c.reset} ${prefix} ${c.red}✗${c.reset} ${message}`;
      case LogLevel.SUCCESS:
        return `${c.dim}${timestamp}${c.reset} ${prefix} ${c.green}✓${c.reset} ${message}`;
      default:
        return message;
    }
  }

  info(message: string): void {
    console.log(this.formatMessage(LogLevel.INFO, message));
  }

  warn(message: string): void {
    console.warn(this.formatMessage(LogLevel.WARN, message));
  }

  error(message: string, error?: Error | unknown): void {
    console.error(this.formatMessage(LogLevel.ERROR, message));
    if (error instanceof Error) {
      console.error(`  ${c.dim}${error.message}${c.reset}`);
    }
  }

  success(message: string): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message));
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// Create a default logger instance
export const logger = new Logger();
