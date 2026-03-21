/**
 * Generate TypeScript type definitions for the Figma plugin from source types
 * Run: npm run generate:types
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Read the source type files
const layersTypesPath = path.join(rootDir, "src/types/layers.ts");
const indexTypesPath = path.join(rootDir, "src/types/index.ts");
const layersContent = fs.readFileSync(layersTypesPath, "utf-8");
const indexContent = fs.readFileSync(indexTypesPath, "utf-8");

// Extract just the type definitions (remove imports and exports)
const extractTypeDefinitions = (content: string): string => {
  // Remove import statements
  let cleaned = content.replace(/^import\s+.*?;$/gm, "");

  // Convert export interface/type to just interface/type
  cleaned = cleaned.replace(/^export\s+(interface|type)\s+/gm, "$1 ");

  // Remove export statements
  cleaned = cleaned.replace(/^export\s+\{[^}]*\};?$/gm, "");

  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n\n\n+/g, "\n\n");

  return cleaned.trim();
};

const layerDefinitions = extractTypeDefinitions(layersContent);

// Extract Screenshot and other index types
// We want Screenshot, FigmaMessage, FigmaCreateFramePayload, FigmaFrameCreatedPayload
const extractIndexTypes = (content: string): string => {
  const lines = content.split("\n");
  const typeLines: string[] = [];
  let inType = false;
  let braceCount = 0;

  for (const line of lines) {
    // Skip imports
    if (line.match(/^import\s+/)) continue;

    // Look for type/interface definitions
    if (line.match(/^export\s+(interface|type|enum)\s+/)) {
      inType = true;
      // Convert export to non-export
      typeLines.push(line.replace(/^export\s+/, ""));
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    } else if (inType) {
      typeLines.push(line);
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

      if (braceCount === 0 && line.includes("}")) {
        inType = false;
      }
    }
  }

  return typeLines.join("\n").trim();
};

const indexDefinitions = extractIndexTypes(indexContent);

// Generate the plugin types file
const pluginTypesContent = `/**
 * AUTO-GENERATED: Type definitions for Figma plugin
 * Generated from: src/types/layers.ts and src/types/index.ts
 * Do not edit manually - regenerate with: npm run generate:types
 */

// =============================================================================
// Layer Type Definitions (from src/types/layers.ts)
// =============================================================================

${layerDefinitions}

// =============================================================================
// MCP Message Type Definitions (from src/types/index.ts)
// =============================================================================

${indexDefinitions}
`;

// Write the generated file
const outputPath = path.join(rootDir, "figma-plugin/types.ts");
fs.writeFileSync(outputPath, pluginTypesContent);

console.log(`✓ Generated plugin type definitions: ${outputPath}`);
