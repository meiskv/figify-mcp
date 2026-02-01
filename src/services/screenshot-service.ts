import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { getViewport } from "../config/viewports.js";
import type { Screenshot, ViewportType } from "../types/index.js";

const PAGE_LOAD_TIMEOUT = 30000; // 30 seconds
const NETWORK_IDLE_TIMEOUT = 5000; // 5 seconds

export class ScreenshotService {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      console.error("[ScreenshotService] Launching browser");
      this.browser = await chromium.launch({
        headless: true,
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.error("[ScreenshotService] Closing browser");
      await this.browser.close();
      this.browser = null;
    }
  }

  async capture(url: string, viewportType: ViewportType): Promise<Screenshot> {
    await this.initialize();

    const viewport = getViewport(viewportType);
    console.error(
      `[ScreenshotService] Capturing ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`,
    );

    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const context = await this.browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: 2, // Retina quality
    });

    const page = await context.newPage();

    try {
      // Navigate to the URL
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_LOAD_TIMEOUT,
      });

      // Wait for network to be idle (no requests for 500ms)
      await this.waitForNetworkIdle(page);

      // Wait a bit more for any animations to settle
      await page.waitForTimeout(500);

      // Take full-page screenshot
      const buffer = await page.screenshot({
        fullPage: true,
        type: "png",
      });

      // Get actual page dimensions after rendering
      const dimensions = (await page.evaluate(
        "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
      )) as { width: number; height: number };

      return {
        viewport: viewportType,
        width: dimensions.width,
        height: dimensions.height,
        data: buffer.toString("base64"),
      };
    } finally {
      await context.close();
    }
  }

  private async waitForNetworkIdle(page: Page): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", {
        timeout: NETWORK_IDLE_TIMEOUT,
      });
    } catch {
      // Network idle timeout is acceptable - page might have long-polling
      console.error("[ScreenshotService] Network idle timeout - continuing anyway");
    }
  }
}
