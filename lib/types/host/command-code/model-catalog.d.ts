/**
 * Command Code model capability table.
 *
 * Transcribed from the official CLI's own model registry — the table it builds
 * `createModelRegistry` over — which is the only authoritative source for which
 * models accept image input and which reasoning levels each one exposes: the
 * public `/provider/v1/models` listing carries an id, a display name, and a
 * context length, but says nothing about modalities or reasoning.
 *
 * Transcribing means the whole table, not the entries someone happened to use.
 * An id the table omits is not treated as merely unknown by the adapter: it
 * falls back to text-only with NO reasoning ladder, so a real model missing
 * from here silently loses its image input and its effort selector. That is how
 * `deepseek/deepseek-v4.1-flash-fast` shipped with no thinking control while
 * the live catalog had been serving it, and how `gpt-6-sol`, `gpt-6-luna`,
 * `gpt-6.1-sol`, `claude-sonnet-5-5`, `claude-opus-5-5`, `xai/grok-4.7`,
 * `z-ai/glm-5.3-flashx` and others went missing at once.
 *
 * Family heuristics are not a substitute. Within one vendor the split is not
 * derivable from the id: `deepseek/deepseek-v4-flash` is text-only while
 * `deepseek/deepseek-v4.1-flash` and `deepseek/deepseek-v4-flash-vision-exp` take
 * images, and `z-ai/glm-5.3-flash` takes images while `zai-org/GLM-5.3` does not.
 *
 * The registry's `off` level is NOT carried through verbatim. Command Code
 * spells "do not think" as an effort named `off`; DSH spells the same thing as
 * `none`. The translation happens in {@link reasoningEffortsFor}, so the table
 * below stays a faithful transcription of the source and keeps `off` where the
 * registry puts it. Sending the literal `off` would be wrong in the other
 * direction too: the OpenAI-family wire has no such level, so it is dropped
 * rather than transmitted (see the request builders in `./mapper.ts`).
 */
export interface CommandCodeModelDef {
    id: string;
    name: string;
    /** Accepted request modalities, exactly as the registry declares them. */
    inputModalities: Array<'text' | 'image'>;
    /** Selectable reasoning levels; empty when the model exposes none. */
    reasoningEfforts: string[];
    /** Context window the registry declares, when it declares one. */
    contextWindow: number | null;
    /** Output cap the registry declares, when it declares one. */
    maxTokens: number | null;
}
/** Every model the Command Code registry describes, in registry order. */
export declare const COMMAND_CODE_MODELS: readonly CommandCodeModelDef[];
/** Registry entry for one model id, or undefined when it describes no such model. */
export declare function commandCodeModelDef(modelId: string): CommandCodeModelDef | undefined;
//# sourceMappingURL=model-catalog.d.ts.map