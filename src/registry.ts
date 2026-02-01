import { z } from "zod";

export const ViewportSchema = z.enum(["desktop", "mobile"]);

export const ImportPageInputSchema = z.object({
  source: z.string().describe("File path (@/app/page.tsx) or URL (localhost:3000)"),
  viewports: z
    .array(ViewportSchema)
    .default(["desktop"])
    .describe('Viewports to capture. Default: ["desktop"]'),
  projectPath: z
    .string()
    .optional()
    .describe("Next.js project root path. Auto-detected if not provided."),
});

export const CheckConnectionInputSchema = z.object({});

export const CaptureScreenshotInputSchema = z.object({
  url: z.string().describe("URL to capture"),
  viewports: z
    .array(ViewportSchema)
    .default(["desktop"])
    .describe('Viewports to capture. Default: ["desktop"]'),
});

export type ImportPageInput = z.infer<typeof ImportPageInputSchema>;
export type CheckConnectionInput = z.infer<typeof CheckConnectionInputSchema>;
export type CaptureScreenshotInput = z.infer<typeof CaptureScreenshotInputSchema>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "import_page",
    description:
      "Capture a Next.js page and import to Figma. Supports file paths (@/app/page.tsx) or URLs (localhost:3000). Creates frames for each viewport (desktop/mobile).",
    inputSchema: ImportPageInputSchema,
  },
  {
    name: "check_figma_connection",
    description:
      "Verify that the Figma plugin is connected to the MCP server via WebSocket. Returns connection status.",
    inputSchema: CheckConnectionInputSchema,
  },
  {
    name: "capture_screenshot",
    description:
      "Capture screenshots of a URL at specified viewports without sending to Figma. Useful for testing.",
    inputSchema: CaptureScreenshotInputSchema,
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
