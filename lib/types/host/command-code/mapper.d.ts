/**
 * Provider-wire mapping for the two Command Code provider endpoints.
 *
 * The API serves Anthropic-format models on `/messages` and everything else on
 * `/chat/completions`; it validates the split and rejects a model sent to the
 * wrong endpoint. Both wires are mapped here so one adapter can serve the whole
 * catalog, and both streams are normalized into DSH's block/delta vocabulary.
 *
 * https://commandcode.ai/blog/command-code-provider-api
 */
import { type OutboundContentBlock, type GenerateOptions, type StreamChunk } from '../common/llm-compat.ts';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { CommandCodeWire } from '../../shared/command-code-contracts.ts';
/** Attachment seam this route needs: verified bytes for one durable image. */
export type AttachmentImageReader = Pick<AttachmentStore, 'readImage'>;
/** One durable user image resolved for an in-flight request, or proven unreadable. */
export type ResolvedRequestImage = {
    readonly kind: 'inline';
    readonly mediaType: string;
    readonly data: string;
} | {
    readonly kind: 'unavailable';
};
/** Resolved images keyed by durable attachment id; consumed by one request build. */
export type ResolvedRequestImages = ReadonlyMap<string, ResolvedRequestImage>;
/**
 * Base64 image payload one request may carry.
 *
 * Both Command Code endpoints are proxies: the body is forwarded to whichever
 * upstream serves the model, so the bound has to hold for the strictest of
 * them. 12 MB matches what this plugin already allows its Gemini route and
 * keeps the conversation text, tool schemas, and system prompt inside the same
 * body.
 */
export declare const MAX_REQUEST_IMAGE_BYTES: number;
/**
 * Replace the oldest inline images with a text placeholder once one request
 * would carry more than {@link MAX_REQUEST_IMAGE_BYTES} of base64 image data.
 * Durable history is untouched; only the request about to be sent changes.
 */
export declare function offloadOldestRequestImages(options: GenerateOptions): GenerateOptions;
/**
 * Read every durable `{ type: 'image', attachment }` block one request carries.
 * An unreadable image resolves to `unavailable` rather than disappearing, so
 * the model is told the picture is missing instead of answering about a blank.
 */
export declare function resolveRequestImages(options: GenerateOptions, attachments: AttachmentImageReader | undefined, signal?: AbortSignal): Promise<ResolvedRequestImages>;
/** Drop the JSON-Schema keywords provider gateways reject or ignore. */
export declare function stripMetaSchema(schema: unknown): Record<string, unknown>;
/** Build one `/chat/completions` body. */
export declare function buildOpenAIRequest(options: GenerateOptions, images?: ResolvedRequestImages): Record<string, unknown>;
/** Reasoning budget a thinking-enabled request may spend, given its output cap. */
export declare function thinkingBudgetFor(effort: string | undefined, maxTokens: number): number | undefined;
/** Build one `/messages` body. */
export declare function buildAnthropicRequest(options: GenerateOptions, images?: ResolvedRequestImages): Record<string, unknown>;
/** Build the body for whichever endpoint serves `modelId`. */
export declare function buildRequest(options: GenerateOptions, wire: CommandCodeWire, images?: ResolvedRequestImages): Record<string, unknown>;
export declare function buildResponsesRequest(options: GenerateOptions, images?: ResolvedRequestImages): Record<string, unknown>;
/** One tool call accumulating across `chat/completions` deltas. */
interface PendingToolCall {
    blockIndex: number;
    id: string;
    name: string;
    arguments: string;
    started: boolean;
}
/**
 * One failure a Command Code stream reported INSIDE a 200 response.
 *
 * ALL THREE of this line's wires can answer 200 and then report the failure in
 * the stream, in the envelope a non-2xx body would have carried, and they speak
 * three different vocabularies. The messages wire sends `{ type: `error`, error:
 * { type, message } }`, where `type` stands for a STATUS. The Responses wire sends
 * `response.failed` or `error` whose error may be an object, a nested
 * `response.error`, or a bare string. The chat-completions wire puts the error
 * straight on the chunk - `{"error":{"message","type"}}`, the body this route's own
 * upstream reports, which names `type` where the others would name a code.
 */
export interface InBandStreamError {
    /**
     * Which wire named it, and so which rule reads it.
     *
     * Recorded rather than inferred from the request that produced it: only the
     * branch that threw knows, and the rules genuinely differ - a `type` that stands
     * for a status on the messages wire, a code or plain prose that stands for one
     * on the other two. The values are the wire values themselves, so an adapter
     * reading them cannot mistake one vocabulary for another.
     */
    vocabulary: 'openai' | 'anthropic' | 'responses';
    /**
     * The event's wire `error` object, or null when the event carried only text.
     *
     * A Responses `error` event may be a bare string, and then nothing structured
     * is left to read: the message below is the whole signal.
     */
    error: Record<string, unknown> | null;
    /** The provider's own diagnostic, as this mapper folded it into its message. */
    message: string;
}
export interface CommandCodeStreamState {
    wire: CommandCodeWire;
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
     * The in-band failure this wire reported inside a 200 response, recorded just
     * before the mapper throws on it. Undefined until such an event arrives, and
     * never set by any other failure.
     *
     * The mapper cannot know whether anything has reached the caller, so the code
     * it throws is the general one; the adapter can, and reclassifies a transient
     * one from this while nothing has. It is left in place afterwards so a reader
     * of the state can still see what the stream ended on.
     */
    streamError?: InBandStreamError;
    done: boolean;
    finished: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    sawUsage: boolean;
}
export declare function createStreamState(wire: CommandCodeWire): CommandCodeStreamState;
/** Feed one SSE `data:` payload from `/chat/completions`. */
export declare function processOpenAIStreamLine(line: string, state: CommandCodeStreamState): StreamChunk[];
/** Feed one SSE `data:` payload from `/messages`. */
export declare function processAnthropicStreamLine(line: string, state: CommandCodeStreamState): StreamChunk[];
/**
 * Fold one SSE line from `/responses`.
 *
 * The Responses stream is event-typed rather than delta-shaped: text arrives as
 * `response.output_text.delta`, tool calls as `function_call_arguments.delta`
 * keyed by an item id, and the turn ends on `response.completed` or
 * `response.failed`. Those are read as written; there is no Chat Completions
 * shape to reinterpret.
 */
export declare function processResponsesStreamLine(line: string, state: CommandCodeStreamState): StreamChunk[];
/** Flush every open block, then emit usage and the terminal finish. */
export declare function closeStream(state: CommandCodeStreamState): StreamChunk[];
/** Model families whose stream never carried a terminal event. */
export declare function assertStreamComplete(state: CommandCodeStreamState): void;
export {};
//# sourceMappingURL=mapper.d.ts.map