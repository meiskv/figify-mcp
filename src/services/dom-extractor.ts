import type { Page } from "playwright";
import type { FigmaFill, FrameLayer, Layer, TextLayer } from "../types/layers.js";

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

    // Parse modern CSS format: rgb(255 255 255 / 0.1) or rgb(255 255 255)
    const modernMatch = colorStr.match(/rgba?\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if (modernMatch) {
      return {
        r: parseFloat(modernMatch[1]) / 255,
        g: parseFloat(modernMatch[2]) / 255,
        b: parseFloat(modernMatch[3]) / 255,
        a: modernMatch[4] !== undefined ? parseFloat(modernMatch[4]) : 1
      };
    }

    // Parse legacy format: rgba(255, 255, 255, 0.1) or rgb(255, 255, 255)
    const legacyMatch = colorStr.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (legacyMatch) {
      return {
        r: parseFloat(legacyMatch[1]) / 255,
        g: parseFloat(legacyMatch[2]) / 255,
        b: parseFloat(legacyMatch[3]) / 255,
        a: legacyMatch[4] !== undefined ? parseFloat(legacyMatch[4]) : 1
      };
    }

    // Parse oklab format: oklab(0.999 0.0001 0.0001 / 0.1) - Tailwind CSS v3+
    const oklabMatch = colorStr.match(/oklab\\(([\\d.]+)\\s+([\\d.-]+)\\s+([\\d.-]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if (oklabMatch) {
      // Convert oklab to sRGB (simplified approximation)
      const L = parseFloat(oklabMatch[1]);
      const a = parseFloat(oklabMatch[2]);
      const b = parseFloat(oklabMatch[3]);
      const alpha = oklabMatch[4] !== undefined ? parseFloat(oklabMatch[4]) : 1;

      // Approximate conversion: oklab L=1 is white, L=0 is black
      // For simplicity, use L as grayscale when a,b are near zero
      // This handles most Tailwind colors reasonably
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;

      const r = Math.max(0, Math.min(1, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s));
      const g = Math.max(0, Math.min(1, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s));
      const bVal = Math.max(0, Math.min(1, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s));

      return { r, g, b: bVal, a: alpha };
    }

    // Parse lab format: lab(43.0295 75.21 -86.5669) - Tailwind purple, etc.
    const labMatch = colorStr.match(/lab\\(([\\d.]+)\\s+([\\d.-]+)\\s+([\\d.-]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if (labMatch) {
      // Convert CIELAB to sRGB
      const L = parseFloat(labMatch[1]);
      const a = parseFloat(labMatch[2]);
      const bLab = parseFloat(labMatch[3]);
      const alpha = labMatch[4] !== undefined ? parseFloat(labMatch[4]) : 1;

      // Lab to XYZ
      const fy = (L + 16) / 116;
      const fx = a / 500 + fy;
      const fz = fy - bLab / 200;

      const xr = fx > 0.206897 ? fx * fx * fx : (fx - 16/116) / 7.787;
      const yr = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
      const zr = fz > 0.206897 ? fz * fz * fz : (fz - 16/116) / 7.787;

      // D65 white point
      const X = xr * 0.95047;
      const Y = yr * 1.0;
      const Z = zr * 1.08883;

      // XYZ to sRGB
      let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
      let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
      let bVal = 0.0557 * X + 0.2040 * Y + 1.0570 * Z;

      // Gamma correction
      const gamma = (c) => c > 0.0031308 ? 1.055 * Math.pow(c, 1/2.4) - 0.055 : 12.92 * c;
      r = Math.max(0, Math.min(1, gamma(r)));
      g = Math.max(0, Math.min(1, gamma(g)));
      bVal = Math.max(0, Math.min(1, gamma(bVal)));

      return { r, g, b: bVal, a: alpha };
    }

    // Parse hex colors: #fff, #ffffff, #ffffffff
    const hexMatch = colorStr.match(/^#([a-fA-F0-9]{3,8})$/);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16) / 255,
          g: parseInt(hex[1] + hex[1], 16) / 255,
          b: parseInt(hex[2] + hex[2], 16) / 255,
          a: 1
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: 1
        };
      } else if (hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: parseInt(hex.slice(6, 8), 16) / 255
        };
      }
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

    // Try to extract first color from gradient as fallback
    const bgImage = styles.backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
      // Extract colors from gradient - try multiple formats
      // Match rgb(), rgba(), lab(), oklab(), and hex colors
      const colorMatches = bgImage.match(/rgba?\\([^)]+\\)|lab\\([^)]+\\)|oklab\\([^)]+\\)|#[a-fA-F0-9]{3,8}/g);
      if (colorMatches && colorMatches.length > 0) {
        // Try to parse the first color we find
        for (const colorStr of colorMatches) {
          const gradientColor = parseColor(colorStr);
          if (gradientColor && gradientColor.a > 0) {
            return [{ type: 'SOLID', color: gradientColor, opacity: gradientColor.a }];
          }
        }
      }
    }

    return [];
  }

  function parseBorder(styles) {
    // Parse border - use borderTopWidth as representative
    const borderWidth = parseFloat(styles.borderTopWidth) || 0;
    if (borderWidth === 0) return { strokes: [], strokeWeight: 0 };

    const borderColor = parseColor(styles.borderTopColor);
    if (!borderColor) return { strokes: [], strokeWeight: 0 };

    return {
      strokes: [{ type: 'SOLID', color: borderColor }],
      strokeWeight: borderWidth
    };
  }

  function parseBoxShadow(styles) {
    const boxShadow = styles.boxShadow;
    if (!boxShadow || boxShadow === 'none') return [];

    const effects = [];

    // Split multiple shadows by comma (but not commas inside rgba)
    const shadows = boxShadow.split(/,(?![^(]*\\))/);

    for (const shadow of shadows) {
      const trimmed = shadow.trim();
      if (!trimmed) continue;

      // Extract color (can be at start or end)
      let color = null;
      let rest = trimmed;

      // Try to find rgba/rgb color
      const rgbMatch = trimmed.match(/rgba?\\([^)]+\\)/);
      if (rgbMatch) {
        color = parseColor(rgbMatch[0]);
        rest = trimmed.replace(rgbMatch[0], '').trim();
      } else {
        // Try hex color
        const hexMatch = trimmed.match(/#[a-fA-F0-9]{3,8}/);
        if (hexMatch) {
          color = parseColor(hexMatch[0]);
          rest = trimmed.replace(hexMatch[0], '').trim();
        }
      }

      if (!color) continue;

      // Parse the numeric values (offsetX offsetY blur spread?)
      const values = rest.match(/-?[\\d.]+px/g);
      if (!values || values.length < 2) continue;

      const offsetX = parseFloat(values[0]) || 0;
      const offsetY = parseFloat(values[1]) || 0;
      const blur = values[2] ? parseFloat(values[2]) : 0;
      const spread = values[3] ? parseFloat(values[3]) : 0;

      effects.push({
        type: 'DROP_SHADOW',
        color: color,
        offset: { x: offsetX, y: offsetY },
        radius: blur,
        spread: spread,
        visible: true,
        blendMode: 'NORMAL'
      });
    }

    return effects;
  }

  function parseFlexbox(styles) {
    const display = styles.display;
    const isFlex = display === 'flex' || display === 'inline-flex';
    const isGrid = display === 'grid' || display === 'inline-grid';

    if (!isFlex && !isGrid) {
      return null;
    }

    let layoutMode = 'HORIZONTAL';
    let primaryAxisAlignItems = 'MIN';
    let counterAxisAlignItems = 'MIN';

    if (isFlex) {
      // Map flex-direction to Figma layoutMode
      const flexDirection = styles.flexDirection;
      layoutMode = (flexDirection === 'column' || flexDirection === 'column-reverse')
        ? 'VERTICAL'
        : 'HORIZONTAL';

      // Map justify-content to primaryAxisAlignItems
      const justifyContent = styles.justifyContent;
      if (justifyContent === 'center') primaryAxisAlignItems = 'CENTER';
      else if (justifyContent === 'flex-end' || justifyContent === 'end') primaryAxisAlignItems = 'MAX';
      else if (justifyContent === 'space-between') primaryAxisAlignItems = 'SPACE_BETWEEN';

      // Map align-items to counterAxisAlignItems
      const alignItems = styles.alignItems;
      if (alignItems === 'center') counterAxisAlignItems = 'CENTER';
      else if (alignItems === 'flex-end' || alignItems === 'end') counterAxisAlignItems = 'MAX';
    } else if (isGrid) {
      // For grid, determine direction from grid-auto-flow or template
      const gridAutoFlow = styles.gridAutoFlow;
      layoutMode = gridAutoFlow.includes('column') ? 'VERTICAL' : 'HORIZONTAL';

      // Grid alignment
      const justifyItems = styles.justifyItems;
      if (justifyItems === 'center') primaryAxisAlignItems = 'CENTER';
      else if (justifyItems === 'end') primaryAxisAlignItems = 'MAX';

      const alignItems = styles.alignItems;
      if (alignItems === 'center') counterAxisAlignItems = 'CENTER';
      else if (alignItems === 'end') counterAxisAlignItems = 'MAX';
    }

    // Extract padding
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;

    // Extract gap (itemSpacing)
    const gap = parseFloat(styles.gap) || parseFloat(styles.columnGap) || parseFloat(styles.rowGap) || 0;

    return {
      layoutMode,
      primaryAxisAlignItems,
      counterAxisAlignItems,
      paddingLeft: Math.round(paddingLeft),
      paddingRight: Math.round(paddingRight),
      paddingTop: Math.round(paddingTop),
      paddingBottom: Math.round(paddingBottom),
      itemSpacing: Math.round(gap)
    };
  }

  function parseChildSizing(el, parentStyles) {
    const styles = getComputedStyle(el);
    const parentDisplay = parentStyles?.display || '';
    const isInFlex = parentDisplay === 'flex' || parentDisplay === 'inline-flex';
    const isInGrid = parentDisplay === 'grid' || parentDisplay === 'inline-grid';

    if (!isInFlex && !isInGrid) {
      return { layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' };
    }

    let layoutSizingHorizontal = 'FIXED';
    let layoutSizingVertical = 'FIXED';

    if (isInFlex) {
      const flexGrow = parseFloat(styles.flexGrow) || 0;
      const flexDirection = parentStyles.flexDirection || 'row';
      const isHorizontal = flexDirection === 'row' || flexDirection === 'row-reverse';

      // Check if child should fill
      if (flexGrow > 0) {
        if (isHorizontal) {
          layoutSizingHorizontal = 'FILL';
        } else {
          layoutSizingVertical = 'FILL';
        }
      }

      // Check width/height 100%
      if (styles.width === '100%') layoutSizingHorizontal = 'FILL';
      if (styles.height === '100%') layoutSizingVertical = 'FILL';
    }

    if (isInGrid) {
      // Grid children typically fill their cell
      layoutSizingHorizontal = 'FILL';
      layoutSizingVertical = 'HUG';
    }

    return { layoutSizingHorizontal, layoutSizingVertical };
  }

  function getElementName(el) {
    const tag = el.tagName.toLowerCase();
    const className = el.className && typeof el.className === 'string'
      ? el.className.split(' ').filter(c => c && !c.startsWith('__')).slice(0, 2).join('.')
      : '';
    const id = el.id ? '#' + el.id : '';
    return tag + (id || (className ? '.' + className : ''));
  }

  function extractElement(el, parentRect, parentStyles) {
    if (el.nodeType !== Node.ELEMENT_NODE) return null;
    if (SKIP_TAGS.has(el.tagName)) return null;

    const styles = getComputedStyle(el);
    if (!isVisible(el, styles)) return null;

    const rect = el.getBoundingClientRect();
    const x = parentRect ? rect.left - parentRect.left : rect.left;
    const y = parentRect ? rect.top - parentRect.top : rect.top;

    // Get child sizing if parent uses flexbox/grid
    const childSizing = parseChildSizing(el, parentStyles);

    const base = {
      id: generateId(),
      name: getElementName(el),
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      layoutSizingHorizontal: childSizing.layoutSizingHorizontal,
      layoutSizingVertical: childSizing.layoutSizingVertical
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

        // Check if element has visual styling (border, background, shadow)
        const fills = parseBackground(styles);
        const border = parseBorder(styles);
        const effects = parseBoxShadow(styles);
        // Cap borderRadius at 1000 (Tailwind's rounded-full uses huge values)
        const borderRadius = Math.min(parseFloat(styles.borderRadius) || 0, 1000);
        const hasVisualStyling = fills.length > 0 || border.strokeWeight > 0 || effects.length > 0 || borderRadius > 0;

        // If element has visual styling, create a FRAME with TEXT child
        if (hasVisualStyling) {
          const textChild = {
            id: generateId(),
            name: 'text',
            type: 'TEXT',
            x: 0,
            y: 0,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            characters: text,
            fontSize,
            fontFamily,
            fontWeight,
            textColor,
            textAlign
          };

          return {
            ...base,
            type: 'FRAME',
            children: [textChild],
            fills,
            cornerRadius: borderRadius > 0 ? borderRadius : undefined,
            strokes: border.strokes.length > 0 ? border.strokes : undefined,
            strokeWeight: border.strokeWeight > 0 ? border.strokeWeight : undefined,
            effects: effects.length > 0 ? effects : undefined
          };
        }

        // No visual styling - return plain TEXT layer
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
    // Cap borderRadius at 1000 (Tailwind's rounded-full uses huge values like 9999px)
    const borderRadius = Math.min(parseFloat(styles.borderRadius) || 0, 1000);
    const border = parseBorder(styles);
    const effects = parseBoxShadow(styles);
    const flexbox = parseFlexbox(styles);

    // Extract children - pass current element's styles as parentStyles
    const children = [];
    for (const child of el.children) {
      const extracted = extractElement(child, rect, styles);
      if (extracted) {
        children.push(extracted);
      }
    }

    // Skip empty frames with no visual content
    const hasVisualContent = children.length > 0 || fills.length > 0 || borderRadius > 0 || border.strokeWeight > 0 || effects.length > 0;
    if (!hasVisualContent) {
      return null;
    }

    const frameResult = {
      ...base,
      type: 'FRAME',
      children,
      fills,
      cornerRadius: borderRadius > 0 ? borderRadius : undefined,
      strokes: border.strokes.length > 0 ? border.strokes : undefined,
      strokeWeight: border.strokeWeight > 0 ? border.strokeWeight : undefined,
      effects: effects.length > 0 ? effects : undefined
    };

    // Add Auto Layout properties if element uses flexbox
    if (flexbox) {
      frameResult.layoutMode = flexbox.layoutMode;
      frameResult.primaryAxisAlignItems = flexbox.primaryAxisAlignItems;
      frameResult.counterAxisAlignItems = flexbox.counterAxisAlignItems;
      frameResult.paddingLeft = flexbox.paddingLeft;
      frameResult.paddingRight = flexbox.paddingRight;
      frameResult.paddingTop = flexbox.paddingTop;
      frameResult.paddingBottom = flexbox.paddingBottom;
      frameResult.itemSpacing = flexbox.itemSpacing;
    }

    return frameResult;
  }

  // Start extraction from body
  const body = document.body;
  const bodyRect = body.getBoundingClientRect();
  const bodyStyles = getComputedStyle(body);

  const rootLayer = {
    id: 'root',
    name: 'root',
    type: 'FRAME',
    x: 0,
    y: 0,
    width: Math.round(bodyRect.width),
    height: Math.round(bodyRect.height),
    children: [],
    fills: parseBackground(bodyStyles)
  };

  for (const child of body.children) {
    const extracted = extractElement(child, bodyRect, bodyStyles);
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

    // Debug: Log sample of extracted data to see if styles are captured
    this.debugLogLayers(rootLayer, 0, 3);

    return rootLayer;
  }

  /**
   * Debug: Log layer details to see what's being extracted
   */
  private debugLogLayers(layer: Layer, depth: number, maxDepth: number): void {
    if (depth > maxDepth) return;

    const indent = "  ".repeat(depth);
    // Use any to access optional properties that exist on multiple types
    // biome-ignore lint/suspicious/noExplicitAny: Debug logging needs flexible access
    const anyLayer = layer as any;
    const fills = anyLayer.fills as FigmaFill[] | undefined;
    const strokes = anyLayer.strokes;
    const effects = anyLayer.effects;

    console.error(
      `${indent}[Layer] ${layer.name} (${layer.type}) - fills: ${fills?.length ?? 0}, strokes: ${strokes?.length ?? 0}, effects: ${effects?.length ?? 0}`
    );

    if (layer.type === "TEXT") {
      const textLayer = layer as TextLayer;
      console.error(`${indent}  text color: r=${textLayer.textColor?.r?.toFixed(2)}, g=${textLayer.textColor?.g?.toFixed(2)}, b=${textLayer.textColor?.b?.toFixed(2)}`);
    }

    if (fills && fills.length > 0) {
      console.error(`${indent}  fill: r=${fills[0].color.r?.toFixed(2)}, g=${fills[0].color.g?.toFixed(2)}, b=${fills[0].color.b?.toFixed(2)}, a=${fills[0].color.a?.toFixed(2)}`);
    }

    if (layer.type === "FRAME" && (layer as FrameLayer).children) {
      for (const child of (layer as FrameLayer).children) {
        this.debugLogLayers(child, depth + 1, maxDepth);
      }
    }
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
