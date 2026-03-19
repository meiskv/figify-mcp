#!/usr/bin/env node

import * as readline from "node:readline";
import { logger } from "./logger.js";
import { sharedBridge } from "./server-state.js";
import {
  clearScreen,
  colors,
  displayCodeBlock,
  displayError,
  displayExamples,
  displayInfo,
  displaySteps,
  displaySuccess,
  displayWarning,
  print,
} from "./ui.js";
import { VERSION } from "./version.js";

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
${c.magenta}         █${c.cyan}░░░░░░░░░░░░░░${c.yellow}▄▄▄▄▄${c.cyan}░░░░░░░░░░░░${c.magenta}█         ${c.reset}
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

// Alias display functions for brevity
const showError = displayError;
const showSuccess = displaySuccess;
const showWarning = displayWarning;
const showInfo = displayInfo;

async function showWelcome(): Promise<void> {
  clearScreen();
  print(MASCOT);
  print(BANNER);
  print("");
  showSuccess("Welcome to Figify!");
  print(`  ${c.dim}Your code-to-Figma bridge${c.reset}`);
  print("");
  logger.info("User opened CLI");
  await sleep(500);
}

async function showSetupSteps(): Promise<void> {
  const steps = [
    {
      num: "1",
      title: "Install Figma Plugin",
      description: "Open Figma → Plugins → Development → Import plugin from manifest",
      details: [`${c.dim}Select: ${c.cyan}./figma-plugin/manifest.json${c.reset}`],
    },
    {
      num: "2",
      title: "Run the Plugin in Figma",
      description: "Open any Figma file and run the figify-mcp plugin",
      details: [`${c.dim}This establishes the WebSocket connection${c.reset}`],
    },
    {
      num: "3",
      title: "Configure Claude Code",
      description: "Add to your Claude Code MCP settings:",
      details: [],
    },
  ];

  displaySteps("Setup Instructions", steps, "yellow");

  // Show config example
  displayCodeBlock([
    `${c.cyan}"mcpServers": {${c.reset}`,
    `  ${c.cyan}"figify-mcp": {${c.reset}`,
    `    ${c.cyan}"command": "figify-mcp"${c.reset}`,
    `  ${c.cyan}}${c.reset}`,
    `${c.cyan}}${c.reset}`,
  ]);
}

async function showUsageExamples(): Promise<void> {
  const examples = [
    {
      cmd: '"import localhost:3000 to figma"',
      description: "Capture homepage",
    },
    {
      cmd: '"import @/app/dashboard/page.tsx to figma - desktop and mobile"',
      description: "Multi-viewport capture",
    },
    {
      cmd: '"check figma connection"',
      description: "Verify plugin is connected",
    },
  ];

  displayExamples("Usage Examples", examples, "magenta");
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

function formatUptime(connectedAt: Date | null): string {
  if (!connectedAt) return "";
  const seconds = Math.floor((Date.now() - connectedAt.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function renderStatusDashboard(serverStartedAt: Date): void {
  const info = sharedBridge.getConnectionInfo();
  const now = new Date();
  const serverUptime = Math.floor((now.getTime() - serverStartedAt.getTime()) / 1000);
  const serverUptimeStr =
    serverUptime < 60
      ? `${serverUptime}s`
      : serverUptime < 3600
        ? `${Math.floor(serverUptime / 60)}m ${serverUptime % 60}s`
        : `${Math.floor(serverUptime / 3600)}h ${Math.floor((serverUptime % 3600) / 60)}m`;

  // Move cursor to top-left without full clear to avoid flicker
  process.stdout.write("\x1b[H");

  print(BANNER);

  // Status panel
  const panelWidth = 60;
  const inner = "─".repeat(panelWidth - 2);
  print(`${c.cyan}┌${inner}┐${c.reset}`);
  print(
    `${c.cyan}│${c.reset}${c.bold}${" ".repeat(22)}Live Status${" ".repeat(25)}${c.reset}${c.cyan}│${c.reset}`,
  );
  print(`${c.cyan}├${inner}┤${c.reset}`);

  // MCP Server row
  const serverLabel = "  MCP Server        ";
  const serverVal = `${c.green}● Running${c.reset}  uptime: ${c.dim}${serverUptimeStr}${c.reset}`;
  const serverValVisible = `● Running  uptime: ${serverUptimeStr}`;
  const serverPad = " ".repeat(
    Math.max(0, panelWidth - 2 - serverLabel.length - serverValVisible.length),
  );
  print(`${c.cyan}│${c.reset}${serverLabel}${serverVal}${serverPad}${c.cyan}│${c.reset}`);

  // WebSocket row
  const wsLabel = "  WebSocket Port    ";
  const wsVal = `${c.dim}:19407${c.reset}`;
  const wsValVisible = ":19407";
  const wsPad = " ".repeat(Math.max(0, panelWidth - 2 - wsLabel.length - wsValVisible.length));
  print(`${c.cyan}│${c.reset}${wsLabel}${wsVal}${wsPad}${c.cyan}│${c.reset}`);

  // Figma connection row
  const figmaLabel = "  Figma Plugin      ";
  let figmaVal: string;
  let figmaValVisible: string;
  if (info.connected) {
    const uptime = formatUptime(info.connectedAt);
    figmaVal = `${c.green}● Connected${c.reset}  uptime: ${c.dim}${uptime}${c.reset}`;
    figmaValVisible = `● Connected  uptime: ${uptime}`;
  } else {
    figmaVal = `${c.yellow}○ Waiting for plugin...${c.reset}`;
    figmaValVisible = "○ Waiting for plugin...";
  }
  const figmaPad = " ".repeat(
    Math.max(0, panelWidth - 2 - figmaLabel.length - figmaValVisible.length),
  );
  print(`${c.cyan}│${c.reset}${figmaLabel}${figmaVal}${figmaPad}${c.cyan}│${c.reset}`);

  // Pending requests row (only shown when > 0)
  if (info.pendingRequests > 0) {
    const reqLabel = "  Pending Requests  ";
    const reqVal = `${c.yellow}${info.pendingRequests}${c.reset}`;
    const reqValVisible = String(info.pendingRequests);
    const reqPad = " ".repeat(Math.max(0, panelWidth - 2 - reqLabel.length - reqValVisible.length));
    print(`${c.cyan}│${c.reset}${reqLabel}${reqVal}${reqPad}${c.cyan}│${c.reset}`);
  } else {
    // Blank row to keep the box height stable
    print(`${c.cyan}│${c.reset}${" ".repeat(panelWidth - 2)}${c.cyan}│${c.reset}`);
  }

  print(`${c.cyan}└${inner}┘${c.reset}`);

  print("");
  if (!info.connected) {
    print(`  ${c.dim}Open Figma, run the figify-mcp plugin to connect.${c.reset}`);
  } else {
    print(`  ${c.green}Ready — ask Claude to import a page to Figma.${c.reset}    `);
  }
  print("");
  print(`  ${c.dim}Press Ctrl+C to stop the server.${c.reset}              `);
  // Erase to end of screen in case previous render was taller
  process.stdout.write("\x1b[J");
}

async function startServer(): Promise<void> {
  try {
    logger.info("Starting MCP server from CLI");
    const { main } = await import("./index.js");

    // Give the server a moment to bind the WebSocket port
    await sleep(300);

    const serverStartedAt = new Date();

    // Full clear once at the start to set up the dashboard canvas
    clearScreen();

    // Render immediately, then on every connect/disconnect event
    renderStatusDashboard(serverStartedAt);

    sharedBridge.on("connect", () => renderStatusDashboard(serverStartedAt));
    sharedBridge.on("disconnect", () => renderStatusDashboard(serverStartedAt));

    // Tick every second to keep the uptime counter live
    const ticker = setInterval(() => renderStatusDashboard(serverStartedAt), 1000);

    // Clean up ticker on process exit
    process.once("exit", () => clearInterval(ticker));
  } catch (error) {
    showError("Failed to start server");
    if (error instanceof Error) {
      logger.error("Server startup failed", error);
    }
    process.exit(1);
  }
}

async function openPluginFolder(): Promise<void> {
  try {
    const { exec } = await import("node:child_process");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pluginPath = path.resolve(__dirname, "..", "figma-plugin");

    print("");
    showInfo(`Opening plugin folder: ${pluginPath}`);

    const platform = process.platform;
    const cmd = platform === "darwin" ? "open" : platform === "win32" ? "explorer" : "xdg-open";

    exec(`${cmd} "${pluginPath}"`, (error) => {
      if (error) {
        logger.warn("Could not open folder automatically", error);
        showWarning("Could not open folder automatically.");
        print(`  ${c.dim}Navigate to: ${pluginPath}${c.reset}`);
      } else {
        showSuccess("Plugin folder opened");
      }
    });

    await sleep(1000);
  } catch (error) {
    logger.error("Failed to open plugin folder", error);
    showError("Failed to open plugin folder");
  }
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

try {
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
    print(`figify-mcp v${VERSION}`);
    process.exit(0);
  }

  if (args.includes("--server") || args.includes("-s")) {
    // Start server directly without TUI
    logger.info("Starting MCP server from CLI with --server flag");
    import("./index.js").catch((error) => {
      logger.error("Failed to start server", error);
      process.exit(1);
    });
  } else {
    // Run interactive TUI
    runOnboarding().catch((error) => {
      logger.error("CLI error", error);
      showError("An error occurred in the CLI");
      process.exit(1);
    });
  }
} catch (error) {
  logger.error("Unexpected error", error);
  showError("An unexpected error occurred");
  process.exit(1);
}
