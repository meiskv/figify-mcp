import type { z } from "zod";

/**
 * Convert a Zod schema to a JSON Schema compatible object.
 * This is a simplified implementation that handles common Zod types.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return convertZodType(schema);
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internals require any
function convertZodType(schema: z.ZodType<any, any, any>): Record<string, unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: Zod internals
  const def = schema._def as any;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodObject":
      return convertObject(def);
    case "ZodString":
      return { type: "string", description: def.description };
    case "ZodNumber":
      return { type: "number", description: def.description };
    case "ZodBoolean":
      return { type: "boolean", description: def.description };
    case "ZodArray":
      return {
        type: "array",
        items: convertZodType(def.type),
        description: def.description,
      };
    case "ZodEnum":
      return {
        type: "string",
        enum: def.values,
        description: def.description,
      };
    case "ZodOptional":
      return convertZodType(def.innerType);
    case "ZodDefault":
      return {
        ...convertZodType(def.innerType),
        default: def.defaultValue(),
      };
    default:
      return { type: "string" };
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertObject(def: any): Record<string, unknown> {
  const shape = def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    // biome-ignore lint/suspicious/noExplicitAny: Zod type
    properties[key] = convertZodType(value as z.ZodType<any, any, any>);

    // Check if field is required (not optional and no default)
    // biome-ignore lint/suspicious/noExplicitAny: Zod internals
    const valueDef = (value as any)._def;
    if (valueDef.typeName !== "ZodOptional" && valueDef.typeName !== "ZodDefault") {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
    description: def.description,
  };
}
