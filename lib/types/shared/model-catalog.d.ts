import type { CodexOutputVerbosity } from './contracts.ts';
export type CodexModelModality = 'text' | 'image';
export declare const GPT_56_MAX_CONTEXT_WINDOW = 1000000;
export declare const GPT_6_MAX_CONTEXT_WINDOW = 872000;
/** Effective context the GPT-6 family starts at, before any user override. */
export declare const GPT_6_DEFAULT_CONTEXT_WINDOW = 384000;
/** Output cap of the GPT-6 family; the vendor declares 128K for all three. */
export declare const GPT_6_MAX_TOKENS = 128000;
/** Output cap for the models predating the GPT-6 family. */
export declare const CODEX_DEFAULT_MAX_TOKENS = 32768;
export interface CodexModelCatalogEntry {
    id: string;
    name: string;
    contextWindow: number;
    inputModalities: readonly CodexModelModality[];
    defaultReasoningEffort: string;
    reasoningProfile: 'standard' | 'gpt-5.6' | 'gpt-6';
    supportsReasoningSummary: boolean;
    /**
     * Whether the Responses `text.verbosity` control applies to this model.
     *
     * Official Codex gates the field on the catalog's own `support_verbosity`:
     * a model that does not accept it is sent none, and the official client warns
     * instead of guessing. An absent flag therefore means "not established" — this
     * line will not invent the field for a model it has no evidence about.
     */
    supportsOutputVerbosity?: boolean;
    /**
     * Verbosity the official client sends when the user has chosen none.
     *
     * Read from the same catalog: every model the backend currently lists declares
     * `default_verbosity: "low"`, so "follow the provider" means low — not the
     * server's own (medium) fallback, which is what omitting the field gets.
     */
    defaultOutputVerbosity?: CodexOutputVerbosity;
    /** Output cap when the caller omits one; falls back to {@link CODEX_DEFAULT_MAX_TOKENS}. */
    maxTokens?: number;
    fallbackModelId?: string;
}
export declare const CODEX_MODEL_CATALOG: readonly [{
    readonly id: "gpt-5.6-sol";
    readonly name: "5.6 Sol";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-5.6";
    readonly supportsReasoningSummary: true;
    readonly fallbackModelId: "gpt-5.6-terra";
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-6-astra";
    readonly name: "6 Astra";
    readonly contextWindow: 384000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-6";
    readonly supportsReasoningSummary: true;
    readonly maxTokens: 128000;
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-6.1-sol";
    readonly name: "6.1 Sol";
    readonly contextWindow: 384000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-6";
    readonly supportsReasoningSummary: true;
    readonly maxTokens: 128000;
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-6-sol";
    readonly name: "6 Sol";
    readonly contextWindow: 384000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-6";
    readonly supportsReasoningSummary: true;
    readonly maxTokens: 128000;
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-6-luna";
    readonly name: "6 Luna";
    readonly contextWindow: 384000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-6";
    readonly supportsReasoningSummary: true;
    readonly maxTokens: 128000;
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-5.6-terra";
    readonly name: "5.6 Terra";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-5.6";
    readonly supportsReasoningSummary: true;
    readonly fallbackModelId: "gpt-5.5";
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-5.6-luna";
    readonly name: "5.6 Luna";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-5.6";
    readonly supportsReasoningSummary: true;
    readonly fallbackModelId: "gpt-5.5";
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-5.5";
    readonly name: "5.5";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "standard";
    readonly supportsReasoningSummary: true;
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
}, {
    readonly id: "gpt-5.4";
    readonly name: "5.4";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "none";
    readonly reasoningProfile: "standard";
    readonly supportsReasoningSummary: true;
    readonly fallbackModelId: "gpt-5.4-mini";
}, {
    readonly id: "gpt-5.4-mini";
    readonly name: "5.4 Mini";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "none";
    readonly reasoningProfile: "standard";
    readonly supportsReasoningSummary: true;
}, {
    readonly id: "gpt-5.3-codex-spark";
    readonly name: "5.3 Codex Spark";
    readonly contextWindow: 258000;
    readonly inputModalities: readonly ["text"];
    readonly defaultReasoningEffort: "high";
    readonly reasoningProfile: "standard";
    readonly supportsReasoningSummary: false;
}];
export type CodexModelId = typeof CODEX_MODEL_CATALOG[number]['id'];
export declare const DEFAULT_VISIBLE_CODEX_MODEL_IDS: readonly ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
export declare const DEFAULT_CODEX_MODEL: {
    readonly id: "gpt-5.6-sol";
    readonly name: "5.6 Sol";
    readonly contextWindow: 272000;
    readonly inputModalities: readonly ["text", "image"];
    readonly defaultReasoningEffort: "medium";
    readonly reasoningProfile: "gpt-5.6";
    readonly supportsReasoningSummary: true;
    readonly fallbackModelId: "gpt-5.6-terra";
    readonly supportsOutputVerbosity: true;
    readonly defaultOutputVerbosity: "low";
};
export declare const STANDARD_REASONING_EFFORTS: readonly ["none", "low", "medium", "high", "xhigh"];
export declare const GPT_56_REASONING_EFFORTS: readonly ["none", "low", "medium", "high", "xhigh", "max"];
export declare const GPT_6_REASONING_EFFORTS: readonly ["low", "medium", "high", "xhigh", "max"];
export type CodexReasoningEffort = typeof GPT_56_REASONING_EFFORTS[number];
export declare function reasoningEffortsForModel(model: string): readonly CodexReasoningEffort[];
export declare function isCodexReasoningEffort(value: unknown): value is CodexReasoningEffort;
export declare function modelSupportsReasoningEffort(model: string, effort: unknown): effort is CodexReasoningEffort;
export declare function isCodexModelId(model: unknown): model is CodexModelId;
/**
 * Upper bound for one model's context window override. The Codex subscription
 * caps the whole GPT-6 family at 872K and everything older at 1M, so a model's
 * catalog default is where the number starts, not where it has to stay.
 */
export declare function contextWindowLimitForModel(model: CodexModelId): number;
export declare function resolveCodexCatalogEntry(model: string): CodexModelCatalogEntry;
export declare function codexModelSupportsImageInput(model: string): boolean;
export declare function codexModelSupportsReasoningSummary(model: string): boolean;
/**
 * Verbosity to send when the user has not chosen one.
 *
 * "Follow the provider" has to mean what the provider's own client sends. The
 * official catalog declares `default_verbosity: "low"` for every model it
 * lists, so the answer is low — not the server's implicit medium, which is what
 * omitting the field gets.
 *
 * @returns the verbosity to send, or `undefined` to omit the field entirely.
 */
export declare function codexDefaultOutputVerbosity(model: string): CodexOutputVerbosity | undefined;
/**
 * Declared output ceiling for one model, or the pre-GPT-6 default when it
 * declares none.
 *
 * This is NOT a request field. The subscription Responses endpoint rejects
 * `max_output_tokens` outright (400 Unsupported parameter, issue #29 — and the
 * official CLI's own request struct has no such field), so nothing is sent to
 * the wire from here. The value reaches DSH only as the adapter's
 * `defaultMaxTokens`, which compaction uses as a local completion reservation
 * when it plans a fold; that number never leaves this process.
 */
export declare function codexModelMaxTokens(model: string): number;
/**
 * The effort the Responses wire accepts for one model. The GPT-6 family dropped
 * `none`/`minimal`, so a request that still carries one — a session started on an
 * older model, or the `none` default of a model this route no longer offers — is
 * sent as `low` instead of being rejected.
 */
export declare function codexWireReasoningEffort(model: string, effort: string): string;
export declare function resolveCodexFallbackModel(model: string): CodexModelCatalogEntry | undefined;
//# sourceMappingURL=model-catalog.d.ts.map