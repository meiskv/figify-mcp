import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { CONFIG } from "../config/constants.js";
import { getViewport } from "../config/viewports.js";
import type { FigmaLayerTree, FrameLayer, Screenshot, ViewportType } from "../types/index.js";
import { DOMExtractor } from "./dom-extractor.js";

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
    const viewport = getViewport(viewportType);
    console.error(
      `[ScreenshotService] Capturing ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`,
    );

    const { context, page } = await this.setupPage(viewportType);

    try {
      await this.navigateAndWait(page, url);
      const dimensions = await this.getDimensions(page);
      const data = await this.takeScreenshot(page);

      return {
        viewport: viewportType,
        width: dimensions.width,
        height: dimensions.height,
        data,
      };
    } finally {
      await context.close();
    }
  }

  private async waitForNetworkIdle(page: Page): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", {
        timeout: CONFIG.screenshot.NETWORK_IDLE_TIMEOUT,
      });
    } catch {
      // Network idle timeout is acceptable - page might have long-polling
      console.error("[ScreenshotService] Network idle timeout - continuing anyway");
    }
  }

  /**
   * Set up a browser context and page with the specified viewport
   */
  private async setupPage(viewportType: ViewportType): Promise<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
    await this.initialize();

    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const viewport = getViewport(viewportType);
    const context = await this.browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: CONFIG.screenshot.DEVICE_SCALE_FACTOR,
    });

    const page = await context.newPage();
    return { context, page };
  }

  /**
   * Navigate to URL and wait for page to load
   */
  private async navigateAndWait(page: Page, url: string): Promise<void> {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.screenshot.PAGE_LOAD_TIMEOUT,
    });

    await this.waitForNetworkIdle(page);
    await page.waitForTimeout(500);
  }

  /**
   * Get the rendered page dimensions
   */
  private async getDimensions(page: Page): Promise<{ width: number; height: number }> {
    return (await page.evaluate(
      "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
    )) as { width: number; height: number };
  }

  /**
   * Take a screenshot and return as base64
   */
  private async takeScreenshot(page: Page): Promise<string> {
    const buffer = await page.screenshot({
      fullPage: true,
      type: "png",
    });
    return buffer.toString("base64");
  }

  /**
   * Capture page with DOM extraction for editable layers
   */
  async captureWithLayers(
    url: string,
    viewportType: ViewportType,
    pageName: string,
  ): Promise<CaptureWithLayersResult> {
    const viewport = getViewport(viewportType);
    console.error(
      `[ScreenshotService] Capturing with layers ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`,
    );

    const { context, page } = await this.setupPage(viewportType);

    try {
      await this.navigateAndWait(page, url);

      // Extract DOM structure
      const rootLayer = await this.domExtractor.extract(page);

      // Get page dimensions and screenshot
      const dimensions = await this.getDimensions(page);
      const data = await this.takeScreenshot(page);

      const screenshot: Screenshot = {
        viewport: viewportType,
        width: dimensions.width,
        height: dimensions.height,
        data,
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
