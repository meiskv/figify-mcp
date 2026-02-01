// Figma plugin code - runs in the Figma sandbox

interface Screenshot {
  viewport: string;
  width: number;
  height: number;
  data: string; // base64 encoded PNG
}

interface CreateFrameMessage {
  type: "CREATE_FRAME";
  id: string;
  name: string;
  screenshots: Screenshot[];
}

type PluginMessage = CreateFrameMessage;

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
