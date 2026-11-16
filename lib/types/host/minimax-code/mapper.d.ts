/**
 * Provider-wire mapping for the MiniMax Code subscription.
 *
 * The subscription speaks Anthropic Messages, so this file builds a
 * \`/messages\` body and normalizes the SSE stream back into DSH's block/delta
 * vocabulary.
 *
 * WHAT IS REUSED, AND WHAT IS NOT
 *
 * The generic halves of this problem already exist beside it in
 * \`../kimi-code/mapper.ts\` and are imported rather than reimplemented: durable
 * image resolution, the image budget that drops the oldest attachments first,
 * JSON-Schema cleanup for tool parameters. None of those is provider-specific,
 * and having one implementation is what keeps the two lines from drifting.
 *
 * The serialized-body guard is deliberately NOT in that shared list. It looks
 * generic and is not: the byte ceiling it enforces is a property of the upstream
 * gateway, so Kimi's 2 MB figure was Kimi's and had no standing here. It was
 * imported anyway, and the cost was a local refusal on conversations this route
 * would have served. The shape of the check is shared; the number is per-route,
 * and \`maxMessageBodyBytes\` in ./types.ts is where the number lives.
 *
 * The provider-specific halves are written here:
 *
 * - the thinking control. The subscription's own model table names its thinking
 *   vocabulary (M2.7 always on with no level, M3 a two-state switch, M3.1 forced
 *   on with a level), which is not Kimi's low/high/max ladder; and
 * - every diagnostic string, because an error a user reads must name the service
 *   they are actually talking to.
 *
 * WHAT IS MEASURED AND WHAT IS INFERRED
 *
 * Measured (brief sections 2.1 and 2.3): the endpoint, the URL shape
 * \`<base>/mavis/api/v1/llm/v1/messages\`, the bearer header, the Anthropic
 * protocol revision, the request body \`{model, max_tokens, messages}\` answering
 * 200, and the four usage counters in the response.
 *
 * Since answered by MiniMax's own "Model Invocation" page, not inferred: thinking
 * is on by default and needs no configuration, and the only documented control on
 * the Anthropic-compatible surface is a top-level `output_config.effort` accepting
 * low, medium, high, xhigh and max. There is no `thinking` object and no
 * `budget_tokens` on this endpoint. See `outputConfigFor`.
 *
 * PROMPT CACHING IS ON BY DEFAULT, AND IT IS THE REQUEST THAT TURNS IT ON
 *
 * MiniMax documents two caching mechanisms, and they are not interchangeable:
 *
 * - an AUTOMATIC cache on its native API, which needs no marker at all; and
 * - an EXPLICIT cache on its Anthropic-compatible API, where the
 *   `cache_control` breakpoints are what create the cache at all
 *   (`tools` -> `system` -> `messages`, at most MAX_CACHE_BREAKPOINTS per
 *   request, per the "Explicit Prompt Caching (Anthropic API)" page of the
 *   MiniMax docs).
 *
 * This line speaks the Anthropic dialect, so the explicit mechanism is the one
 * that applies: a request with no breakpoint gets no `cache_read_input_tokens`
 * back no matter how identical its bytes are turn over turn, which is exactly
 * why this route showed no cache hits before the markers went in.
 *
 * The shape is the Claude line's (claude/mapper.ts, section 7), because the
 * wire vocabulary is the same and that shape is the one MiniMax's
 * explicit-caching page documents: breakpoints on the LAST system block, the
 * last block of the LAST user message, and the last tool. The first requires
 * `system` to go out as a block array rather than the plain string this line
 * was first measured with, so the array form is used only while caching is on -
 * a caller that opts out (MinimaxRequestOptions.cacheControl === false) gets
 * the original string body byte-for-byte.
 */
import { type ContentBlock, type OutboundContentBlock, type GenerateOptions, type StreamChunk } from '../common/llm-compat.ts';
import { estimatedInputTokens } from '../common/prompt-estimate.ts';
import { offloadOldestRequestImages, resolveRequestImages, type AttachmentImageReader, type ResolvedRequestImages } from '../common/request-images.ts';
import { offloadOldestRequestVideos, requestHasVideo, resolveRequestVideos, type AttachmentVideoReader, type ResolvedRequestVideos } from '../common/video-request.ts';
export { offloadOldestRequestVideos, requestHasVideo, resolveRequestVideos, type AttachmentVideoReader, type ResolvedRequestVideos, };
import { ANTHROPIC_VERSION, DEFAULT_MAX_MESSAGE_BODY_BYTES, DEFAULT_MAX_REQUEST_IMAGE_BYTES, MAX_REQUEST_VIDEO_BYTES, maxMessageBodyBytes, maxRequestImageBytes } from './types.ts';
export { DEFAULT_MAX_MESSAGE_BODY_BYTES, DEFAULT_MAX_REQUEST_IMAGE_BYTES, MAX_REQUEST_VIDEO_BYTES, estimatedInputTokens, maxMessageBodyBytes, maxRequestImageBytes, offloadOldestRequestImages, resolveRequestImages, };
export type { AttachmentImageReader, ResolvedRequestImages };
/** Anthropic content blocks are plain JSON objects on the wire. */
type AnthropicBlock = Record<string, unknown>;
/** Provenance scope for safe thinking replay. */
export interface MinimaxReplayScope {
    route: string;
    model: string;
    authOwner: string;
    provider?: string;
}
/**
 * The thinking control for one request, as documented by MiniMax.
 *
 * The official "Model Invocation" page settles the shape, and it is NOT a
 * `thinking` object:
 *
 * > Thinking is **on by default and needs no configuration**.
 *
 * > Protocol | Thinking depth field | Where thinking content is returned
 * > Anthropic-compatible | `output_config.effort` | `thinking` content block
 * > OpenAI-compatible  | `reasoning_effort` | `reasoning_content` field
 *
 * Three consequences, each replacing something this function used to do:
 *
 * 1. No `thinking` key is ever sent. The field was inferred, never documented,
 *    and a request that thinks is exactly a request that says nothing - which is
 *    why the field could sit here for months with nothing contradicting it.
 * 2. The depth level belongs at the TOP level, in `output_config.effort`, not
 *    inside a thinking object. Anywhere else is a field the service does not read.
 * 3. `effort` accepts low, medium, high, xhigh and max. There is no `default`
 *    member: the page says omitting the field means max, so `default` must not
 *    reach the wire, and neither must an explicit `max` for the same reason.
 *
 * The off switch is a separate question the docs only answer for M3.1, where turning
 * thinking off returns a 400. `toggle` models keep theirs because the
 * subscription's own model table still names a none-thinking state for them.
 *
 * @returns the value for `output_config`, or undefined when the request should
 *   carry no thinking control at all.
 */
export declare function outputConfigFor(modelId: string, requestedEffort: string | undefined | null): Record<string, unknown> | undefined;
/**
 * Smallest output cap this line will send for a model whose thinking cannot be
 * turned off.
 *
 * Such a model spends its cap on reasoning before it emits any text, so a caller
 * that wants only a few words can be capped below the reasoning floor and get an
 * empty answer. Measured on the M3.1 forced-thinking path with a session-title
 * prompt: \`max_tokens: 64\` returns \`stop_reason: "max_tokens"\` with one thinking
 * block and no text; \`max_tokens: 512\` returns \`stop_reason: "end_turn"\` with the
 * title after ~53 output tokens.
 *
 * The floor only ever RAISES a cap smaller than this line's forced thinking needs,
 * so a caller that states a larger cap keeps it - the catalog's "preserving
 * explicit caller maxTokens" contract stays intact. It never raises past what
 * the catalog says the model can emit either: a floor the wire would reject is
 * not a floor.
 */
export declare const MINIMAX_FORCED_THINKING_FLOOR_TOKENS = 512;
/**
 * Raise a cap that is too small for this line's forced thinking.
 *
 * Left alone: a model that can disable thinking (its caller may have asked for
 * thinking off on purpose, and raising the cap would not enable it but a caller
 * reading the number back would be misled), and an absent cap (the caller stated
 * none, so \`maxOutputTokensFor\` owns the ceiling).
 *
 * @param modelId - the routed model id.
 * @param requested - the caller's cap, undefined when it stated none.
 * @returns the cap to request, raised only when that is the difference between an
 * empty truncated answer and a usable one.
 */
export declare function floorForcedThinkingTokens(modelId: string, requested: number | undefined): number | undefined;
/** Output cap one request asks for, tracked against the model's declared ceiling. */
export declare function maxOutputTokensFor(modelId: string, contextWindow?: number): number;
/** Reduce a requested cap so prompt plus output still fit the window. */
export declare function clampOutputToContext(requested: number, contextWindow: number, estimatedInputTokens?: number): number;
/**
 * Breakpoint budget the wire enforces.
 *
 * MiniMax's explicit-caching page caps a request at four `cache_control`
 * markers, the same number Anthropic allows (claude/mapper.ts). This module
 * marks at most three (see the module doc), so the budget is never the binding
 * constraint - the constant exists so a test can assert that against the REAL
 * number rather than a magic three.
 */
export declare const MAX_CACHE_BREAKPOINTS = 4;
/**
 * How many cache_control markers one built body carries.
 *
 * Walks the finished body rather than counting calls to the marker: the number
 * the wire enforces is the number of markers IN THE BYTES, so a test that
 * counts its own marking calls could pass while the body carried a fourth
 * breakpoint from somewhere else. Used by the tests only.
 */
export declare function countMinimaxCacheBreakpoints(body: unknown): number;
/** Options for one built request that are not part of the conversation itself. */
export interface MinimaxRequestOptions {
    /**
     * Emit prompt-cache breakpoints. Default TRUE: caching is what a caller that
     * states nothing gets (see the module doc). Pass false only to opt out.
     *
     * When on, breakpoints go on the last system block, the last block of the
     * last user message, and the last tool - at most
     * {@link MAX_CACHE_BREAKPOINTS} in total, and `system` goes out as a block
     * array because a plain string cannot carry a marker.
     */
    cacheControl?: boolean;
    /** Videos read for this request; absent means none were resolved. */
    videos?: ResolvedRequestVideos;
    /**
     * Whether the selected model declares video input.
     *
     * Only M3 and M3.1 do. When false a clip degrades to a text placeholder
     * rather than being dropped, so the model asks for a description instead of
     * answering as though the message were empty.
     */
    videoAccepted?: boolean;
    /** Nonsecret hash of the adapter-selected auth owner, required to scope replay. */
    authOwner?: string;
    /** Route identity for replay scoping; defaults to PROVIDER_ID. */
    route?: string;
}
/** Build one Anthropic Messages body for this subscription. */
export declare function buildMinimaxRequest(options: GenerateOptions, images?: ResolvedRequestImages, request?: MinimaxRequestOptions): Record<string, unknown>;
/**
 * Reject a request past this route's byte ceiling, before spending the connection.
 *
 * The ceiling is this route's own (`maxMessageBodyBytes`), NOT Kimi Code's 2 MB
 * figure: that number belongs to Kimi's gateway, was imported here on the
 * "same family of endpoints" assumption, and refused locally conversations
 * MiniMax would have served. See `types.ts` for the full derivation. The
 * consequence that matters: this guard must never be the reason an ordinary
 * turn fails, so it sits far above any real conversation and fires only on a
 * runaway one.
 *
 * @returns the serialized body, so the caller about to send it does not serialize
 * a multi-megabyte string a second time.
 */
export declare function assertRequestBodyFits(body: Record<string, unknown>, limit?: number): string;
/** One tool call accumulating across content-block deltas. */
interface PendingToolCall {
    blockIndex: number;
    id: string;
    name: string;
    arguments: string;
}
/** Stream accumulator for one Messages response. */
/** Native blocks the service issued for this turn, kept for exact replay. */
export interface MinimaxStreamState {
    provenance?: MinimaxReplayScope;
    /** Native blocks by DSH block index (null if text/tool-call that has no native thinking). */
    replayBlocks: (AnthropicBlock | null)[];
    /** Wire content index -> pending thinking block info. */
    pendingThinking: Map<number, {
        dshIndex: number;
        kind: 'thinking' | 'redacted_thinking';
        text: string;
        signature: string;
        data?: string;
    }>;
    blocks: OutboundContentBlock[];
    current: {
        index: number;
        type: 'text' | 'reasoning';
        text: string;
    } | null;
    /** wire content-block index -> accumulating call. */
    toolCalls: Map<number, PendingToolCall>;
    /** wire content-block index -> our block index. */
    contentIndexes: Map<number, number>;
    hasContent: boolean;
    hasToolCall: boolean;
    finishReason: string | null;
    /**
     * The wire `error` object of an in-band `error` event, recorded just before
     * the mapper throws on it. The mapper cannot tell whether anything has reached
     * the caller yet; the adapter can, and reclassifies a transient one from this
     * while nothing has.
     */
    streamError?: Record<string, unknown>;
    done: boolean;
    finished: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    sawUsage: boolean;
}
export interface MinimaxStreamStateOptions {
    model?: string;
    authOwner?: string;
    route?: string;
    provider?: string;
}
export declare function createStreamState(options?: MinimaxStreamStateOptions): MinimaxStreamState;
/**
 * The phrase this line stamps on the failure it reports for a turn that ended
 * without an answer or a tool call.
 *
 * Exported so a host-side hook can recognise that failure by construction,
 * instead of copying the sentence. Only the phrase is matched, never the whole
 * message: the rest of it carries diagnostics that may change.
 */
export declare const NO_ANSWER_PHRASE = "ended the turn without an answer or a tool call";
/** Flush every open block, then emit usage and the terminal finish. */
export declare function closeMinimaxStream(state: MinimaxStreamState): StreamChunk[];
/** Raise when a stream ended without the terminal event the protocol promises. */
export declare function assertStreamComplete(state: MinimaxStreamState): void;
/** Feed one SSE line from the Messages endpoint. */
export declare function processMinimaxStreamLine(line: string, state: MinimaxStreamState): StreamChunk[];
/** Whether one chunk stream carried any assistant content at all. */
export declare function streamHasContent(state: MinimaxStreamState): boolean;
export { ANTHROPIC_VERSION, type ContentBlock };
//# sourceMappingURL=mapper.d.ts.map