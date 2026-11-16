/**
 * Provider-wire mapping for the Kimi Code coding endpoints.
 *
 * Two surfaces serve the same models:
 *
 * - the OpenAI-compatible `/coding/v1/chat/completions`, which is what the
 *   official CLI configures for its managed provider and therefore the default
 *   here; and
 * - the Anthropic-compatible `/coding/v1/messages?beta=true`, which authenticates
 *   with `x-api-key` rather than a bearer token.
 *
 * Both are mapped here, and both streams are normalized into DSH's block/delta
 * vocabulary.
 *
 * Two Kimi-specific behaviours shape the request builders:
 *
 * 1. Thinking is selected with `reasoning_effort` and accepts only
 *    low/high/max; anything else the client sends is answered with HTTP 400, so
 *    a caller's broader effort vocabulary is narrowed here rather than passed
 *    through. Thinking off is expressed as `thinking: {type: "disabled"}`.
 * 2. When thinking is on, Kimi requires `reasoning_content` on an assistant
 *    message that also carries tool calls — the service answers 400
 *    "thinking is enabled but reasoning_content is missing" otherwise. Reasoning
 *    blocks are therefore replayed on the OpenAI wire, unlike the sibling routes
 *    which drop them.
 *
 * See https://www.kimi.com/code/docs/en/kimi-code/error-reference.html
 */
import { type OutboundContentBlock, type GenerateOptions, type Message, type StreamChunk } from '../common/llm-compat.ts';
import { normalizeKimiToolSchema } from '../common/tool-schema.ts';
import { estimatedInputTokens } from '../common/prompt-estimate.ts';
export { estimatedInputTokens, normalizeKimiToolSchema };
import { MAX_MESSAGE_BODY_BYTES, MAX_REQUEST_IMAGE_BYTES, MAX_REQUEST_VIDEO_BYTES, MAX_VIDEO_MESSAGE_BODY_BYTES, NO_RESOLVED_IMAGES, REQUEST_IMAGE_MAX_EDGE, offloadOldestRequestImages, requestImageTarget, resolveRequestImages, type AttachmentImageReader, type ResolvedRequestImage, type ResolvedRequestImages } from '../common/request-images.ts';
export { MAX_MESSAGE_BODY_BYTES, MAX_REQUEST_IMAGE_BYTES, MAX_REQUEST_VIDEO_BYTES, MAX_VIDEO_MESSAGE_BODY_BYTES, NO_RESOLVED_IMAGES, REQUEST_IMAGE_MAX_EDGE, offloadOldestRequestImages, requestImageTarget, resolveRequestImages, type AttachmentImageReader, type ResolvedRequestImage, type ResolvedRequestImages, };
import { type KimiCacheTtl } from './types.ts';
import { offloadOldestRequestVideos as offloadVideosWithinBudget, requestHasVideo, resolveRequestVideos, type AttachmentVideoReader, type ResolvedRequestVideos } from '../common/video-request.ts';
export { offloadVideosWithinBudget as offloadOldestRequestVideos, requestHasVideo, resolveRequestVideos, type AttachmentVideoReader, type ResolvedRequestVideos, };
import type { KimiCodeReasoningEffort, KimiCodeWire } from '../../shared/kimi-code-contracts.ts';
/**
 * Wire keys an OpenAI-compatible response can carry reasoning under.
 *
 * The Chat Completions ecosystem never standardized one. Kimi answers with
 * `reasoning_content`; newer vLLM builds renamed the field to `reasoning` and
 * accept only that name on the request side, and gateways in between use
 * `reasoning_details`. The first entry doubles as the default for a request
 * made before any response has been seen.
 */
export declare const KNOWN_REASONING_KEYS: readonly ["reasoning_content", "reasoning_details", "reasoning"];
/** Default outbound reasoning key, used until a response proves otherwise. */
export declare const DEFAULT_REASONING_KEY: string;
/**
 * Per-endpoint reasoning-field dialect: observes what the endpoint actually
 * sends, and echoes thinking back under the same key.
 *
 * Sending `reasoning_content` to an endpoint that only reads `reasoning` is not
 * a cosmetic mismatch — preserved thinking then reports the thinking as
 * missing, so the model loses the reasoning chain of every prior assistant
 * turn. Detection never clears: a response with no reasoning keeps the last
 * known dialect, and an endpoint that switches is adapted on its next reply.
 */
export declare class ReasoningKeyDialect {
    private detected;
    /** Reasoning text on an inbound message or delta, remembering its key. */
    observe(source: unknown): string | undefined;
    /** The key to serialize thinking into on an outbound assistant message. */
    outboundKey(): string;
    /** Forget the detected key, returning to the default. Test seam only. */
    reset(): void;
}
/**
 * The reasoning key an outbound assistant message should use.
 *
 * Exposed for tests and for the request builder, which builds outside any
 * stream state.
 */
export declare function outboundReasoningKey(): string;
/** Reset the learned dialect. Test seam only. */
export declare function resetReasoningDialect(): void;
/**
 * Sanitize one id into the shape the service accepts, without dedup.
 *
 * Exported because the request builders and the stream readers must agree on
 * the result, and the guarantee callers actually rely on is that this is
 * idempotent: sanitizing an already-sanitized id returns it unchanged, so an id
 * that has been through here once stays stable across every later turn.
 *
 * Use {@link ToolCallIdNormalizer} instead wherever more than one id in the
 * same request must be kept distinct.
 */
export declare function clampToolCallId(id: string): string;
/**
 * Assigns collision-free tool-call ids across one request.
 *
 * Truncation alone is not injective: two ids sharing a 64-character prefix
 * clamp to the same value, and a later tool result then resolves against the
 * wrong call. This maps each raw id to a unique sanitized id, appending
 * `_2`, `_3`, … on collision, and returns the same answer for the same
 * input for the lifetime of the normalizer.
 *
 * One normalizer serves one request (or one stream), so the mapping is
 * request-scoped by construction: a conversation whose history is replayed
 * re-derives the same assignment from the same inputs, which is what keeps
 * a tool result answerable by the call it belongs to.
 */
export declare class ToolCallIdNormalizer {
    private readonly assigned;
    private readonly used;
    /** The unique sanitized id for `id`, stable for the life of this normalizer. */
    normalize(id: string): string;
}
/**
 * Service limits on the request shape, from the official error reference.
 *
 * Both were documented as hard 400s, so exceeding them costs the whole turn
 * rather than degrading gracefully — which is why the request is trimmed to fit
 * instead of being sent and rejected.
 */
export declare const MAX_STOP_SEQUENCES = 5;
export declare const MAX_STOP_SEQUENCE_BYTES = 32;
/**
 * Whether one request asks the service to keep reasoning across turns.
 *
 * Kimi's models reason by default and the official CLI ships Preserved Thinking
 * ON (`[thinking] keep = "all"`), which is what its own error reference assumes
 * when it demands `reasoning_content` on every assistant message. An
 * environment opt-out exists for a deployment that would rather not pay for the
 * replayed reasoning tokens.
 */
export declare function preserveThinkingEnabled(env?: NodeJS.ProcessEnv): boolean;
/**
 * Trim stop sequences to what the service accepts.
 *
 * At most five entries, each at most 32 bytes; a longer sequence is dropped
 * rather than truncated, because a shortened stop string would halt generation
 * at the wrong place — silently changing the answer is worse than not stopping.
 */
export declare function stopSequences(stop: readonly string[] | undefined): string[];
/**
 * Narrow a caller's effort onto the levels Kimi accepts.
 *
 * DSH exposes low/high/max/none for these models, but a conversation can hold
 * an effort chosen for a different provider, so the broader vocabulary the rest
 * of the plugin uses is mapped rather than rejected: an unknown value would be
 * answered with HTTP 400 and fail the turn.
 */
export declare function mapReasoningEffort(effort: string | undefined | null): KimiCodeReasoningEffort | undefined;
/**
 * Thinking-token budget one Anthropic-route level asks for.
 *
 * Kimi's Anthropic surface takes the standard `thinking` block, so the budget is
 * derived from the same three levels the OpenAI surface uses.
 */
export declare function thinkingBudgetFor(effort: KimiCodeReasoningEffort | undefined, maxTokens: number): number | undefined;
export interface RequestMediaOptions {
    /** Videos read for this request; absent means none are readable. */
    videos?: ResolvedRequestVideos;
    /** Whether the selected model declares video input. */
    videoAccepted?: boolean;
    /**
     * Whether the selected model accepts message-level tool declarations
     * (`messages[].tools`), Kimi's `dynamically_loaded_tools` capability.
     */
    messageTools?: boolean;
    /**
     * Prompt-cache tier to request, or `null` to leave the service default.
     *
     * Kimi documents two separate fields for this and they are NOT interchangeable:
     * the OpenAI-compatible wire takes `prompt_cache_options`, and the
     * Anthropic wire takes a TOP-LEVEL `cache_control` (a marker inside a message
     * is explicitly ignored by the service). `null` sends neither, which is what
     * this line did before and remains the safe default: a caller that states
     * nothing gets the service's own 5m behaviour.
     */
    cacheTtl?: KimiCacheTtl | null;
}
/**
 * One complete tool definition, in the shape the function-calling wire wants.
 *
 * The service rejects a bare tool name: a message-level declaration must carry
 * the same name/description/parameters triple the top-level list carries, so
 * the caller cannot pass a reference and let the model guess.
 */
export interface DynamicToolDeclaration {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}
/**
 * A tool declaration that belongs to a message rather than the request.
 *
 * DSH has no message-level tool field, so the producer sets this symbol on a
 * system-role {@link Message} to ask for one. A symbol is used rather than a
 * string key because every other reader of a message — the session log, the
 * transcript UI, another adapter — must not start seeing a field it cannot
 * honor; the property is invisible to them and only this mapper looks for it.
 */
export declare const MESSAGE_TOOLS: unique symbol;
/**
 * Serializable key the declaration travels under.
 *
 * A symbol alone is not enough: the session log persists messages through
 * JSON, which drops symbol-keyed properties, so a restored session would lose
 * every declaration and the model would believe it had tools the request no
 * longer carries. The declaration is therefore stored under a plain string key
 * AND the symbol, so in-process readers keep the exempt-from-`Object.keys`
 * behaviour while a round trip through persistence still reconstructs it.
 */
export declare const MESSAGE_TOOLS_KEY = "kimiCodeMessageTools";
/**
 * Attach message-level tool declarations to one system message.
 *
 * Two copies are written deliberately, and they differ in visibility:
 *
 * - the SYMBOL copy is non-enumerable, so a reader that inspects a message the
 *   ordinary way (the transcript UI, a sibling adapter) sees nothing new and
 *   cannot mistake an unhandled field for something it must act on;
 * - the STRING-KEYED copy is enumerable, because JSON persistence only
 *   serializes enumerable string keys and a declaration that vanishes on
 *   session resume is worse than one that is visible. Readers that do walk the
 *   keys will see `kimiCodeMessageTools`; the convention is that only this
 *   route's mapper interprets it.
 */
export declare function withMessageTools<T extends Message>(message: T, tools: readonly DynamicToolDeclaration[]): T;
/** Message-level tool declarations one message carries, when any. */
export declare function messageToolsOf(message: Message): readonly DynamicToolDeclaration[] | undefined;
/**
 * Re-attach declarations after a message has been through JSON.
 *
 * Persistence keeps the declarations but necessarily loses the symbol, so a
 * restored message exposes them only under {@link MESSAGE_TOOLS_KEY}. This
 * restores the symbol too, which is what makes a declaration survive a resumed
 * session instead of silently disappearing.
 */
export declare function rehydrateMessageTools<T extends Message>(message: T): T;
/** Build one `/chat/completions` body. */
export declare function buildOpenAIRequest(options: GenerateOptions, images?: ResolvedRequestImages, preserveThinking?: boolean, media?: RequestMediaOptions): Record<string, unknown>;
/**
 * Stable identifier for the conversation this request belongs to.
 *
 * The key is derived from the session identifier alone — never from message
 * content. The official agent keys its cache on the conversation (its
 * sessionId) so the key survives context compaction and multimodal churn
 * byte-for-byte. Deriving it from the first user message (as a fallback once
 * did) produces a key that CHANGES the moment compaction rewrites that first
 * message, silently re-routing the whole session to a cold cache entry and
 * collapsing the hit rate. A session that has no identity yet sends no key at
 * all rather than a key that will drift.
 */
export declare function promptCacheKey(options: GenerateOptions): string | undefined;
/** Build one `/v1/messages` body. */
export declare function buildAnthropicRequest(options: GenerateOptions, images?: ResolvedRequestImages, media?: RequestMediaOptions): Record<string, unknown>;
/** Build the body for whichever endpoint serves `wire`. */
export declare function buildRequest(options: GenerateOptions, wire: KimiCodeWire, images?: ResolvedRequestImages, preserveThinking?: boolean, media?: RequestMediaOptions): Record<string, unknown>;
/**
 * Reject a request the service would answer with its 2 MB body 400.
 *
 * This is the most frequently reported 400 on the coding endpoint, and it is
 * worth catching locally for two reasons: the message can name the actual
 * remedy (DSH's compaction), and a request that cannot succeed should not be
 * sent at all. The measured size is the real serialized body, so it accounts
 * for tool schemas and inlined images the caller cannot easily estimate.
 *
 * @returns the serialized body, so a caller that is about to send it does not
 * serialize a body of up to tens of megabytes a second time.
 */
/**
 * What the body-fit loop actually did, so the remedy can describe it.
 *
 * Optional by design: a caller that has not run the loop leaves it undefined and
 * gets the composition-based message, so every direct assertion of this guard
 * keeps its exact text.
 */
export interface BodyFitContext {
    /** How many image occurrences the loop already replaced with a placeholder. */
    readonly droppedImages: number;
    /** How many sendable image occurrences the body still carries. */
    readonly sendableImagesRemaining: number;
    /** The overflow that remained after the last drop. */
    readonly excessBytes: number;
}
export declare function assertRequestBodyFits(body: Record<string, unknown>, carriesVideo?: boolean, context?: BodyFitContext): string;
/**
 * How a request body splits into the parts that share the ceiling.
 *
 * The 2 MB limit covers images, conversation text, tool schemas and the system
 * prompt together, but only the first is compressible by dropping something. A
 * message that names which part dominates is the difference between a user who
 * compacts the conversation and a user who deletes images and fails again.
 */
export interface RequestBodyBreakdown {
    readonly totalBytes: number;
    readonly imageBytes: number;
    readonly toolSchemaBytes: number;
    readonly otherBytes: number;
}
/**
 * Measure one already-serialized body by composition.
 *
 * Image payload is found structurally (a base64 `data:` URL or an Anthropic
 * base64 source) rather than by searching for a marker substring, so a user
 * message that happens to contain that text cannot inflate the image share.
 */
export declare function requestBodyBreakdown(body: Record<string, unknown>, carriesVideo?: boolean): RequestBodyBreakdown;
/** One tool call accumulating across `chat/completions` deltas. */
interface PendingToolCall {
    blockIndex: number;
    id: string;
    name: string;
    arguments: string;
    started: boolean;
}
/**
 * One failure the stream reported itself, as the wire stated it.
 *
 * The vocabulary travels with the object because the two wires do not spell a
 * transient failure the same way — an Anthropic frame is an `error` EVENT, an
 * OpenAI one an `error` field on an ordinary data frame — so the same verdict is
 * reached by two different rules, and the adapter cannot re-derive which one
 * applied from the wire it happened to send the request on.
 */
export interface KimiCodeInBandStreamError {
    /** Wire the event was read with; it selects the vocabulary it reclassifies by. */
    vocabulary: KimiCodeWire;
    /** The event's wire `error` object, as received. */
    error: Record<string, unknown>;
    /** The provider's own diagnostic, without this mapper's prefix. */
    message: string;
}
export interface KimiCodeStreamState {
    wire: KimiCodeWire;
    blocks: OutboundContentBlock[];
    current: {
        index: number;
        type: 'text' | 'reasoning';
        text: string;
    } | null;
    /** wire tool index -> accumulating call (OpenAI route). */
    toolCalls: Map<number, PendingToolCall>;
    /** anthropic content-block index -> our block index. */
    contentIndexes: Map<number, number>;
    /** anthropic content index of the block currently open. */
    openContentIndex: number | null;
    hasContent: boolean;
    hasToolCall: boolean;
    finishReason: string | null;
    /**
     * An in-band failure, recorded just before the mapper throws on it.
     *
     * The mapper cannot tell whether anything has reached the caller yet and has
     * no other verdict to give the event; the adapter can, and reclassifies a
     * transient one from this while nothing has. Both wires record into the one
     * field because one request is served by one of them, never both.
     */
    streamError?: KimiCodeInBandStreamError;
    done: boolean;
    finished: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    sawUsage: boolean;
    /**
     * Per-request tool-call id assignment.
     *
     * The request side and the stream side must hand the service the same id for
     * the same call, and truncation alone cannot guarantee that across a
     * multi-call response. Shared by reference so both halves of one turn agree.
     */
    toolCallIds: ToolCallIdNormalizer;
    /**
     * Session this turn belongs to, when the caller stated one.
     *
     * Carried so usage can be filed under the right conversation at close time,
     * even if the caller does not pass the session again.
     */
    sessionId: string | undefined;
}
export declare function createStreamState(wire: KimiCodeWire, sessionId?: string): KimiCodeStreamState;
/** Feed one SSE `data:` payload from `/chat/completions`. */
export declare function processOpenAIStreamLine(line: string, state: KimiCodeStreamState): StreamChunk[];
/** Feed one SSE `data:` payload from `/v1/messages`. */
export declare function processAnthropicStreamLine(line: string, state: KimiCodeStreamState): StreamChunk[];
/**
 * The prefix-breaking inputs of the previous request, kept so a cache miss can
 * be attributed to the change that caused it rather than guessed at.
 *
 * kimi-code's own agent tracks exactly this pair (its `systemPromptHash` /
 * `toolsHash` telemetry) for the same reason: a bare hit ratio cannot say
 * *why* a turn went cold, but a diff of the stability inputs can.
 */
export interface PrefixStabilitySnapshot {
    systemPromptHash: string | null;
    toolsHash: string | null;
    cacheKey: string | null;
}
/**
 * Which stability input changed relative to the previous request, if any.
 *
 * `'stable'` means the prefix should have held; a miss then points at the
 * service or at content below the head. Anything else names the input that
 * broke the prefix. `'cold-key'` means no cache key was sent, so the request
 * could not be routed to the warm entry at all.
 */
export type PrefixDriftCause = 'first-request' | 'stable' | 'system-prompt' | 'tools' | 'cache-key' | 'cold-key';
/**
 * Fingerprint the current request's stability inputs and diff them against the
 * last request. Called once per request build; the result is read back when the
 * stream reports usage so a low-or-zero cache read can be explained.
 */
export declare function trackPrefixStability(options: GenerateOptions): PrefixDriftCause;
/** Record the cause computed for one in-flight request. */
export declare function recordDriftCause(cause: PrefixDriftCause, sessionId?: string): void;
/**
 * The cause attributed to the most recent request of one session.
 *
 * `undefined` for a session that has not made a request, rather than a default
 * value: an absent attribution and an unattributed first request are different
 * facts, and the caller can only tell them apart if absence is expressible.
 */
export declare function getLastDriftCause(sessionId?: string): PrefixDriftCause | undefined;
/**
 * Rolling per-process view of how well the prefix cache is working.
 *
 * Kimi's cache is automatic and content-hash based, so the only way to know
 * whether a session is actually benefiting is to watch the read ratio. It is a
 * diagnostic: nothing here changes a request.
 */
export interface KimiCodeCacheStats {
    /** Requests that reported usage. */
    requests: number;
    /** Prompt tokens that were served from cache. */
    cachedTokens: number;
    /** Prompt tokens that had to be processed fresh. */
    freshTokens: number;
    /** Output tokens, which reasoning is billed against. */
    outputTokens: number;
    /** Prompt tokens the provider counted as cache writes (always 0 on this route). */
    cacheWriteTokens: number;
}
/** Record one request's usage into its own session's totals. */
export declare function recordCacheStats(state: KimiCodeStreamState, sessionId?: string, accountId?: string): void;
/**
 * Totals for one account's share of a session, one whole session, or every
 * tracked session.
 *
 * The three cases are not a convenience: each answers a different question a
 * caller actually has. Naming an account answers "is this account's cache
 * warm", naming only a session answers "how is this conversation doing
 * overall", and naming neither answers "how is this install doing". Summing
 * the per-scope entries rather than keeping a second running total means the
 * aggregate can never drift out of step with the parts it summarises.
 */
export declare function getCacheStats(sessionId?: string, accountId?: string): KimiCodeCacheStats & {
    hitRatio: number | null;
};
/** Forget one session's numbers, or all of them. Test seam and session teardown. */
export declare function resetCacheStats(sessionId?: string): void;
/** Flush every open block, then emit usage and the terminal finish. */
export declare function closeStream(state: KimiCodeStreamState, accountId?: string): StreamChunk[];
/** Model families whose stream never carried a terminal event. */
export declare function assertStreamComplete(state: KimiCodeStreamState): void;
//# sourceMappingURL=mapper.d.ts.map