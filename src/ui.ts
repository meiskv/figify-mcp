// ANSI color codes
export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  red: "\x1b[31m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

const c = colors;

// Strip ANSI escape codes for length calculation.
// Covers all standard ANSI CSI sequences (not just SGR colour codes).
export function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI stripping
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

// Print text to stdout
export function print(text: string): void {
  process.stdout.write(`${text}\n`);
}

// Clear the terminal screen
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

// Create a box with title and content.
// The title is centred within the box using the actual rendered width.
export function box(
  title: string,
  color: keyof typeof colors = "cyan",
  width = 60,
): { top: string; titleLine: string; bottom: string } {
  const borderColor = c[color];
  // ─ is a 3-byte UTF-8 char; the box borders use box-drawing chars that each
  // occupy one visual cell, so we repeat by (width - 2) for inner padding.
  const inner = "─".repeat(width - 2);

  const visibleTitle = stripAnsi(title);
  const innerWidth = width - 2; // space between the two │ chars
  const leftPad = Math.max(0, Math.floor((innerWidth - visibleTitle.length) / 2));
  const rightPad = Math.max(0, innerWidth - visibleTitle.length - leftPad);

  return {
    top: `${borderColor}┌${inner}┐${c.reset}`,
    titleLine: `${borderColor}│${c.reset}${" ".repeat(leftPad)}${c.bold}${title}${c.reset}${" ".repeat(rightPad)}${borderColor}│${c.reset}`,
    bottom: `${borderColor}└${inner}┘${c.reset}`,
  };
}

// Display numbered steps
export interface Step {
  num: string;
  title: string;
  description: string;
  details?: string[];
}

export function displaySteps(
  title: string,
  steps: Step[],
  color: keyof typeof colors = "yellow",
): void {
  const b = box(title, color);
  print(b.top);
  print(b.titleLine);
  print(b.bottom);
  print("");

  for (const step of steps) {
    const stepColor = c[color] || c.cyan;
    print(`  ${c.bold}${stepColor}${step.num}.${c.reset} ${c.bold}${step.title}${c.reset}`);
    print(`     ${c.dim}${step.description}${c.reset}`);
    if (step.details && step.details.length > 0) {
      for (const detail of step.details) {
        print(`     ${detail}`);
      }
    }
    print("");
  }
}

// Display code/config block
export function displayCodeBlock(lines: string[]): void {
  print(`${c.dim}  ┌─────────────────────────────────────────────────────┐${c.reset}`);
  for (const line of lines) {
    // pad to fill the fixed-width box (53 visible chars between │ chars)
    const visible = stripAnsi(line);
    const padded = line + " ".repeat(Math.max(0, 53 - visible.length));
    print(`${c.dim}  │${c.reset} ${padded}${c.dim}│${c.reset}`);
  }
  print(`${c.dim}  └─────────────────────────────────────────────────────┘${c.reset}`);
  print("");
}

// Display examples
export interface Example {
  cmd: string;
  description: string;
}

export function displayExamples(
  title: string,
  examples: Example[],
  color: keyof typeof colors = "magenta",
): void {
  const b = box(title, color);
  print(b.top);
  print(b.titleLine);
  print(b.bottom);
  print("");

  for (const example of examples) {
    print(`  ${c.cyan}→${c.reset} ${c.white}${example.cmd}${c.reset}`);
    print(`    ${c.dim}${example.description}${c.reset}`);
    print("");
  }
}

// Display an error message
export function displayError(message: string): void {
  print(`  ${c.red}✗${c.reset} ${message}${c.reset}`);
}

// Display a success message
export function displaySuccess(message: string): void {
  print(`  ${c.green}✓${c.reset} ${message}${c.reset}`);
}

// Display a warning message
export function displayWarning(message: string): void {
  print(`  ${c.yellow}⚠${c.reset} ${message}${c.reset}`);
}

// Display an info message
export function displayInfo(message: string): void {
  print(`  ${c.cyan}ℹ${c.reset} ${message}${c.reset}`);
}
