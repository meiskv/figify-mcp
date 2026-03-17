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
  verbose?: boolean;
}

export class Logger {
  private config: LoggerConfig;

  constructor(config?: LoggerConfig) {
    this.config = {
      level: LogLevel.INFO,
      prefix: "figify",
      verbose: false,
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

  info(message: string, data?: unknown): void {
    console.log(this.formatMessage(LogLevel.INFO, message));
    if (this.config.verbose && data) {
      console.log(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}`);
    }
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage(LogLevel.WARN, message));
    if (this.config.verbose && data) {
      console.warn(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}`);
    }
  }

  error(message: string, error?: Error | unknown): void {
    console.error(this.formatMessage(LogLevel.ERROR, message));
    if (error) {
      if (error instanceof Error) {
        console.error(`  ${c.dim}${error.message}${c.reset}`);
        if (this.config.verbose && error.stack) {
          console.error(`  ${c.dim}${error.stack}${c.reset}`);
        }
      } else if (this.config.verbose) {
        console.error(`  ${c.dim}${JSON.stringify(error, null, 2)}${c.reset}`);
      }
    }
  }

  success(message: string, data?: unknown): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message));
    if (this.config.verbose && data) {
      console.log(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}`);
    }
  }

  setVerbose(verbose: boolean): void {
    this.config.verbose = verbose;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// Create a default logger instance
export const logger = new Logger();
