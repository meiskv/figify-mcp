import { DevServerManager } from "./dev-server-manager.js";

export class PageRenderer {
  private devServerManager: DevServerManager;

  constructor() {
    this.devServerManager = new DevServerManager();
  }

  /**
   * Resolve a source (file path or URL) to a full URL.
   * Handles:
   * - Full URLs (http://..., https://...)
   * - Localhost shorthand (localhost:3000/path)
   * - File paths (@/app/page.tsx, app/journey/page.tsx)
   */
  async resolveUrl(source: string, projectPath?: string): Promise<string> {
    return this.devServerManager.resolveToUrl(source, projectPath);
  }

  /**
   * Stop any dev server we may have started
   */
  async cleanup(): Promise<void> {
    await this.devServerManager.stopServer();
  }
}
