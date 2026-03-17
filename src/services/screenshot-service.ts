import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import {
  ANIMATION_SETTLE_DELAY,
  DEVICE_SCALE_FACTOR,
  NETWORK_IDLE_TIMEOUT,
  PAGE_LOAD_TIMEOUT,
} from "../config/constants.js";
import { getViewport } from "../config/viewports.js";
import type { FigmaLayerTree, Screenshot, ViewportType } from "../types/index.js";
import { DOMExtractor } from "./dom-extractor.js";

export interface CaptureWithLayersResult {
  layerTree: FigmaLayerTree;
  screenshot: Screenshot;
}

/** Shared result from the internal page-navigation helper */
interface NavigatedPage {
  page: Page;
  context: BrowserContext;
  dimensions: { width: number; height: number };
}

export class ScreenshotService {
  private browser: Browser | null = null;
  /**
   * Guards concurrent initialize() calls so only one browser is ever launched.
   * Subsequent callers await the same promise instead of racing.
   */
  private initPromise: Promise<void> | null = null;
  private domExtractor = new DOMExtractor();

  async initialize(): Promise<void> {
    if (this.browser) return;
    if (!this.initPromise) {
      this.initPromise = this.launchBrowser();
    }
    return this.initPromise;
  }

  private async launchBrowser(): Promise<void> {
    console.error("[ScreenshotService] Launching browser");
    this.browser = await chromium.launch({ headless: true });
    // Clear the promise so a future re-launch (after close()) works correctly.
    this.initPromise = null;
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.error("[ScreenshotService] Closing browser");
      await this.browser.close();
      this.browser = null;
      this.initPromise = null;
    }
  }

  async capture(url: string, viewportType: ViewportType): Promise<Screenshot> {
    await this.initialize();

    const viewport = getViewport(viewportType);
    console.error(
      `[ScreenshotService] Capturing ${viewport.name} (${viewport.width}x${viewport.height}) for ${url}`,
    );

    const { page, context, dimensions } = await this.navigatePage(url, viewportType);

    try {
      const buffer = await page.screenshot({ fullPage: true, type: "png" });

      return {
        viewport: viewportType,
        width: dimensions.width,
        height: dimensions.height,
        data: buffer.toString("base64"),
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  /**
   * Capture page with DOM extraction for editable layers.
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

    const { page, context, dimensions } = await this.navigatePage(url, viewportType);

    try {
      // Extract DOM structure and take fallback screenshot in parallel
      const [rootLayer, buffer] = await Promise.all([
        this.domExtractor.extract(page),
        page.screenshot({ fullPage: true, type: "png" }),
      ]);

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
      await page.close();
      await context.close();
    }
  }

  /**
   * Shared navigation helper: creates a context + page, navigates, waits for
   * network idle and animation settle, then returns page metadata.
   * Callers are responsible for closing page and context in a finally block.
   */
  private async navigatePage(url: string, viewportType: ViewportType): Promise<NavigatedPage> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const viewport = getViewport(viewportType);

    const context = await this.browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });

    const page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_LOAD_TIMEOUT });

    // Wait for network idle; acceptable to time out (long-polling pages etc.)
    await this.waitForNetworkIdle(page);

    // Allow animations to settle before capturing
    await page.waitForTimeout(ANIMATION_SETTLE_DELAY);

    // Evaluated inside the browser – document is available there.
    // Cast because tsconfig targets Node (no DOM lib).
    const dimensions = (await page.evaluate(
      "({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })",
    )) as { width: number; height: number };

    return { page, context, dimensions };
  }

  private async waitForNetworkIdle(page: Page): Promise<void> {
    try {
      await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT });
    } catch {
      // Network idle timeout is acceptable — the page might have long-polling
      console.error("[ScreenshotService] Network idle timeout - continuing anyway");
    }
  }
}
