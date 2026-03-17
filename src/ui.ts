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

// Strip ANSI escape codes for length calculation
export function stripAnsi(str: string): string {
  const ESC = String.fromCharCode(27);
  const regex = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
  return str.replace(regex, "");
}

// Print text to stdout
export function print(text: string): void {
  console.log(text);
}

// Print centered text
export function printCentered(text: string, width = 60): void {
  const lines = text.split("\n");
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const padding = Math.max(0, Math.floor((width - stripped.length) / 2));
    console.log(" ".repeat(padding) + line);
  }
}

// Clear the terminal screen
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

// Create a box with title and content
export function box(
  title: string,
  color: keyof typeof colors = "cyan",
  width = 60,
): { top: string; titleLine: string; bottom: string } {
  const borderColor = c[color];
  const borderWidth = width;
  const padding = "─".repeat(borderWidth - 4);

  return {
    top: `${borderColor}┌${padding}┐${c.reset}`,
    titleLine: `${borderColor}│${c.reset}              ${c.bold}${title}${c.reset}                    ${borderColor}│${c.reset}`,
    bottom: `${borderColor}└${padding}┘${c.reset}`,
  };
}

// Display a menu with numbered options
export interface MenuOption {
  key: string;
  label: string;
  description?: string;
}

export function displayMenu(title: string, options: MenuOption[], width = 60): void {
  const b = box(title, "cyan", width);
  print(b.top);
  print(b.titleLine);
  print(b.bottom);
  print("");

  for (const option of options) {
    print(`  ${c.cyan}[${option.key}]${c.reset} ${option.label}`);
    if (option.description) {
      print(`     ${c.dim}${option.description}${c.reset}`);
    }
  }
  print("");
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
    print(`${c.dim}  │${c.reset} ${line.padEnd(51)}${c.dim}│${c.reset}`);
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
