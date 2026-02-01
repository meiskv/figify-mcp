import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { DevServerInfo } from "../types/index.js";

const DEFAULT_PORT = 3000;
const SERVER_READY_TIMEOUT = 60000; // 60 seconds

export class DevServerManager {
  private serverProcess: ChildProcess | null = null;
  private currentProjectPath: string | null = null;

  /**
   * Resolve a source (file path or URL) to a full URL.
   * Starts dev server if needed.
   */
  async resolveToUrl(source: string, projectPath?: string): Promise<string> {
    // If it's already a URL, return it
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return source;
    }

    // Handle localhost shorthand
    if (source.startsWith("localhost")) {
      return `http://${source}`;
    }

    // It's a file path - need to start dev server and convert to route
    const resolvedProjectPath = projectPath || (await this.findProjectRoot(source));
    const route = this.filePathToRoute(source, resolvedProjectPath);

    // Check if dev server is already running
    const serverInfo = await this.ensureDevServer(resolvedProjectPath);

    return `${serverInfo.url}${route}`;
  }

  /**
   * Convert a file path like @/app/journey/page.tsx to a route like /journey
   */
  filePathToRoute(filePath: string, projectPath: string): string {
    // Normalize the path
    let normalized = filePath;

    // Handle @/ alias
    if (normalized.startsWith("@/")) {
      normalized = normalized.slice(2);
    }

    // Handle absolute paths
    if (normalized.startsWith(projectPath)) {
      normalized = normalized.slice(projectPath.length);
    }

    // Remove leading slash
    if (normalized.startsWith("/")) {
      normalized = normalized.slice(1);
    }

    // Handle app router paths
    if (normalized.startsWith("app/")) {
      normalized = normalized.slice(4);
    }

    // Remove page.tsx, page.ts, page.jsx, page.js
    normalized = normalized.replace(/\/?(page|layout)\.(tsx?|jsx?)$/, "");

    // Handle index routes
    if (normalized === "" || normalized === "/") {
      return "/";
    }

    // Ensure leading slash
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    // Remove trailing slash
    if (normalized.endsWith("/") && normalized !== "/") {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Find the Next.js project root by looking for package.json
   */
  async findProjectRoot(filePath: string): Promise<string> {
    // Start from the file's directory
    let dir = path.dirname(filePath);

    // Handle @/ alias - assume current working directory
    if (filePath.startsWith("@/")) {
      dir = process.cwd();
    }

    // Walk up until we find package.json with next dependency
    while (dir !== path.dirname(dir)) {
      const packageJsonPath = path.join(dir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
          if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
            return dir;
          }
        } catch {
          // Continue searching
        }
      }
      dir = path.dirname(dir);
    }

    // Fallback to current working directory
    return process.cwd();
  }

  /**
   * Ensure dev server is running for the project
   */
  async ensureDevServer(projectPath: string): Promise<DevServerInfo> {
    // First, check if a dev server is already running externally
    const externalServer = await this.checkExternalServer(DEFAULT_PORT);
    if (externalServer) {
      return externalServer;
    }

    // If we already started a server for this project, return it
    if (this.serverProcess && this.currentProjectPath === projectPath) {
      return {
        url: `http://localhost:${DEFAULT_PORT}`,
        port: DEFAULT_PORT,
        process: this.serverProcess,
        isExternal: false,
      };
    }

    // Stop existing server if different project
    await this.stopServer();

    // Start new server
    return this.startServer(projectPath);
  }

  /**
   * Check if a dev server is already running externally
   */
  private async checkExternalServer(port: number): Promise<DevServerInfo | null> {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok || response.status === 404) {
        // Server is running (404 is fine - just means route doesn't exist)
        return {
          url: `http://localhost:${port}`,
          port,
          isExternal: true,
        };
      }
    } catch {
      // Server not running
    }

    return null;
  }

  /**
   * Start the Next.js dev server
   */
  private async startServer(projectPath: string): Promise<DevServerInfo> {
    return new Promise((resolve, reject) => {
      console.error(`[DevServerManager] Starting Next.js dev server in ${projectPath}`);

      const serverProcess = spawn("npm", ["run", "dev"], {
        cwd: projectPath,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      this.serverProcess = serverProcess;
      this.currentProjectPath = projectPath;

      const timeout = setTimeout(() => {
        reject(new Error("Dev server startup timed out"));
      }, SERVER_READY_TIMEOUT);

      const checkReady = async () => {
        const server = await this.checkExternalServer(DEFAULT_PORT);
        if (server) {
          clearTimeout(timeout);
          resolve({
            url: `http://localhost:${DEFAULT_PORT}`,
            port: DEFAULT_PORT,
            process: serverProcess,
            isExternal: false,
          });
          return true;
        }
        return false;
      };

      // Listen for ready signals
      serverProcess.stdout?.on("data", async (data) => {
        const output = data.toString();
        console.error(`[DevServerManager] stdout: ${output}`);

        if (output.includes("Ready") || output.includes("localhost:")) {
          // Give it a moment to fully start
          await new Promise((r) => setTimeout(r, 1000));
          await checkReady();
        }
      });

      serverProcess.stderr?.on("data", (data) => {
        console.error(`[DevServerManager] stderr: ${data.toString()}`);
      });

      serverProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      serverProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Dev server exited with code ${code}`));
        }
      });

      // Poll for server ready
      const pollInterval = setInterval(async () => {
        if (await checkReady()) {
          clearInterval(pollInterval);
        }
      }, 1000);
    });
  }

  /**
   * Stop the dev server if we started it
   */
  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      console.error("[DevServerManager] Stopping dev server");
      this.serverProcess.kill();
      this.serverProcess = null;
      this.currentProjectPath = null;
    }
  }
}
