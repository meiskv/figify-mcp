// Figma plugin code - runs in the Figma sandbox

interface Screenshot {
  viewport: string;
  width: number;
  height: number;
  data: string; // base64 encoded PNG
}

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaFill {
  type: "SOLID";
  color: FigmaColor;
  opacity?: number;
}

interface FigmaStroke {
  type: "SOLID";
  color: FigmaColor;
}

interface FigmaDropShadow {
  type: "DROP_SHADOW";
  color: FigmaColor;
  offset: { x: number; y: number };
  radius: number;
  spread?: number;
  visible: boolean;
  blendMode: "NORMAL";
}

interface BaseLayer {
  id: string;
  name: string;
  type: "FRAME" | "TEXT" | "RECTANGLE";
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameLayer extends BaseLayer {
  type: "FRAME";
  children: Layer[];
  fills?: FigmaFill[];
  cornerRadius?: number;
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  effects?: FigmaDropShadow[];
  // Auto Layout properties
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX";
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
}

interface TextLayer extends BaseLayer {
  type: "TEXT";
  characters: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  textColor: FigmaColor;
  textAlign?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
}

interface RectangleLayer extends BaseLayer {
  type: "RECTANGLE";
  fills?: FigmaFill[];
  cornerRadius?: number;
  strokes?: FigmaStroke[];
  strokeWeight?: number;
  effects?: FigmaDropShadow[];
}

type Layer = FrameLayer | TextLayer | RectangleLayer;

interface FigmaLayerTree {
  name: string;
  viewport: string;
  width: number;
  height: number;
  rootLayer: FrameLayer;
  screenshotFallback?: string;
}

interface CreateFrameMessage {
  type: "CREATE_FRAME";
  id: string;
  name: string;
  screenshots: Screenshot[];
}

interface CreateLayersMessage {
  type: "CREATE_LAYERS";
  id: string;
  name: string;
  layers: FigmaLayerTree[];
}

type PluginMessage = CreateFrameMessage | CreateLayersMessage;

// Show the UI
figma.showUI(__html__, {
  width: 320,
  height: 360,
  themeColors: true,
});

// Handle messages from the UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "CREATE_FRAME") {
    try {
      const frameId = await createFrameWithScreenshots(msg.name, msg.screenshots);
      figma.ui.postMessage({
        type: "FRAME_CREATED",
        id: msg.id,
        frameId,
      });
    } catch (error) {
      figma.ui.postMessage({
        type: "ERROR",
        id: msg.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (msg.type === "CREATE_LAYERS") {
    try {
      const result = await createFrameWithLayers(msg.name, msg.layers);
      figma.ui.postMessage({
        type: "LAYERS_CREATED",
        id: msg.id,
        frameId: result.frameId,
        layersCreated: result.layersCreated,
      });
    } catch (error) {
      figma.ui.postMessage({
        type: "ERROR",
        id: msg.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

async function createFrameWithScreenshots(
  name: string,
  screenshots: Screenshot[],
): Promise<string> {
  // Calculate total width and max height for layout
  const gap = 40;
  let totalWidth = 0;
  let maxHeight = 0;

  for (const screenshot of screenshots) {
    totalWidth += screenshot.width + gap;
    maxHeight = Math.max(maxHeight, screenshot.height);
  }
  totalWidth -= gap; // Remove last gap

  // Create a container frame
  const containerFrame = figma.createFrame();
  containerFrame.name = name;
  containerFrame.resize(totalWidth + 80, maxHeight + 120); // Add padding
  containerFrame.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];

  // Add title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = name;
  title.fontSize = 24;
  title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  title.x = 40;
  title.y = 30;
  containerFrame.appendChild(title);

  // Position for screenshots
  let currentX = 40;
  const screenshotY = 80;

  // Create image frames for each screenshot
  for (const screenshot of screenshots) {
    // Create frame for this viewport
    const frame = figma.createFrame();
    frame.name = `${name} - ${screenshot.viewport}`;
    frame.resize(screenshot.width, screenshot.height);
    frame.x = currentX;
    frame.y = screenshotY;

    // Decode base64 and create image
    const imageBytes = figma.base64Decode(screenshot.data);
    const image = figma.createImage(imageBytes);

    // Set the image as the frame's fill
    frame.fills = [
      {
        type: "IMAGE",
        imageHash: image.hash,
        scaleMode: "FILL",
      },
    ];

    // Add viewport label
    const label = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    label.fontName = { family: "Inter", style: "Medium" };
    label.characters = `${screenshot.viewport} (${screenshot.width}x${screenshot.height})`;
    label.fontSize = 12;
    label.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    label.x = currentX;
    label.y = screenshotY + screenshot.height + 10;
    containerFrame.appendChild(label);

    containerFrame.appendChild(frame);
    currentX += screenshot.width + gap;
  }

  // Position the container in the viewport
  const viewportCenter = figma.viewport.center;
  containerFrame.x = viewportCenter.x - containerFrame.width / 2;
  containerFrame.y = viewportCenter.y - containerFrame.height / 2;

  // Select and focus on the new frame
  figma.currentPage.selection = [containerFrame];
  figma.viewport.scrollAndZoomIntoView([containerFrame]);

  figma.notify(`Created frame: ${name} with ${screenshots.length} viewport(s)`);

  return containerFrame.id;
}

// Preload Inter font variants
const INTER_FONTS_LOADED = new Set<string>();

async function loadInterFont(weight: number): Promise<FontName> {
  // Map CSS font-weight to Figma style names
  let style = "Regular";
  if (weight >= 700) style = "Bold";
  else if (weight >= 600) style = "Semi Bold";
  else if (weight >= 500) style = "Medium";
  else if (weight <= 300) style = "Light";

  const fontKey = `Inter-${style}`;
  if (!INTER_FONTS_LOADED.has(fontKey)) {
    try {
      await figma.loadFontAsync({ family: "Inter", style });
      INTER_FONTS_LOADED.add(fontKey);
    } catch (_e) {
      // Fall back to Regular if specific weight not available
      if (style !== "Regular") {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        style = "Regular";
      }
    }
  }
  return { family: "Inter", style };
}

async function createNode(layer: Layer, parent: FrameNode): Promise<number> {
  let count = 0;

  switch (layer.type) {
    case "TEXT": {
      const textLayer = layer as TextLayer;
      const text = figma.createText();
      text.name = textLayer.name;
      text.x = textLayer.x;
      text.y = textLayer.y;

      // Load and set font
      const fontName = await loadInterFont(textLayer.fontWeight);
      text.fontName = fontName;
      text.characters = textLayer.characters;
      text.fontSize = textLayer.fontSize;

      // Set text color
      if (textLayer.textColor) {
        text.fills = [
          {
            type: "SOLID",
            color: {
              r: textLayer.textColor.r,
              g: textLayer.textColor.g,
              b: textLayer.textColor.b,
            },
          },
        ];
      }

      // Set text alignment
      if (textLayer.textAlign) {
        text.textAlignHorizontal = textLayer.textAlign;
      }

      // Resize to match extracted dimensions
      text.resize(textLayer.width, textLayer.height);

      parent.appendChild(text);
      count = 1;
      break;
    }

    case "RECTANGLE": {
      const rectLayer = layer as RectangleLayer;
      const rect = figma.createRectangle();
      rect.name = rectLayer.name;
      rect.x = rectLayer.x;
      rect.y = rectLayer.y;
      rect.resize(rectLayer.width, rectLayer.height);

      if (rectLayer.fills && rectLayer.fills.length > 0) {
        rect.fills = rectLayer.fills.map((fill) => ({
          type: "SOLID" as const,
          color: { r: fill.color.r, g: fill.color.g, b: fill.color.b },
          opacity: fill.opacity ?? fill.color.a ?? 1,
        }));
      } else {
        rect.fills = [];
      }

      if (rectLayer.cornerRadius) {
        rect.cornerRadius = rectLayer.cornerRadius;
      }

      // Apply strokes (borders)
      if (rectLayer.strokes && rectLayer.strokes.length > 0) {
        rect.strokes = rectLayer.strokes.map((stroke) => ({
          type: "SOLID" as const,
          color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b },
        }));
        rect.strokeWeight = rectLayer.strokeWeight ?? 1;
      }

      // Apply effects (shadows)
      if (rectLayer.effects && rectLayer.effects.length > 0) {
        rect.effects = rectLayer.effects.map((effect) => ({
          type: "DROP_SHADOW" as const,
          color: { r: effect.color.r, g: effect.color.g, b: effect.color.b, a: effect.color.a ?? 0.25 },
          offset: { x: effect.offset.x, y: effect.offset.y },
          radius: effect.radius,
          spread: effect.spread ?? 0,
          visible: true,
          blendMode: "NORMAL" as const,
        }));
      }

      parent.appendChild(rect);
      count = 1;
      break;
    }

    case "FRAME": {
      const frameLayer = layer as FrameLayer;
      const frame = figma.createFrame();
      frame.name = frameLayer.name;
      frame.x = frameLayer.x;
      frame.y = frameLayer.y;
      frame.resize(frameLayer.width, frameLayer.height);

      // Set background fills
      if (frameLayer.fills && frameLayer.fills.length > 0) {
        frame.fills = frameLayer.fills.map((fill) => ({
          type: "SOLID" as const,
          color: { r: fill.color.r, g: fill.color.g, b: fill.color.b },
          opacity: fill.opacity ?? fill.color.a ?? 1,
        }));
      } else {
        frame.fills = [];
      }

      if (frameLayer.cornerRadius) {
        frame.cornerRadius = frameLayer.cornerRadius;
      }

      // Apply strokes (borders)
      if (frameLayer.strokes && frameLayer.strokes.length > 0) {
        frame.strokes = frameLayer.strokes.map((stroke) => ({
          type: "SOLID" as const,
          color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b },
        }));
        frame.strokeWeight = frameLayer.strokeWeight ?? 1;
      }

      // Apply effects (shadows)
      if (frameLayer.effects && frameLayer.effects.length > 0) {
        frame.effects = frameLayer.effects.map((effect) => ({
          type: "DROP_SHADOW" as const,
          color: { r: effect.color.r, g: effect.color.g, b: effect.color.b, a: effect.color.a ?? 0.25 },
          offset: { x: effect.offset.x, y: effect.offset.y },
          radius: effect.radius,
          spread: effect.spread ?? 0,
          visible: true,
          blendMode: "NORMAL" as const,
        }));
      }

      // Apply Auto Layout if present
      if (frameLayer.layoutMode && frameLayer.layoutMode !== "NONE") {
        frame.layoutMode = frameLayer.layoutMode;

        if (frameLayer.primaryAxisAlignItems) {
          frame.primaryAxisAlignItems = frameLayer.primaryAxisAlignItems;
        }
        if (frameLayer.counterAxisAlignItems) {
          frame.counterAxisAlignItems = frameLayer.counterAxisAlignItems;
        }

        // Apply padding
        if (frameLayer.paddingLeft !== undefined) frame.paddingLeft = frameLayer.paddingLeft;
        if (frameLayer.paddingRight !== undefined) frame.paddingRight = frameLayer.paddingRight;
        if (frameLayer.paddingTop !== undefined) frame.paddingTop = frameLayer.paddingTop;
        if (frameLayer.paddingBottom !== undefined) frame.paddingBottom = frameLayer.paddingBottom;

        // Apply item spacing (gap)
        if (frameLayer.itemSpacing !== undefined) frame.itemSpacing = frameLayer.itemSpacing;
      }

      // Recursively create children
      count = 1;
      for (const child of frameLayer.children) {
        count += await createNode(child, frame);
      }

      parent.appendChild(frame);
      break;
    }
  }

  return count;
}

async function createFrameWithLayers(
  name: string,
  layerTrees: FigmaLayerTree[],
): Promise<{ frameId: string; layersCreated: number }> {
  // Calculate total width for layout
  const gap = 40;
  let totalWidth = 0;
  let maxHeight = 0;

  for (const tree of layerTrees) {
    totalWidth += tree.width + gap;
    maxHeight = Math.max(maxHeight, tree.height);
  }
  totalWidth -= gap;

  // Create container frame
  const containerFrame = figma.createFrame();
  containerFrame.name = name;
  containerFrame.resize(totalWidth + 80, maxHeight + 120);
  containerFrame.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];

  // Add title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = name;
  title.fontSize = 24;
  title.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  title.x = 40;
  title.y = 30;
  containerFrame.appendChild(title);

  // Create layer trees
  let currentX = 40;
  const layerY = 80;
  let totalLayersCreated = 0;

  for (const tree of layerTrees) {
    // Create viewport frame
    const viewportFrame = figma.createFrame();
    viewportFrame.name = tree.name;
    viewportFrame.x = currentX;
    viewportFrame.y = layerY;
    viewportFrame.resize(tree.width, tree.height);
    viewportFrame.fills = [];

    // Create layers from rootLayer
    const layersCreated = await createNode(tree.rootLayer, viewportFrame);
    totalLayersCreated += layersCreated;

    // Add viewport label
    const label = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    label.fontName = { family: "Inter", style: "Medium" };
    label.characters = `${tree.viewport} (${tree.width}x${tree.height}) - ${layersCreated} layers`;
    label.fontSize = 12;
    label.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
    label.x = currentX;
    label.y = layerY + tree.height + 10;
    containerFrame.appendChild(label);

    containerFrame.appendChild(viewportFrame);
    currentX += tree.width + gap;
  }

  // Position in viewport
  const viewportCenter = figma.viewport.center;
  containerFrame.x = viewportCenter.x - containerFrame.width / 2;
  containerFrame.y = viewportCenter.y - containerFrame.height / 2;

  // Select and focus
  figma.currentPage.selection = [containerFrame];
  figma.viewport.scrollAndZoomIntoView([containerFrame]);

  figma.notify(`Created "${name}" with ${totalLayersCreated} editable layers`);

  return {
    frameId: containerFrame.id,
    layersCreated: totalLayersCreated,
  };
}
