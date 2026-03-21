import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { CONFIG } from "../config/constants.js";
import type { DevServerInfo } from "../types/index.js";

export class DevServerManager {
  private serverProcess: ChildProcess | null = null;
  private currentProjectPath: string | null = null;

  /**
   * Resolve a source (file path or URL) to a full URL.
   * Starts dev server if needed.
   */
  async resolveToUrl(source: string, projectPath?: string): Promise<string> {
    if (source.startsWith("http://") || source.startsWith("https://")) {
      return source;
    }

    if (source.startsWith("localhost")) {
      return `http://${source}`;
    }

    // It's a file path — start dev server and convert to route
    const resolvedProjectPath = projectPath || (await this.findProjectRoot(source));
    const route = this.filePathToRoute(source, resolvedProjectPath);
    const serverInfo = await this.ensureDevServer(resolvedProjectPath);

    return `${serverInfo.url}${route}`;
  }

  /**
   * Convert a file path like @/app/journey/page.tsx to a route like /journey.
   */
  filePathToRoute(filePath: string, projectPath: string): string {
    let normalized = filePath;

    // Strip @/ alias or absolute project prefix
    if (normalized.startsWith("@/")) {
      normalized = normalized.slice(2);
    } else if (normalized.startsWith(projectPath)) {
      normalized = normalized.slice(projectPath.length);
    }

    // Strip leading slash then "app/" prefix
    normalized = normalized.replace(/^\//, "").replace(/^app\//, "");

    // Strip page/layout file segments
    normalized = normalized.replace(/\/?(page|layout)\.(tsx?|jsx?)$/, "");

    if (!normalized || normalized === "/") {
      return "/";
    }

    // Normalise to /route without trailing slash
    normalized = `/${normalized}`.replace(/\/$/, "");

    return normalized;
  }

  /**
   * Find the Next.js project root by walking up from the file looking for
   * a package.json that lists next as a dependency.
   */
  async findProjectRoot(filePath: string): Promise<string> {
    let dir = filePath.startsWith("@/") ? process.cwd() : path.dirname(filePath);

    while (dir !== path.dirname(dir)) {
      const packageJsonPath = path.join(dir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
          if (pkg.dependencies?.next || pkg.devDependencies?.next) {
            return dir;
          }
        } catch {
          // Continue searching upwards
        }
      }
      dir = path.dirname(dir);
    }

    return process.cwd();
  }

  /**
   * Ensure a dev server is running for the project.
   */
  async ensureDevServer(projectPath: string): Promise<DevServerInfo> {
    const externalServer = await this.checkExternalServer(CONFIG.devServer.DEFAULT_PORT);
    if (externalServer) return externalServer;

    if (this.serverProcess && this.currentProjectPath === projectPath) {
      return { url: `http://localhost:${CONFIG.devServer.DEFAULT_PORT}`, port: CONFIG.devServer.DEFAULT_PORT, isExternal: false };
    }

    await this.stopServer();
    return this.startServer(projectPath);
  }

  /**
   * Check whether a server is already listening on the given port.
   */
  private async checkExternalServer(port: number): Promise<DevServerInfo | null> {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      });

      // 404 is acceptable — the server is up, the route just doesn't exist yet
      if (response.ok || response.status === 404) {
        return { url: `http://localhost:${port}`, port, isExternal: true };
      }
    } catch {
      // Server not reachable
    }

    return null;
  }

  /**
   * Spawn the Next.js dev server and resolve once it is accepting requests.
   */
  private startServer(projectPath: string): Promise<DevServerInfo> {
    return new Promise((resolve, reject) => {
      console.error(`[DevServerManager] Starting Next.js dev server in ${projectPath}`);

      const serverProcess = spawn("npm", ["run", "dev"], {
        cwd: projectPath,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      this.serverProcess = serverProcess;
      this.currentProjectPath = projectPath;

      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        clearInterval(pollHandle);
        fn();
      };

      const tryResolve = async () => {
        const server = await this.checkExternalServer(CONFIG.devServer.DEFAULT_PORT);
        if (server) {
          settle(() =>
            resolve({
              url: `http://localhost:${CONFIG.devServer.DEFAULT_PORT}`,
              port: CONFIG.devServer.DEFAULT_PORT,
              isExternal: false,
            }),
          );
        }
      };

      const timeoutHandle = setTimeout(() => {
        settle(() => reject(new Error("Dev server startup timed out")));
      }, CONFIG.devServer.SERVER_READY_TIMEOUT);

      const pollHandle = setInterval(tryResolve, CONFIG.devServer.POLL_INTERVAL_MS);

      serverProcess.stdout?.on("data", async (data: Buffer) => {
        const output = data.toString();
        console.error(`[DevServerManager] stdout: ${output}`);

        if (output.includes("Ready") || output.includes("localhost:")) {
          // Give the server a moment to fully bind before probing
          await new Promise((r) => setTimeout(r, CONFIG.devServer.READY_SETTLE_DELAY_MS));
          tryResolve();
        }
      });

      serverProcess.stderr?.on("data", (data: Buffer) => {
        console.error(`[DevServerManager] stderr: ${data.toString()}`);
      });

      serverProcess.on("error", (error: Error) => {
        settle(() => reject(error));
      });

      serverProcess.on("exit", (code: number | null) => {
        if (code !== 0 && code !== null) {
          settle(() => reject(new Error(`Dev server exited with code ${code}`)));
        }
      });
    });
  }

  /**
   * Stop the managed dev server if one is running.
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
