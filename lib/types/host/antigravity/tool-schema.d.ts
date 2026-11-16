/** One outbound tool-schema conversion's per-target options. */
export interface AntigravityToolSchemaOptions {
    /**
     * Collapse `anyOf`/`oneOf`/`allOf` and type unions into one declared form.
     *
     * Gemini ignores `anyOf` and takes the composed form as sent. Antigravity routes
     * a Claude-family request to Vertex Anthropic, whose `input_schema` check rejects
     * a tool schema the request still composes with (#39). That is a gateway limit,
     * not a JSON Schema rule: the caller's schema is valid draft 2020-12.
     */
    foldUnions?: boolean;
}
export declare function toAntigravityToolSchema(schema: unknown, options?: AntigravityToolSchemaOptions): unknown;
//# sourceMappingURL=tool-schema.d.ts.map