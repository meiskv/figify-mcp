import type { Page } from "playwright";
import type { FigmaColor, FigmaFill, FrameLayer, Layer, TextLayer } from "../types/layers.js";

// DOM extraction script that runs in browser context
const EXTRACTION_SCRIPT = `
(function extractDOM() {
  const TEXT_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'A', 'LABEL', 'BUTTON', 'LI', 'TD', 'TH', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'CODE', 'PRE']);
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME', 'VIDEO', 'AUDIO', 'CANVAS', 'MAP', 'OBJECT', 'EMBED']);

  let idCounter = 0;

  function generateId() {
    return 'layer_' + (++idCounter);
  }

  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    // Parse rgb/rgba
    const rgbaMatch = colorStr.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]) / 255,
        g: parseInt(rgbaMatch[2]) / 255,
        b: parseInt(rgbaMatch[3]) / 255,
        a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1
      };
    }

    return null;
  }

  function isVisible(el, styles) {
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    return true;
  }

  function hasDirectText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        return true;
      }
    }
    return false;
  }

  function getDirectText(el) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  function parseBackground(styles) {
    const bgColor = parseColor(styles.backgroundColor);
    if (bgColor && bgColor.a > 0) {
      return [{ type: 'SOLID', color: bgColor, opacity: bgColor.a }];
    }
    return [];
  }

  function getElementName(el) {
    const tag = el.tagName.toLowerCase();
    const className = el.className && typeof el.className === 'string'
      ? el.className.split(' ').filter(c => c && !c.startsWith('__')).slice(0, 2).join('.')
      : '';
    const id = el.id ? '#' + el.id : '';
    return tag + (id || (className ? '.' + className : ''));
  }

  function extractElement(el, parentRect) {
    if (el.nodeType !== Node.ELEMENT_NODE) return null;
    if (SKIP_TAGS.has(el.tagName)) return null;

    const styles = getComputedStyle(el);
    if (!isVisible(el, styles)) return null;

    const rect = el.getBoundingClientRect();
    const x = parentRect ? rect.left - parentRect.left : rect.left;
    const y = parentRect ? rect.top - parentRect.top : rect.top;

    const base = {
      id: generateId(),
      name: getElementName(el),
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };

    // Check if this is a text element
    if (TEXT_TAGS.has(el.tagName) && hasDirectText(el)) {
      const text = getDirectText(el);
      if (text) {
        const textColor = parseColor(styles.color) || { r: 0, g: 0, b: 0 };
        const fontSize = parseFloat(styles.fontSize) || 16;
        const fontWeight = parseInt(styles.fontWeight) || 400;
        const fontFamily = styles.fontFamily.split(',')[0].replace(/["']/g, '').trim() || 'Inter';

        // Map CSS text-align to Figma
        let textAlign = 'LEFT';
        if (styles.textAlign === 'center') textAlign = 'CENTER';
        else if (styles.textAlign === 'right') textAlign = 'RIGHT';
        else if (styles.textAlign === 'justify') textAlign = 'JUSTIFIED';

        return {
          ...base,
          type: 'TEXT',
          characters: text,
          fontSize,
          fontFamily,
          fontWeight,
          textColor,
          textAlign
        };
      }
    }

    // Container element (FRAME)
    const fills = parseBackground(styles);
    const borderRadius = parseFloat(styles.borderRadius) || 0;

    // Extract children
    const children = [];
    for (const child of el.children) {
      const extracted = extractElement(child, rect);
      if (extracted) {
        children.push(extracted);
      }
    }

    // Skip empty frames with no visual content
    if (children.length === 0 && fills.length === 0 && borderRadius === 0) {
      return null;
    }

    return {
      ...base,
      type: 'FRAME',
      children,
      fills,
      cornerRadius: borderRadius > 0 ? borderRadius : undefined
    };
  }

  // Start extraction from body
  const body = document.body;
  const bodyRect = body.getBoundingClientRect();

  const rootLayer = {
    id: 'root',
    name: 'root',
    type: 'FRAME',
    x: 0,
    y: 0,
    width: Math.round(bodyRect.width),
    height: Math.round(bodyRect.height),
    children: [],
    fills: parseBackground(getComputedStyle(body))
  };

  for (const child of body.children) {
    const extracted = extractElement(child, bodyRect);
    if (extracted) {
      rootLayer.children.push(extracted);
    }
  }

  return rootLayer;
})()
`;

export class DOMExtractor {
  /**
   * Extract DOM structure from a page as a layer tree
   */
  async extract(page: Page): Promise<FrameLayer> {
    console.error("[DOMExtractor] Extracting DOM structure");

    const result = await page.evaluate(EXTRACTION_SCRIPT);
    const rootLayer = result as FrameLayer;

    const layerCount = this.countLayers(rootLayer);
    console.error(`[DOMExtractor] Extracted ${layerCount} layers`);

    return rootLayer;
  }

  /**
   * Count total layers in the tree
   */
  private countLayers(layer: Layer): number {
    let count = 1;
    if (layer.type === "FRAME" && layer.children) {
      for (const child of layer.children) {
        count += this.countLayers(child);
      }
    }
    return count;
  }
}
