#!/usr/bin/env node

import * as readline from "node:readline";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

const c = colors;

const MASCOT = `
${c.magenta}                    ▄▄▄▄▄▄▄▄▄▄▄                    ${c.reset}
${c.magenta}                ▄▀▀${c.cyan}░░░░░░░░░░░${c.magenta}▀▀▄                ${c.reset}
${c.magenta}              ▄▀${c.cyan}░░░░░░░░░░░░░░░░░${c.magenta}▀▄              ${c.reset}
${c.magenta}            ▄▀${c.cyan}░░░░░░░░░░░░░░░░░░░░░${c.magenta}▀▄            ${c.reset}
${c.magenta}           █${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░░░${c.magenta}█           ${c.reset}
${c.magenta}          █${c.cyan}░░░░░░░░░░${c.white}▄▄▄${c.cyan}░░░░${c.white}▄▄▄${c.cyan}░░░░░░░░${c.magenta}█          ${c.reset}
${c.magenta}         █${c.cyan}░░░░░░░░░░${c.white}█${c.blue}◉${c.white}█${c.cyan}░░░░${c.white}█${c.blue}◉${c.white}█${c.cyan}░░░░░░░░░░${c.magenta}█         ${c.reset}
${c.magenta}         █${c.cyan}░░░░░░░░░░${c.white}▀▀▀${c.cyan}░░░░${c.white}▀▀▀${c.cyan}░░░░░░░░░░${c.magenta}█         ${c.reset}
${c.magenta}         █${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░${c.magenta}█         ${c.reset}
${c.magenta}         █${c.cyan}░░░░░░░░░░░░░${c.yellow}▄▄▄▄▄${c.cyan}░░░░░░░░░░░░${c.magenta}█         ${c.reset}
${c.magenta}          █${c.cyan}░░░░░░░░░░░${c.yellow}▀${c.cyan}░░░░░${c.yellow}▀${c.cyan}░░░░░░░░░░░${c.magenta}█          ${c.reset}
${c.magenta}           █${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░░░░░${c.magenta}█           ${c.reset}
${c.magenta}            ▀▄${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░${c.magenta}▄▀            ${c.reset}
${c.magenta}         ▄▄▄▄▄▀▀▄${c.cyan}░░░░░░░░░░░░░░░░░${c.magenta}▄▀▀▄▄▄▄▄         ${c.reset}
${c.magenta}        █${c.cyan}░░░░░░░░░${c.magenta}▀▀▄▄▄${c.cyan}░░░░░${c.magenta}▄▄▄▀▀${c.cyan}░░░░░░░░░${c.magenta}█        ${c.reset}
${c.magenta}       █${c.cyan}░░░░░░░░░░░░░░░░${c.magenta}▀▀▀▀▀${c.cyan}░░░░░░░░░░░░░░░${c.magenta}█       ${c.reset}
${c.magenta}       █${c.cyan}░░░${c.green}◆${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░${c.green}◆${c.cyan}░░░${c.magenta}█       ${c.reset}
${c.magenta}       █${c.cyan}░░${c.green}◆◆◆${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░░░░░${c.green}◆◆◆${c.cyan}░░${c.magenta}█       ${c.reset}
${c.magenta}        █${c.cyan}░░${c.green}◆${c.cyan}░░░░░░░░░░░░░░░░░░░░░░░░░░░░░${c.green}◆${c.cyan}░░${c.magenta}█        ${c.reset}
${c.magenta}         ▀▀▄▄▄░░░░░░░░░░░░░░░░░░░░░░░░░▄▄▄▀▀         ${c.reset}
${c.magenta}              ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀              ${c.reset}
`;

const BANNER = `
${c.bold}${c.cyan}  ███████╗██╗ ██████╗ ██╗███████╗██╗   ██╗${c.reset}
${c.bold}${c.cyan}  ██╔════╝██║██╔════╝ ██║██╔════╝╚██╗ ██╔╝${c.reset}
${c.bold}${c.cyan}  █████╗  ██║██║  ███╗██║█████╗   ╚████╔╝ ${c.reset}
${c.bold}${c.cyan}  ██╔══╝  ██║██║   ██║██║██╔══╝    ╚██╔╝  ${c.reset}
${c.bold}${c.cyan}  ██║     ██║╚██████╔╝██║██║        ██║   ${c.reset}
${c.bold}${c.cyan}  ╚═╝     ╚═╝ ╚═════╝ ╚═╝╚═╝        ╚═╝   ${c.reset}
${c.dim}     Code to Figma • Powered by Claude${c.reset}
`;

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function print(text: string): void {
  console.log(text);
}

// Strip ANSI escape codes for length calculation
function stripAnsi(str: string): string {
  // Using string escape to avoid lint warning about control characters
  const ESC = String.fromCharCode(27);
  const regex = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
  return str.replace(regex, "");
}

function printCentered(text: string, width = 60): void {
  const lines = text.split("\n");
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const padding = Math.max(0, Math.floor((width - stripped.length) / 2));
    console.log(" ".repeat(padding) + line);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForKey(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function showWelcome(): Promise<void> {
  clearScreen();
  print(MASCOT);
  print(BANNER);
  print("");
  print(`${c.bold}  Welcome to Figify! ${c.reset}${c.dim}Your code-to-Figma bridge${c.reset}`);
  print("");
  await sleep(500);
}

async function showSetupSteps(): Promise<void> {
  print(`${c.bold}${c.yellow}  ┌─────────────────────────────────────────────────────┐${c.reset}`);
  print(
    `${c.bold}${c.yellow}  │${c.reset}              ${c.bold}Setup Instructions${c.reset}                    ${c.yellow}│${c.reset}`,
  );
  print(`${c.bold}${c.yellow}  └─────────────────────────────────────────────────────┘${c.reset}`);
  print("");

  const steps = [
    {
      num: "1",
      title: "Install Figma Plugin",
      desc: "Open Figma → Plugins → Development → Import plugin from manifest",
      path: `${c.dim}Select: ${c.cyan}./figma-plugin/manifest.json${c.reset}`,
    },
    {
      num: "2",
      title: "Run the Plugin in Figma",
      desc: "Open any Figma file and run the figify-mcp plugin",
      path: `${c.dim}This establishes the WebSocket connection${c.reset}`,
    },
    {
      num: "3",
      title: "Configure Claude Code",
      desc: "Add to your Claude Code MCP settings:",
      path: "",
    },
  ];

  for (const step of steps) {
    print(`  ${c.bold}${c.green}${step.num}.${c.reset} ${c.bold}${step.title}${c.reset}`);
    print(`     ${c.dim}${step.desc}${c.reset}`);
    if (step.path) {
      print(`     ${step.path}`);
    }
    print("");
  }

  // Show config example
  print(`${c.dim}  ┌─────────────────────────────────────────────────────┐${c.reset}`);
  print(
    `${c.dim}  │${c.reset} ${c.cyan}"mcpServers": {${c.reset}                                    ${c.dim}│${c.reset}`,
  );
  print(
    `${c.dim}  │${c.reset}   ${c.cyan}"figify-mcp": {${c.reset}                                  ${c.dim}│${c.reset}`,
  );
  print(
    `${c.dim}  │${c.reset}     ${c.cyan}"command": "figify-mcp"${c.reset}                        ${c.dim}│${c.reset}`,
  );
  print(
    `${c.dim}  │${c.reset}   ${c.cyan}}${c.reset}                                                ${c.dim}│${c.reset}`,
  );
  print(
    `${c.dim}  │${c.reset} ${c.cyan}}${c.reset}                                                  ${c.dim}│${c.reset}`,
  );
  print(`${c.dim}  └─────────────────────────────────────────────────────┘${c.reset}`);
  print("");
}

async function showUsageExamples(): Promise<void> {
  print(`${c.bold}${c.magenta}  ┌─────────────────────────────────────────────────────┐${c.reset}`);
  print(
    `${c.bold}${c.magenta}  │${c.reset}                ${c.bold}Usage Examples${c.reset}                      ${c.magenta}│${c.reset}`,
  );
  print(`${c.bold}${c.magenta}  └─────────────────────────────────────────────────────┘${c.reset}`);
  print("");

  const examples = [
    {
      cmd: '"import localhost:3000 to figma"',
      desc: "Capture homepage",
    },
    {
      cmd: '"import @/app/dashboard/page.tsx to figma - desktop and mobile"',
      desc: "Multi-viewport capture",
    },
    {
      cmd: '"check figma connection"',
      desc: "Verify plugin is connected",
    },
  ];

  for (const ex of examples) {
    print(`  ${c.cyan}→${c.reset} ${c.white}${ex.cmd}${c.reset}`);
    print(`    ${c.dim}${ex.desc}${c.reset}`);
    print("");
  }
}

async function showMenu(): Promise<string> {
  print(`${c.bold}  What would you like to do?${c.reset}`);
  print("");
  print(`  ${c.cyan}[1]${c.reset} Start MCP Server`);
  print(`  ${c.cyan}[2]${c.reset} Show Setup Instructions`);
  print(`  ${c.cyan}[3]${c.reset} Show Usage Examples`);
  print(`  ${c.cyan}[4]${c.reset} Open Figma Plugin Folder`);
  print(`  ${c.cyan}[q]${c.reset} Quit`);
  print("");

  return waitForKey(`  ${c.dim}Enter choice:${c.reset} `);
}

async function startServer(): Promise<void> {
  print("");
  print(`${c.bold}${c.green}  ▶ Starting Figify MCP Server...${c.reset}`);
  print(`  ${c.dim}WebSocket listening on port 19407${c.reset}`);
  print(`  ${c.dim}Waiting for Figma plugin connection...${c.reset}`);
  print("");
  print(`  ${c.yellow}Press Ctrl+C to stop${c.reset}`);
  print("");

  // Import and start the actual server
  const { main } = await import("./index.js");
  // The main function will take over from here
}

async function openPluginFolder(): Promise<void> {
  const { exec } = await import("node:child_process");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pluginPath = path.resolve(__dirname, "..", "figma-plugin");

  print("");
  print(`  ${c.dim}Opening: ${pluginPath}${c.reset}`);

  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "explorer" : "xdg-open";

  exec(`${cmd} "${pluginPath}"`, (error) => {
    if (error) {
      print(`  ${c.yellow}Could not open folder automatically.${c.reset}`);
      print(`  ${c.dim}Navigate to: ${pluginPath}${c.reset}`);
    }
  });

  await sleep(1000);
}

async function runOnboarding(): Promise<void> {
  await showWelcome();

  let running = true;
  while (running) {
    const choice = await showMenu();

    switch (choice) {
      case "1":
        await startServer();
        running = false;
        break;
      case "2":
        clearScreen();
        print(BANNER);
        await showSetupSteps();
        await waitForKey(`  ${c.dim}Press Enter to continue...${c.reset}`);
        clearScreen();
        print(BANNER);
        break;
      case "3":
        clearScreen();
        print(BANNER);
        await showUsageExamples();
        await waitForKey(`  ${c.dim}Press Enter to continue...${c.reset}`);
        clearScreen();
        print(BANNER);
        break;
      case "4":
        await openPluginFolder();
        break;
      case "q":
      case "quit":
      case "exit":
        print("");
        print(`  ${c.magenta}Thanks for using Figify! ${c.cyan}◆${c.reset}`);
        print("");
        running = false;
        process.exit(0);
        break;
      default:
        print(`  ${c.yellow}Invalid choice. Please try again.${c.reset}`);
        print("");
    }
  }
}

// Check for command line arguments
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  print(BANNER);
  print(`${c.bold}  Usage:${c.reset} figify-mcp [options]`);
  print("");
  print(`${c.bold}  Options:${c.reset}`);
  print(`    ${c.cyan}--help, -h${c.reset}     Show this help message`);
  print(`    ${c.cyan}--server, -s${c.reset}   Start MCP server directly (skip TUI)`);
  print(`    ${c.cyan}--version, -v${c.reset}  Show version`);
  print("");
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  print("figify-mcp v1.5.1");
  process.exit(0);
}

if (args.includes("--server") || args.includes("-s")) {
  // Start server directly without TUI
  import("./index.js");
} else {
  // Run interactive TUI
  runOnboarding().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
