/**
 * Wire mapping for the Step Code (Step Plan subscription) chat endpoint.
 *
 * The endpoint is OpenAI Chat Completions shaped — every Step profile
 * (`step_plan`, `step_plan_oversea`, `platform_cn`, `platform_oversea`)
 * answers `{base}/v1/chat/completions` with the standard SSE frames (official
 * `step-provider/index.ts:88` pins one dialect, `STEP_MODEL_API =
 * "openai-completions"`, for every model). This module therefore looks like its
 * WorkBuddy / GLM siblings and exists to absorb the places where Step is not
 * OpenAI:
 *
 * 1. **The output cap is `max_tokens`, never `max_completion_tokens`.**
 *    Step's Chat Completions documentation defines only `max_tokens`. The
 *    official client picks the field from a detected `compat.maxTokensField`
 *    (`openai-completions.ts:816-819`); this route hardwires the documented one
 *    instead of running detection per request.
 * 2. **Cache reads are reported at the TOP LEVEL as `usage.cached_tokens`.**
 *    That is the field Step's own documentation names as the hit criterion
 *    (`cached_tokens > 0`), and it is NOT in this repository's shared diagnostic
 *    parse chain (`common/request-diagnostics.ts:406-409` reads
 *    `prompt_tokens_details.cached_tokens` → `cache_read_input_tokens` →
 *    `cache_read_tokens`). So this route carries its own chain, driven by the
 *    frozen `STEP_CODE_CACHE_READ_FIELD_ORDER`; see {@link parseStepCodeUsage}.
 * 3. **Caching is automatic and parameterless.** The server keeps an automatic
 *    prefix cache (a prefix of at least 256 tokens hits, LRU eviction, no request
 *    field). The official client sends nothing at all to a Step endpoint:
 *    `prompt_cache_key` is gated on `baseUrl.includes("api.openai.com")`
 *    (`openai-completions.ts:799-801`), session-affinity headers are off for Step,
 *    and `cache_control` only exists on the Anthropic wire. This module follows
 *    that default exactly and adds `prompt_cache_key` only behind an explicit
 *    caller flag; see {@link stepCodePromptCacheKey}.
 * 4. **There is no cache write to report, and no price to report.** Automatic
 *    prefix caching has no client-visible write step, so `cacheWriteTokens` is 0
 *    on this route and the route says so out loud
 *    (`STEP_CODE_CACHE_WRITE_NOTE`). Every Step model lists all-zero prices
 *    (`MODEL_DEFAULTS.cost`, `step-provider/index.ts:102`), so money is derived
 *    from that table instead of a guessed rate — see
 *    {@link STEP_CODE_PRICE_PER_MILLION_TOKENS}.
 *
 * ## Why the constants are imported, not restated
 *
 * Every ladder, ceiling and default below comes from `./types.ts`,
 * `./model-catalog.ts` or `../../shared/step-code-contracts.ts`. Writing a
 * second copy of a value is how a route starts lying: upstream moves one step of
 * a ladder and this file keeps sending the old one, with no test and no compile
 * error pointing at it. `STEP_CODE_CACHE_READ_FIELD_ORDER` is even walked at
 * runtime rather than transcribed, so adding a rung upstream changes the parse
 * here without a second edit.
 *
 * ## Division of labour
 *
 * The request URL is NOT assembled here: the caller owns the base URL because the
 * region profile decides it, and this file performs no network I/O at all (fetch,
 * SSE reading and byte decoding belong to the transport layer). Like the sibling
 * routes the adapter owns the transport: it builds the body with
 * {@link buildChatRequest}, feeds SSE lines to {@link processStreamLine}, flushes
 * with {@link closeStream}, checks {@link assertStreamComplete}, and turns a
 * non-2xx response into an `LlmError` with {@link classifyStepCodeFailure}.
 *
 * @module dsh-chatgpt-subscription/step-code-mapper
 */
import { CHAT_COMPLETIONS_PATH, STEP_CODE_EFFORTS } from './types.ts';
import type { StepCodeModelEntry } from './model-catalog.ts';
import { STEP_CODE_CACHE_READ_FIELD_ORDER, STEP_CODE_CACHE_WRITE_NOTE, STEP_CODE_PROMPT_CACHE_KEY_MAX_LENGTH, type StepCodeReasoningEffort } from '../../shared/step-code-contracts.ts';
import { LlmError, type GenerateOptions, type OutboundContentBlock, type StreamChunk, type TokenUsage } from '../common/llm-compat.ts';
import { resolveRequestImages, type AttachmentImageReader, type ResolvedRequestImage, type ResolvedRequestImages } from '../common/request-images.ts';
export { CHAT_COMPLETIONS_PATH, STEP_CODE_EFFORTS, STEP_CODE_CACHE_WRITE_NOTE };
export { STEP_CODE_CACHE_READ_FIELD_ORDER, STEP_CODE_PROMPT_CACHE_KEY_MAX_LENGTH };
export { resolveRequestImages };
export type { AttachmentImageReader, ResolvedRequestImage, ResolvedRequestImages, StepCodeReasoningEffort };
/** One selectable thinking level on the Step endpoint. */
export type { StepCodeReasoningEffort as StepCodeEffort };
/**
 * Price of one million tokens on every Step model: zero, read from the catalog.
 *
 * `MODEL_DEFAULTS.cost` hardwires `{ input: 0, output: 0, cacheRead: 0,
 * cacheWrite: 0 }` — the upstream table was never filled in, and Step Plan is a
 * subscription rather than a metered SKU. Deriving the number from that table
 * keeps this value honest if the table is ever completed: a route that
 * multiplied tokens by an invented rate would show a plausible, wrong number,
 * while zero is the only defensible one. The card shows the token dimension
 * alone (see `STEP_CODE_PRICING_STATUS` in the shared contracts).
 */
export declare const STEP_CODE_PRICE_PER_MILLION_TOKENS: 0;
/**
 * Base64 image payload one request may carry on this route.
 *
 * Step publishes no per-request image ceiling, so this is a defensive budget
 * rather than a documented limit: it mirrors the sibling OpenAI-shaped WorkBuddy
 * route (12 MB) and exists so a runaway conversation degrades to placeholders
 * instead of growing a body the transport has to carry. Lower it once a real
 * Step ceiling has been measured — the offload mechanism itself is shared.
 */
export declare const STEP_CODE_MAX_REQUEST_IMAGE_BYTES: number;
/**
 * The shared image budget, for a caller that prefers the plugin's conservative
 * ceiling to {@link STEP_CODE_MAX_REQUEST_IMAGE_BYTES}.
 */
export declare const STEP_CODE_SHARED_IMAGE_BUDGET = 1500000;
/**
 * Replace the oldest inline images with a visible placeholder once one request
 * would exceed {@link STEP_CODE_MAX_REQUEST_IMAGE_BYTES}.
 *
 * Durable history is untouched; only the request about to be sent changes, and
 * the budget is passed in rather than inherited so this route's ceiling and the
 * shared default stay two separate decisions.
 */
export declare function offloadOldestStepCodeRequestImages(options: GenerateOptions, images?: ResolvedRequestImages): GenerateOptions;
/**
 * Reasoning effort to put on the wire, or undefined to omit the field.
 *
 * Delegates to the line's own {@link convergeStepCodeEffort}, which snaps the
 * caller's effort onto the ladder THIS model declared in
 * `reasoning_effort_support_list` and answers null for an empty ladder. Two
 * outcomes matter here and both mean "do not send": an absent/blank request, and
 * a model that declares no effort field at all. Nothing outside the declared
 * ladder ever reaches the body — an effort the endpoint does not list is a
 * rejected request, not a rounded-down preference.
 */
export declare function resolveStepCodeReasoningEffort(requested: unknown, ladder: readonly string[]): StepCodeReasoningEffort | undefined;
/**
 * `prompt_cache_key` for this request, or undefined to send no cache field.
 *
 * THE default is undefined. Step's server-side cache is automatic and takes no
 * parameter, and the official client sends no cache parameter to a Step endpoint
 * at all — `prompt_cache_key` is gated on
 * `baseUrl.includes("api.openai.com")` (`openai-completions.ts:799-801`),
 * session-affinity headers are disabled for Step, and `prompt_cache_retention`
 * (24h) is an undocumented field this route never sends either. The key is
 * therefore behind the caller's explicit `cacheRequestParams` flag, so a
 * deployment that measured the endpoint's acceptance can turn it on and one that
 * did not sends exactly what the official client sends.
 */
export declare function stepCodePromptCacheKey(options: GenerateOptions, request: StepCodeRequestOptions): string | undefined;
/**
 * Clamp a session id to {@link STEP_CODE_PROMPT_CACHE_KEY_MAX_LENGTH} code
 * points, or undefined when there is nothing to key on.
 */
export declare function clampStepCodePromptCacheKey(sessionId: string | undefined): string | undefined;
/** Per-request knobs the wire needs but the conversation does not carry. */
export interface StepCodeRequestOptions {
    /** Whether the selected model declares image input (`enable_vision_input`). */
    supportsImages?: boolean;
    /**
     * Output ceiling to use when the caller stated none; normally the catalog
     * entry's `defaultMaxTokens`. Falls back to the line's own rule ("no reported
     * output cap, so equal to the input window").
     */
    defaultMaxTokens?: number;
    /**
     * Efforts this model declared (`reasoning_effort_support_list`). Empty — the
     * undeclared-model row — means no effort field is sent at all.
     */
    reasoningEfforts?: readonly string[];
    /**
     * Whether to send the optional `prompt_cache_key`. Off by default, exactly
     * like the official client on a Step endpoint; see
     * {@link stepCodePromptCacheKey}. This is a per-settings capability bit, not a
     * model property, which is why {@link stepCodeRequestOptionsFor} leaves it to
     * the caller.
     */
    cacheRequestParams?: boolean;
}
/** Factory defaults: images gated off, no cache parameter, no ladder. */
export declare const DEFAULT_STEP_CODE_REQUEST_OPTIONS: StepCodeRequestOptions;
/**
 * The wire knobs for one catalog row.
 *
 * Exists so the field-by-field copy from a catalog entry lives in exactly one
 * place: the adapter resolves the entry and only has to add the two things that
 * are not model properties — the cache capability bit and a caller override of
 * the output ceiling. An unknown model yields the undeclared row's facts (no
 * ladder, no images), which is what makes "never send a field the endpoint does
 * not declare" the default path rather than a special case.
 */
export declare function stepCodeRequestOptionsFor(entry: StepCodeModelEntry | undefined, overrides?: {
    cacheRequestParams?: boolean;
    defaultMaxTokens?: number;
}): StepCodeRequestOptions;
/**
 * Build one `{base}/v1/chat/completions` body.
 *
 * Always `stream: true` with `stream_options: { include_usage: true }`: the
 * cache numbers this line exists to report arrive on the terminal frame, and
 * there is no non-streaming path to keep in sync. The output cap is
 * `max_tokens`, the field Step documents (see the module note).
 *
 * Session-folded tool history has no field on this wire, so the complete tool
 * declarations are sent every request — the documented behaviour of omitting
 * `toolHistory`, not a silent drop of it.
 */
export declare function buildChatRequest(options: GenerateOptions, images?: ResolvedRequestImages, request?: StepCodeRequestOptions): Record<string, unknown>;
/** One usage frame read off the wire, already normalized. */
export interface StepCodeParsedUsage {
    /** The endpoint's aggregate prompt count, before the cache split. */
    promptTokens: number;
    /** Uncached input, disjoint from the two cache buckets. */
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
}
/**
 * Cache reads for one usage frame, walking the frozen
 * `STEP_CODE_CACHE_READ_FIELD_ORDER`.
 *
 * The order is NOT restated here — it is the shared contract's array, walked in
 * order — for two reasons. The third rung is the one this route lives or dies by:
 * top-level `usage.cached_tokens` is the field Step's documentation shows and
 * the one its hit criterion (`> 0`) is written against, while the repository's
 * shared diagnostic chain (`common/request-diagnostics.ts:406-409`) has no rung
 * for it. And a second hand-written list of the same four names is exactly the
 * shape that rots the first time upstream reorders or extends it.
 *
 * The fifth rung is `0`, meaning "the endpoint reported nothing" rather than
 * "nothing hit"; hit or miss is judged against the prefix length upstream.
 */
export declare function readCacheReadTokens(usage: Record<string, unknown>): number;
/**
 * Normalize one `usage` object into DSH's disjoint counters.
 *
 * Cache writes are read only from `prompt_tokens_details.cache_write_tokens`,
 * which this endpoint never reports (automatic prefix cache), so the value is 0
 * here — see {@link STEP_CODE_CACHE_WRITE_NOTE}. It still takes part in the
 * subtraction so an endpoint that does report one is accounted correctly.
 * Reasoning tokens are OpenAI's own detail field; completion_tokens already
 * includes them, so nothing is subtracted there.
 */
export declare function parseStepCodeUsage(raw: unknown): StepCodeParsedUsage | undefined;
interface PendingToolCall {
    blockIndex: number;
    id: string;
    name: string;
    arguments: string;
    started: boolean;
}
/** Accumulated state of one Step streaming response. */
export interface StepCodeStreamState {
    blocks: OutboundContentBlock[];
    current: OpenTextBlock | null;
    /** wire tool index -> accumulating call. */
    toolCalls: Map<number, PendingToolCall>;
    hasContent: boolean;
    hasToolCall: boolean;
    finishReason: string | null;
    /** The `[DONE]` sentinel arrived. */
    done: boolean;
    /** Terminal chunks were already emitted. */
    finished: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    sawUsage: boolean;
}
interface OpenTextBlock {
    index: number;
    type: 'text' | 'reasoning';
    text: string;
}
export declare function createStreamState(): StepCodeStreamState;
/**
 * Feed one SSE line from `{base}/v1/chat/completions`.
 *
 * Heartbeats and comment frames (": ping") carry no `data:` prefix and produce
 * nothing here. The caller pulses its idle watchdog on bytes and on complete
 * frames, so a keep-alive neither becomes content nor stalls the stream: an empty
 * payload and a frame with no choices both fall through to an empty chunk list,
 * which is a no-op rather than an end-of-stream.
 */
export declare function processStreamLine(line: string, state: StepCodeStreamState): StreamChunk[];
/** The DSH accounting for one response, with cache fields omitted when zero. */
export declare function streamTokenUsage(state: StepCodeStreamState): TokenUsage;
/**
 * Flush every open block, then emit usage and the terminal finish.
 *
 * Order is a hard requirement: DSH settles a call on `finish`, so usage that
 * arrives after it is never booked.
 */
export declare function closeStream(state: StepCodeStreamState): StreamChunk[];
/**
 * A stream that ends without a terminal event is truncated, not complete.
 *
 * Chat Completions always terminates with `finish_reason` or `[DONE]`, so their
 * absence means the connection dropped mid-answer and the partial text must not
 * be presented as a finished reply.
 */
export declare function assertStreamComplete(state: StepCodeStreamState): void;
/**
 * Classify one non-2xx response into a DSH failure.
 *
 * The codes are the harness's shared vocabulary rather than this line's own, so
 * the account pool recognises `AUTH` ("this account must sign in again") and no
 * retry set picks up an exhausted-plan verdict. Context overflow is reclassified
 * through `isHttpContextOverflow` so the harness can compact and retry instead
 * of showing the user a raw window error.
 */
export declare function classifyStepCodeFailure(status: number, detail: string): LlmError;
//# sourceMappingURL=mapper.d.ts.map