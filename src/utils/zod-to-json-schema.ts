import type { z } from "zod";

/**
 * Convert a Zod schema to a JSON Schema compatible object.
 *
 * Handles all Zod types used in this project's registry. If an unrecognised
 * Zod type is encountered we throw immediately rather than silently emitting
 * a wrong `{ type: "string" }` fallback.
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
      return filterUndefined({ type: "string", description: def.description });

    case "ZodNumber":
      return filterUndefined({ type: "number", description: def.description });

    case "ZodBoolean":
      return filterUndefined({ type: "boolean", description: def.description });

    case "ZodArray":
      return filterUndefined({
        type: "array",
        items: convertZodType(def.type),
        description: def.description,
      });

    case "ZodEnum":
      return filterUndefined({
        type: "string",
        enum: def.values,
        description: def.description,
      });

    case "ZodLiteral":
      return filterUndefined({
        const: def.value,
        description: def.description,
      });

    case "ZodUnion": {
      // biome-ignore lint/suspicious/noExplicitAny: Zod internals
      const options = (def.options as z.ZodType<any, any, any>[]).map(convertZodType);
      return filterUndefined({ oneOf: options, description: def.description });
    }

    case "ZodOptional":
      // Preserve description from the wrapper when present
      return mergeDescription(convertZodType(def.innerType), def.description);

    case "ZodNullable":
      return mergeDescription(
        { ...convertZodType(def.innerType), nullable: true },
        def.description,
      );

    case "ZodDefault":
      return mergeDescription(
        {
          ...convertZodType(def.innerType),
          default: def.defaultValue(),
        },
        def.description,
      );

    case "ZodNativeEnum": {
      const values = Object.values(def.values as Record<string, unknown>).filter(
        (v) => typeof v === "string" || typeof v === "number",
      );
      return filterUndefined({ enum: values, description: def.description });
    }

    default:
      throw new Error(
        `zodToJsonSchema: unsupported Zod type "${typeName}". Add a case for it in src/utils/zod-to-json-schema.ts.`,
      );
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Zod internals
function convertObject(def: any): Record<string, unknown> {
  const shape = def.shape() as Record<string, z.ZodType>;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = convertZodType(value);

    // A field is required when it is neither optional nor has a default value.
    // biome-ignore lint/suspicious/noExplicitAny: Zod internals
    const valueDef = (value as any)._def;
    if (valueDef.typeName !== "ZodOptional" && valueDef.typeName !== "ZodDefault") {
      required.push(key);
    }
  }

  return filterUndefined({
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
    description: def.description,
    additionalProperties: def.unknownKeys === "strict" ? false : undefined,
  });
}

/** Remove keys whose value is undefined so the JSON output stays clean. */
function filterUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Attach a description to an already-converted schema only when one is provided. */
function mergeDescription(
  schema: Record<string, unknown>,
  description: string | undefined,
): Record<string, unknown> {
  if (!description) return schema;
  return { ...schema, description };
}
