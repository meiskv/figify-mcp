import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { getViewport } from "../config/viewports.js";
import type { FigmaLayerTree, FrameLayer, Screenshot, ViewportType } from "../types/index.js";
import { DOMExtractor } from "./dom-extractor.js";

const PAGE_LOAD_TIMEOUT = 30000; // 30 seconds
const NETWORK_IDLE_TIMEOUT = 5000; // 5 seconds

export interface CaptureWithLayersResult {
  layerTree: FigmaLayerTree;
  screenshot: Screenshot;
}

export class ScreenshotService {
  private browser: Browser | null = null;
  private domExtractor = new DOMExtractor();

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

  /**
   * Capture page with DOM extraction for editable layers
   */
  async captureWithLayers(
    url: string,
    viewportType: ViewportType,
    pageName: string,
  ): Promise<CaptureWithLayersResult> {
    await this.initialize();

    const viewport = getViewport(viewportType);
    console.error(
      `[ScreenshotService] Capturing with layers ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`,
    );

    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const context = await this.browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_LOAD_TIMEOUT,
      });

      await this.waitForNetworkIdle(page);
      await page.waitForTimeout(500);

      // Extract DOM structure
      const rootLayer = await this.domExtractor.extract(page);

      // Get page dimensions
      const dimensions = (await page.evaluate(
        "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
      )) as { width: number; height: number };

      // Take fallback screenshot
      const buffer = await page.screenshot({
        fullPage: true,
        type: "png",
      });

      const screenshot: Screenshot = {
        viewport: viewportType,
        width: dimensions.width,
        height: dimensions.height,
        data: buffer.toString("base64"),
      };

      const layerTree: FigmaLayerTree = {
        name: `${pageName} - ${viewportType}`,
        viewport: viewportType,
        width: dimensions.width,
        height: dimensions.height,
        rootLayer,
        screenshotFallback: screenshot.data,
      };

      return { layerTree, screenshot };
    } finally {
      await context.close();
    }
  }
}
