/**
 * Static facts about the Ollama provider API.
 *
 * Ollama publishes three surfaces, and this line speaks two of them:
 *
 * - the **native API** (`https://ollama.com/api`) — Ollama's own wire format,
 *   with `/api/chat` and `/api/tags`;
 * - the **OpenAI-compatible API** (`https://ollama.com/v1`) — a documented
 *   subset of the OpenAI API, which is what a coding agent wants by default
 *   because its tool-calling and streaming shapes are the familiar ones.
 *
 * A third surface, the Anthropic-compatible `/v1/messages`, exists and is not
 * used here: the Claude line already transcribes the Anthropic wire format
 * against a snapshot it can verify, and routing Ollama's subset of it through
 * the same mapper would claim capabilities Ollama does not document.
 *
 * DOCUMENTED CLOUD LIMITS (docs/api/openai-compatibility, docs/cloud):
 *
 * - No stateful Responses. Only the stateless form works.
 * - No built-in web search through `/v1/responses`.
 * - No custom/freeform tool-call replay.
 *
 * Those are server-side capability limits, not choices made here, so this line
 * sends ordinary `tools` arrays and streams ordinary `tool_calls` back, and
 * makes no promise about replaying a custom tool call across turns. Saying so
 * in the settings card is the honest rendering of a documented boundary.
 *
 * Authentication is a static API key in `Authorization: Bearer`, not an OAuth
 * flow: keys do not expire and are revoked from the account settings page.
 */
export declare const PROVIDER_ID = "ollama";
export declare const PROVIDER_NAME = "Ollama";
/** Direct cloud access, per docs/api/introduction. */
export declare const CLOUD_BASE_URL = "https://ollama.com";
/** Native surface. */
export declare const NATIVE_CHAT_PATH = "/api/chat";
export declare const NATIVE_TAGS_PATH = "/api/tags";
/** Per-model metadata: the one surface where a model states its own thinking levels. */
export declare const NATIVE_SHOW_PATH = "/api/show";
/** OpenAI-compatible surface. */
export declare const OPENAI_BASE_URL = "https://ollama.com/v1";
export declare const OPENAI_CHAT_PATH = "/chat/completions";
export declare const OPENAI_MODELS_PATH = "/models";
/**
 * Default context window for a model whose catalog entry states none.
 *
 * Ollama's `/api/tags` returns names and families, not context windows, so a
 * fixed conservative value is the honest number here. It is deliberately small
 * enough to be true of every cloud model rather than flattering to one.
 */
export declare const DEFAULT_CONTEXT_WINDOW = 128000;
/**
 * Output cap used when neither the caller nor the catalog states one.
 *
 * Ollama does not document a per-model maximum output length, and unlike the
 * Claude line there is no snapshot to read one from, so this is a request-level
 * ceiling rather than a claim about what the model can do.
 */
export declare const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
/**
 * Smallest output cap this line will send for a model whose thinking cannot be
 * turned off.
 *
 * Such a model spends its cap on reasoning before it emits any text, so a caller
 * that wants only a few words can be capped below the reasoning floor and get an
 * empty answer with a length finish - which Harness reports as a truncated
 * stream. DSH's own session-title call is the caller that hits it: it asks for
 * one short line with `maxTokens: 64`, and on a forced-thinking model every
 * title comes back empty.
 *
 * The value is carried over from the MiniMax Code line, where 512 is MEASURED:
 * 64 returns a thinking block and no text, 512 returns the title after ~53
 * output tokens. It is NOT measured on this line - see docs/ for the observation
 * that motivated it - so it is deliberately a round, conservative number rather
 * than a tight one: the cost of a too-high floor is a few unused tokens on an
 * auxiliary call, and the cost of a too-low one is the title failing at all.
 */
export declare const FORCED_THINKING_FLOOR_TOKENS = 512;
/**
 * Raise a cap that is too small for this model's forced thinking.
 *
 * Left alone: a model whose thinking CAN be disabled - its caller may have asked
 * for thinking off on purpose, and raising the cap would not enable it while the
 * number read back would be misleading - and an absent cap, which
 * `DEFAULT_MAX_OUTPUT_TOKENS` already owns at a size nothing is short of.
 *
 * @param modelId - the routed model id.
 * @param requested - the caller's cap, undefined when it stated none.
 * @param declared - the model's own thinking metadata, when it was read.
 * @returns the cap to request, raised only when that is the difference between an
 * empty truncated answer and a usable one.
 */
export declare function floorForcedThinkingTokens(modelId: string, requested: number | undefined, declared?: OllamaThinkingCapability): number | undefined;
/** How long a catalog sync may take before the cached list is used instead. */
export declare const CATALOG_TIMEOUT_MS = 15000;
/**
 * Cooldown one account takes when Ollama refuses it without stating a delay.
 *
 * A 429 here is a real quota or rate limit, not a blip, so the account is parked
 * for long enough that the next request goes to a different one.
 */
export declare const POOL_COOLDOWN_MS: number;
/**
 * The two wire shapes this line can speak, per request.
 *
 * A user picks the line once; which surface serves a given turn is decided here,
 * not exposed as a setting, because the two are not interchangeable from the
 * caller's side: both accept the same tool definitions and return the same
 * assistant message.
 */
export type OllamaWire = 'openai' | 'native';
/** One model as Ollama's `/api/tags` reports it. */
export interface OllamaCatalogModel {
    id: string;
    name?: string;
    contextWindow?: number;
    /** Unix milliseconds this entry was read from the service. */
    fetchedAt?: number;
}
/**
 * NO fallback model names.
 *
 * An earlier revision hard-coded `gpt-oss:120b-cloud` and `gpt-oss:20b-cloud`
 * here, and they reached the model picker. That was wrong twice over: this line
 * has no model table of its own, so every name in it would be a guess about what
 * some account is entitled to, and a guess that lands in the picker is a model a
 * user can select and then fail on. The other lines can fall back to hard-coded
 * names because theirs are transcribed from a real table - Claude's is its own
 * frozen catalog. Ollama's truth is `/api/tags`, and there is nothing honest to
 * stand in for it before the first sync.
 *
 * So the catalog starts empty and the card says the list has not been synced yet,
 * with the sync button right beside it. A user who has a key is one click from a
 * list that is actually theirs.
 */
export declare const FALLBACK_MODELS: readonly OllamaCatalogModel[];
/**
 * Resolve the wire shape for a model.
 *
 * `openai` first, always: the OpenAI-compatible surface is the one whose tool
 * and streaming semantics this plugin's mapper already implements faithfully,
 * and it is what an agent wants. `native` is the fallback for the documented
 * cases where the OpenAI surface refuses a request, so a model the service
 * accepts natively still works instead of failing outright.
 */
export declare function wireForModel(_model: string): OllamaWire;
/** Context window for a model, falling back to the conservative constant. */
export declare function contextWindowFor(model: OllamaCatalogModel | undefined): number;
/** Bearer headers for a stored key. */
export declare function ollamaHeaders(apiKey: string): Record<string, string>;
/**
 * Tightly-scoped check for known vision-capable models in Ollama.
 * Conservative allowlist of known vision families; unknown models default to false.
 */
export declare function ollamaModelSupportsImage(modelId: string): boolean;
export type OllamaThinkingMode = 'levels' | 'boolean' | 'none';
/**
 * What one model says about its own thinking, as `POST /api/show` reports it.
 *
 * `values` is the complete set the wire accepts: a boolean, meaning on/off, or
 * a level name that model defines itself (gpt-oss declares low/medium/high and
 * cannot be switched off). `[false]` means the model has no thinking to control,
 * and an absent `thinking` means the service states nothing about it. `default`
 * is the value the service uses when a request sends no `think` at all.
 *
 * Source: https://github.com/ollama/ollama/blob/main/docs/capabilities/thinking.mdx
 */
export interface OllamaThinkingCapability {
    values: readonly (boolean | string)[];
    default?: boolean | string;
}
/** One selectable effort, as the picker renders it. */
export interface OllamaReasoningEffort {
    /** Sent as the caller's `reasoningEffort` and mapped onto the wire from it. */
    id: string;
    name: string;
}
/**
 * Resolve model-specific thinking support in Ollama.
 *
 * The service's own metadata outranks the prefix list: `/api/show` is where a
 * model states the levels it accepts, and it is the only source there is for a
 * family this file has never heard of. The prefix list stays as the fallback for
 * a model whose metadata could not be read, and that fallback is unchanged.
 *
 * Source: official https://github.com/ollama/ollama/blob/main/docs/capabilities/thinking.mdx
 * - 'levels': named levels (gpt-oss: low, medium, high; cannot disable thinking)
 * - 'boolean': booleans (deepseek-r1, qwq, qwen3: true, false)
 * - 'none': declared [false], declared nothing, or unknown
 */
export declare function thinkingModeForModel(modelId: string, declared?: OllamaThinkingCapability): OllamaThinkingMode;
/**
 * The efforts one model can actually be sent, in display order.
 *
 * This set is the whole contract with the harness: a level outside it is
 * rejected before a request is built (see `resolveCallWithInfo`), so it must be
 * exactly what the wire accepts and no more - which is why, when the model has
 * declared its own values, this returns that table row for row instead of
 * choosing from a fixed menu. A model that declares `[false]` is the one case
 * with a declared value and no ladder at all: `[false]` is the service saying
 * there is no thinking here to turn on or off.
 *
 * Without metadata the families this file knows answer instead, unchanged:
 * gpt-oss takes the three levels, and a boolean family takes the on/off pair.
 */
export declare function reasoningEffortsForModel(modelId: string, declared?: OllamaThinkingCapability): OllamaReasoningEffort[];
/**
 * The effort this model's ladder should start on.
 *
 * A stored default is a per-route preference, not a per-model promise: the
 * settings card offers one ladder for the whole line, so a level chosen for one
 * model can be one this model cannot express - and DSH rejects a level that is
 * not on the ladder before a request is built. So the order is: the configured
 * level when this model has it, then the level the model itself defaults to,
 * then the ladder's own first entry.
 *
 * The last step skips a "thinking off" position. A user who picked a thinking
 * model and was handed that position would silently get a model that never
 * thinks, which is a worse wrong answer than the mildest level that does think.
 */
export declare function resolveOllamaDefaultEffort(modelId: string, declared: OllamaThinkingCapability | undefined, configured: string | null | undefined): string | undefined;
/**
 * Map reasoning effort to wire think parameter for the target model.
 * Per Ollama docs:
 * - a model that has declared its own values: the effort reverses to the one
 *   value that model declared for it, and nothing else is sent. A level the
 *   model never declared is omitted rather than coerced - a model that declares
 *   `[true]` is never asked for `false`, and one that declares ['low','high'] is
 *   never handed 'medium'. Omitting is the service's own default, which is a
 *   weaker turn and never a failed one.
 * - gpt-oss with no metadata: only 'low' | 'medium' | 'high' are valid. gpt-oss cannot disable
 *   thinking, so 'none' as well as 'xhigh'/'max'/garbage MUST be omitted (undefined).
 * - boolean models: 'none' -> false; 'low'|'medium'|'high'|'auto'|'true' -> true; garbage -> undefined.
 * - all other models: omit (undefined).
 */
export declare function thinkForModel(modelId: string, reasoningEffort: unknown, declared?: OllamaThinkingCapability): boolean | string | undefined;
//# sourceMappingURL=types.d.ts.map