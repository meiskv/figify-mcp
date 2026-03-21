import { colors } from "./ui.js";

const c = colors;

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 1, // same numeric priority as INFO
}

export interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
  verbose?: boolean;
}

export class Logger {
  private config: Required<LoggerConfig>;

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

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  info(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    // Use stderr so CLI output never corrupts the MCP stdio stream.
    process.stderr.write(`${this.formatMessage(LogLevel.INFO, message)}\n`);
    if (this.config.verbose && data !== undefined) {
      process.stderr.write(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}\n`);
    }
  }

  warn(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    process.stderr.write(`${this.formatMessage(LogLevel.WARN, message)}\n`);
    if (this.config.verbose && data !== undefined) {
      process.stderr.write(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}\n`);
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    process.stderr.write(`${this.formatMessage(LogLevel.ERROR, message)}\n`);
    if (error !== undefined) {
      if (error instanceof Error) {
        process.stderr.write(`  ${c.dim}${error.message}${c.reset}\n`);
        if (this.config.verbose && error.stack) {
          process.stderr.write(`  ${c.dim}${error.stack}${c.reset}\n`);
        }
      } else if (this.config.verbose) {
        process.stderr.write(`  ${c.dim}${JSON.stringify(error, null, 2)}${c.reset}\n`);
      }
    }
  }

  success(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.SUCCESS)) return;
    process.stderr.write(`${this.formatMessage(LogLevel.SUCCESS, message)}\n`);
    if (this.config.verbose && data !== undefined) {
      process.stderr.write(`  ${c.dim}${JSON.stringify(data, null, 2)}${c.reset}\n`);
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
