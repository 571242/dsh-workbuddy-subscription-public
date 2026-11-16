/**
 * JSON-Schema normalization for tool parameter schemas.
 *
 * Provider gateways reject or ignore parts of a JSON Schema that a TypeBox/Zod-style
 * schema carries, and a few keywords arrive unresolved. This module is shared
 * because several provider lines send the same normalized shape and the
 * normalization is behaviour, not preference: two lines that normalize
 * differently send different request bytes for the same tool.
 *
 * The work is:
 *
 * - drop the meta keywords ($schema) a gateway ignores;
 * - INLINE $defs / definitions / $ref, so no reference survives to the wire;
 * - give enum and const nodes an explicit type, which some gateways require;
 * - walk the whole tree, with cycle detection so a self-referential schema
 *   terminates instead of recursing forever.
 *
 * @module dsh-chatgpt-subscription/tool-schema
 */
/**
 * Normalizes tool parameter schemas for Kimi by stripping meta keywords ($schema),
 * inlining definitions ($defs/definitions/$ref), and ensuring property types for enums/consts.
 */
export declare function normalizeKimiToolSchema(schema: unknown): Record<string, unknown>;
/** Drop the JSON-Schema keywords provider gateways reject or ignore, and normalize properties. */
export declare function stripMetaSchema(schema: unknown): Record<string, unknown>;
//# sourceMappingURL=tool-schema.d.ts.map