import type { Page } from "playwright";
import type { FigmaFill, FrameLayer, Layer, TextLayer } from "../types/layers.js";

// ─── Browser-side extraction script ──────────────────────────────────────────
// Written as a template literal so regexes don't need double-escaping.
// Runs inside page.evaluate() — must be plain JS (no imports, no TS syntax).

const EXTRACTION_SCRIPT = /* js */ `
(function extractDOM() {
  const TEXT_TAGS = new Set(['P','H1','H2','H3','H4','H5','H6','SPAN','A','LABEL','BUTTON','LI','TD','TH','STRONG','EM','B','I','SMALL','CODE','PRE']);
  const SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','IFRAME','VIDEO','AUDIO','CANVAS','MAP','OBJECT','EMBED']);
  const MAX_BORDER_RADIUS = 1000; // Tailwind rounded-full = 9999px; cap for Figma

  let idCounter = 0;
  function generateId() { return 'layer_' + (++idCounter); }

  // ── Color parsing ────────────────────────────────────────────────────────────

  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;

    // Handles both modern (space-separated) and legacy (comma-separated) rgb/rgba:
    //   rgb(255 0 0) / rgba(255 0 0 / 0.5) / rgb(255, 0, 0) / rgba(255, 0, 0, 0.5)
    const rgbMatch = colorStr.match(/rgba?\\(([\\d.]+)[,\\s]\\s*([\\d.]+)[,\\s]\\s*([\\d.]+)(?:[,\\s\\/]\\s*([\\d.]+))?\\)/);
    if (rgbMatch) {
      return {
        r: parseFloat(rgbMatch[1]) / 255,
        g: parseFloat(rgbMatch[2]) / 255,
        b: parseFloat(rgbMatch[3]) / 255,
        a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
      };
    }

    // oklab(L a b / alpha) — Tailwind CSS v3+
    const oklabMatch = colorStr.match(/oklab\\(([\\d.]+)\\s+([\\d.-]+)\\s+([\\d.-]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if (oklabMatch) {
      const L = parseFloat(oklabMatch[1]), a = parseFloat(oklabMatch[2]), b = parseFloat(oklabMatch[3]);
      const alpha = oklabMatch[4] !== undefined ? parseFloat(oklabMatch[4]) : 1;
      const l_ = L + 0.3963377774*a + 0.2158037573*b;
      const m_ = L - 0.1055613458*a - 0.0638541728*b;
      const s_ = L - 0.0894841775*a - 1.2914855480*b;
      const l3 = l_*l_*l_, m3 = m_*m_*m_, s3 = s_*s_*s_;
      return {
        r: Math.max(0, Math.min(1,  4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3)),
        g: Math.max(0, Math.min(1, -1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3)),
        b: Math.max(0, Math.min(1, -0.0041960863*l3 - 0.7034186147*m3 + 1.7076147010*s3)),
        a: alpha,
      };
    }

    // lab(L a b / alpha) — CIELAB (e.g. Tailwind purples)
    const labMatch = colorStr.match(/lab\\(([\\d.]+)\\s+([\\d.-]+)\\s+([\\d.-]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if (labMatch) {
      const L = parseFloat(labMatch[1]), a = parseFloat(labMatch[2]), bLab = parseFloat(labMatch[3]);
      const alpha = labMatch[4] !== undefined ? parseFloat(labMatch[4]) : 1;
      const fy = (L + 16) / 116, fx = a/500 + fy, fz = fy - bLab/200;
      const cube = f => f > 0.206897 ? f*f*f : (f - 16/116) / 7.787;
      const X = cube(fx) * 0.95047;
      const Y = (L > 8 ? Math.pow((L+16)/116, 3) : L/903.3) * 1.0;
      const Z = cube(fz) * 1.08883;
      const gamma = c => c > 0.0031308 ? 1.055*Math.pow(c, 1/2.4) - 0.055 : 12.92*c;
      return {
        r: Math.max(0, Math.min(1, gamma( 3.2406*X - 1.5372*Y - 0.4986*Z))),
        g: Math.max(0, Math.min(1, gamma(-0.9689*X + 1.8758*Y + 0.0415*Z))),
        b: Math.max(0, Math.min(1, gamma( 0.0557*X - 0.2040*Y + 1.0570*Z))),
        a: alpha,
      };
    }

    // #rgb / #rrggbb / #rrggbbaa
    const hexMatch = colorStr.match(/^#([a-fA-F0-9]{3,8})$/);
    if (hexMatch) {
      const h = hexMatch[1];
      if (h.length === 3) return { r: parseInt(h[0]+h[0],16)/255, g: parseInt(h[1]+h[1],16)/255, b: parseInt(h[2]+h[2],16)/255, a: 1 };
      if (h.length === 6) return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: 1 };
      if (h.length === 8) return { r: parseInt(h.slice(0,2),16)/255, g: parseInt(h.slice(2,4),16)/255, b: parseInt(h.slice(4,6),16)/255, a: parseInt(h.slice(6,8),16)/255 };
    }

    return null;
  }

  // ── Visibility ───────────────────────────────────────────────────────────────

  function isVisible(el, styles) {
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // ── Text helpers ─────────────────────────────────────────────────────────────

  /** Returns trimmed direct-text-node content, or null if none. */
  function getDirectText(el) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? '';
    }
    const trimmed = text.trim();
    return trimmed || null;
  }

  // ── Style parsers ────────────────────────────────────────────────────────────

  function parseBackground(styles) {
    const bgColor = parseColor(styles.backgroundColor);
    if (bgColor && bgColor.a > 0) return [{ type: 'SOLID', color: bgColor, opacity: bgColor.a }];

    // Gradient fallback: extract the first parseable color token
    const bgImage = styles.backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
      const tokens = bgImage.match(/(?:rgba?|lab|oklab)\\([^)]+\\)|#[a-fA-F0-9]{3,8}/g);
      if (tokens) {
        for (const token of tokens) {
          const color = parseColor(token);
          if (color && color.a > 0) return [{ type: 'SOLID', color, opacity: color.a }];
        }
      }
    }

    return [];
  }

  function parseBorder(styles) {
    const borderWidth = parseFloat(styles.borderTopWidth) || 0;
    if (borderWidth === 0) return { strokes: [], strokeWeight: 0 };
    const borderColor = parseColor(styles.borderTopColor);
    if (!borderColor) return { strokes: [], strokeWeight: 0 };
    return { strokes: [{ type: 'SOLID', color: borderColor }], strokeWeight: borderWidth };
  }

  function parseBoxShadow(styles) {
    const boxShadow = styles.boxShadow;
    if (!boxShadow || boxShadow === 'none') return [];

    const effects = [];
    // Split on commas not inside parentheses (avoids splitting inside color functions)
    for (const shadow of boxShadow.split(/,(?![^(]*\\))/)) {
      const trimmed = shadow.trim();
      if (!trimmed) continue;

      const rgbToken = trimmed.match(/rgba?\\([^)]+\\)/)?.[0];
      const hexToken = !rgbToken ? trimmed.match(/#[a-fA-F0-9]{3,8}/)?.[0] : undefined;
      const colorToken = rgbToken ?? hexToken;
      if (!colorToken) continue;

      const color = parseColor(colorToken);
      if (!color) continue;

      const values = trimmed.replace(colorToken, '').match(/-?[\\d.]+px/g);
      if (!values || values.length < 2) continue;

      effects.push({
        type: 'DROP_SHADOW',
        color,
        offset: { x: parseFloat(values[0]) || 0, y: parseFloat(values[1]) || 0 },
        radius: values[2] ? parseFloat(values[2]) : 0,
        spread: values[3] ? parseFloat(values[3]) : 0,
        visible: true,
        blendMode: 'NORMAL',
      });
    }
    return effects;
  }

  function parseFlexbox(styles, hasChildren) {
    const display = styles.display;
    const isFlex  = display === 'flex'  || display === 'inline-flex';
    const isGrid  = display === 'grid'  || display === 'inline-grid';
    const isBlock = display === 'block' || display === 'inline-block';

    if (!isFlex && !isGrid && !(isBlock && hasChildren)) return null;

    let layoutMode = 'VERTICAL'; // default for block / column-flex
    let primaryAxisAlignItems = 'MIN';
    let counterAxisAlignItems = 'MIN';

    if (isFlex) {
      const dir = styles.flexDirection;
      layoutMode = (dir === 'column' || dir === 'column-reverse') ? 'VERTICAL' : 'HORIZONTAL';

      const jc = styles.justifyContent;
      if      (jc === 'center')                          primaryAxisAlignItems = 'CENTER';
      else if (jc === 'flex-end' || jc === 'end')        primaryAxisAlignItems = 'MAX';
      else if (jc === 'space-between')                   primaryAxisAlignItems = 'SPACE_BETWEEN';

      const ai = styles.alignItems;
      if      (ai === 'center')                          counterAxisAlignItems = 'CENTER';
      else if (ai === 'flex-end' || ai === 'end')        counterAxisAlignItems = 'MAX';

    } else if (isGrid) {
      layoutMode = styles.gridAutoFlow.includes('column') ? 'VERTICAL' : 'HORIZONTAL';

      if      (styles.justifyItems === 'center')         primaryAxisAlignItems = 'CENTER';
      else if (styles.justifyItems === 'end')            primaryAxisAlignItems = 'MAX';

      if      (styles.alignItems === 'center')           counterAxisAlignItems = 'CENTER';
      else if (styles.alignItems === 'end')              counterAxisAlignItems = 'MAX';
    }
    // isBlock + hasChildren: keep defaults (VERTICAL, MIN, MIN)

    return {
      layoutMode,
      primaryAxisAlignItems,
      counterAxisAlignItems,
      paddingLeft:   Math.round(parseFloat(styles.paddingLeft)   || 0),
      paddingRight:  Math.round(parseFloat(styles.paddingRight)  || 0),
      paddingTop:    Math.round(parseFloat(styles.paddingTop)    || 0),
      paddingBottom: Math.round(parseFloat(styles.paddingBottom) || 0),
      itemSpacing:   Math.round(parseFloat(styles.gap) || parseFloat(styles.columnGap) || parseFloat(styles.rowGap) || 0),
    };
  }

  /**
   * Determine Figma sizing mode for a child element.
   * Accepts already-computed styles for both child and parent to avoid
   * redundant getComputedStyle() calls.
   */
  function parseChildSizing(childStyles, parentStyles) {
    const parentDisplay = parentStyles?.display ?? '';
    const isInFlex  = parentDisplay === 'flex'  || parentDisplay === 'inline-flex';
    const isInGrid  = parentDisplay === 'grid'  || parentDisplay === 'inline-grid';
    const isInBlock = parentDisplay === 'block' || parentDisplay === 'inline-block';

    let layoutSizingHorizontal = 'HUG';
    let layoutSizingVertical   = 'HUG';

    if (isInFlex) {
      const flexGrow  = parseFloat(childStyles.flexGrow) || 0;
      const parentDir = parentStyles?.flexDirection ?? 'row';
      const isHorizontal = parentDir === 'row' || parentDir === 'row-reverse';

      if (flexGrow > 0) {
        if (isHorizontal) layoutSizingHorizontal = 'FILL';
        else              layoutSizingVertical   = 'FILL';
      }
      if (childStyles.width  === '100%') layoutSizingHorizontal = 'FILL';
      if (childStyles.height === '100%') layoutSizingVertical   = 'FILL';

    } else if (isInGrid) {
      layoutSizingHorizontal = 'FILL'; // grid children fill their cell horizontally

    } else if (isInBlock) {
      layoutSizingHorizontal = 'FILL'; // block children fill width like normal flow
    }

    return { layoutSizingHorizontal, layoutSizingVertical };
  }

  function getElementName(el) {
    const tag = el.tagName.toLowerCase();
    // Strip Next.js/Tailwind internal class prefixes (__) to keep names readable
    const cls = el.className && typeof el.className === 'string'
      ? el.className.split(' ').filter(c => c && !c.startsWith('__')).slice(0, 2).join('.')
      : '';
    const id = el.id ? '#' + el.id : '';
    return tag + (id || (cls ? '.' + cls : ''));
  }

  // ── Main recursive extractor ─────────────────────────────────────────────────

  function extractElement(el, parentRect, parentStyles) {
    if (el.nodeType !== Node.ELEMENT_NODE) return null;
    if (SKIP_TAGS.has(el.tagName)) return null;

    const styles = getComputedStyle(el);
    if (!isVisible(el, styles)) return null;

    const rect = el.getBoundingClientRect();
    const childSizing = parseChildSizing(styles, parentStyles);

    const base = {
      id: generateId(),
      name: getElementName(el),
      x: Math.round(parentRect ? rect.left - parentRect.left : rect.left),
      y: Math.round(parentRect ? rect.top  - parentRect.top  : rect.top),
      width:  Math.round(rect.width),
      height: Math.round(rect.height),
      layoutSizingHorizontal: childSizing.layoutSizingHorizontal,
      layoutSizingVertical:   childSizing.layoutSizingVertical,
    };

    // ── Text element ──────────────────────────────────────────────────────────
    if (TEXT_TAGS.has(el.tagName)) {
      const text = getDirectText(el);
      if (text) {
        const textColor  = parseColor(styles.color) ?? { r: 0, g: 0, b: 0 };
        const fontSize   = parseFloat(styles.fontSize) || 16;
        const fontWeight = parseInt(styles.fontWeight) || 400;
        const fontFamily = styles.fontFamily.split(',')[0].replace(/["']/g, '').trim() || 'Inter';
        const alignMap   = { center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED' };
        const textAlign  = alignMap[styles.textAlign] ?? 'LEFT';

        const fills        = parseBackground(styles);
        const border       = parseBorder(styles);
        const effects      = parseBoxShadow(styles);
        const borderRadius = Math.min(parseFloat(styles.borderRadius) || 0, MAX_BORDER_RADIUS);
        const hasVisualStyling = fills.length > 0 || border.strokeWeight > 0 || effects.length > 0 || borderRadius > 0;

        const textProps = { characters: text, fontSize, fontFamily, fontWeight, textColor, textAlign };

        if (hasVisualStyling) {
          // Styled text (e.g. button) — wrap in FRAME with centered auto-layout
          return {
            ...base,
            type: 'FRAME',
            children: [{
              id: generateId(), name: 'text', type: 'TEXT',
              x: 0, y: 0, width: Math.round(rect.width), height: Math.round(rect.height),
              ...textProps,
              layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG',
            }],
            fills,
            cornerRadius:  borderRadius > 0           ? borderRadius        : undefined,
            strokes:       border.strokes.length > 0  ? border.strokes      : undefined,
            strokeWeight:  border.strokeWeight > 0    ? border.strokeWeight : undefined,
            effects:       effects.length > 0         ? effects             : undefined,
            layoutMode: 'HORIZONTAL', primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER',
            paddingLeft:   Math.round(parseFloat(styles.paddingLeft)   || 0),
            paddingRight:  Math.round(parseFloat(styles.paddingRight)  || 0),
            paddingTop:    Math.round(parseFloat(styles.paddingTop)    || 0),
            paddingBottom: Math.round(parseFloat(styles.paddingBottom) || 0),
            itemSpacing: 0,
          };
        }

        // Plain text — return TEXT layer directly
        return { ...base, type: 'TEXT', ...textProps };
      }
    }

    // ── Container (FRAME) ─────────────────────────────────────────────────────
    const fills        = parseBackground(styles);
    const borderRadius = Math.min(parseFloat(styles.borderRadius) || 0, MAX_BORDER_RADIUS);
    const border       = parseBorder(styles);
    const effects      = parseBoxShadow(styles);

    const children = [];
    for (const child of el.children) {
      const extracted = extractElement(child, rect, styles);
      if (extracted) children.push(extracted);
    }

    // Compute layout AFTER children are known (parseFlexbox needs hasChildren)
    const flexbox = parseFlexbox(styles, children.length > 0);

    // Discard empty invisible frames
    const hasVisualContent = children.length > 0 || fills.length > 0 || borderRadius > 0 || border.strokeWeight > 0 || effects.length > 0;
    if (!hasVisualContent) return null;

    return {
      ...base,
      type: 'FRAME',
      children,
      fills,
      cornerRadius:  borderRadius > 0          ? borderRadius        : undefined,
      strokes:       border.strokes.length > 0 ? border.strokes      : undefined,
      strokeWeight:  border.strokeWeight > 0   ? border.strokeWeight : undefined,
      effects:       effects.length > 0        ? effects             : undefined,
      ...(flexbox ?? {}),
    };
  }

  // ── Root extraction ──────────────────────────────────────────────────────────

  const body       = document.body;
  const bodyRect   = body.getBoundingClientRect();
  const bodyStyles = getComputedStyle(body);

  const rootChildren = [];
  for (const child of body.children) {
    const extracted = extractElement(child, bodyRect, bodyStyles);
    if (extracted) rootChildren.push(extracted);
  }

  return {
    id: 'root', name: 'root', type: 'FRAME',
    x: 0, y: 0,
    width:  Math.round(bodyRect.width),
    height: Math.round(bodyRect.height),
    children: rootChildren,
    fills: parseBackground(bodyStyles),
  };
})()
`;

// ─── Node-side DOMExtractor ───────────────────────────────────────────────────

export class DOMExtractor {
  async extract(page: Page): Promise<FrameLayer> {
    console.error("[DOMExtractor] Extracting DOM structure");

    const rootLayer = (await page.evaluate(EXTRACTION_SCRIPT)) as FrameLayer;
    const total = countLayers(rootLayer);
    console.error(`[DOMExtractor] Extracted ${total} layers`);

    debugLogLayers(rootLayer, 0, 3);

    return rootLayer;
  }
}

// ─── Node-side helpers ────────────────────────────────────────────────────────

function debugLogLayers(layer: Layer, depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;

  const indent = "  ".repeat(depth);
  const frame = layer.type === "FRAME" ? (layer as FrameLayer) : null;

  console.error(
    `${indent}[Layer] ${layer.name} (${layer.type}) - fills: ${frame?.fills?.length ?? 0}, strokes: ${frame?.strokes?.length ?? 0}, effects: ${frame?.effects?.length ?? 0}`,
  );

  if (layer.type === "TEXT") {
    const t = layer as TextLayer;
    console.error(
      `${indent}  text color: r=${t.textColor?.r?.toFixed(2)}, g=${t.textColor?.g?.toFixed(2)}, b=${t.textColor?.b?.toFixed(2)}`,
    );
  }

  const fills = frame?.fills as FigmaFill[] | undefined;
  if (fills && fills.length > 0) {
    const c = fills[0].color;
    console.error(
      `${indent}  fill: r=${c.r?.toFixed(2)}, g=${c.g?.toFixed(2)}, b=${c.b?.toFixed(2)}, a=${c.a?.toFixed(2)}`,
    );
  }

  if (frame) {
    for (const child of frame.children) {
      debugLogLayers(child, depth + 1, maxDepth);
    }
  }
}

function countLayers(layer: Layer): number {
  if (layer.type !== "FRAME") return 1;
  return 1 + (layer as FrameLayer).children.reduce((sum, c) => sum + countLayers(c), 0);
}
