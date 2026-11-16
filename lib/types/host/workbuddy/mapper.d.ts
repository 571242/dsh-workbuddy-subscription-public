/**
 * Wire mapping for the WorkBuddy / CodeBuddy subscription chat endpoint.
 *
 * The endpoint is OpenAI Chat Completions shaped, but with three measured
 * deviations from the OpenAI default that this module exists to absorb:
 *
 * 1. **Stream only.** `stream: false` answers 400 `code 11101`. The request
 *    builder therefore always sends `stream: true`, and there is no
 *    non-streaming code path to keep in sync.
 * 2. **A leading system message is mandatory on the international backend.**
 *    A request whose first message is a user turn answers 400 `code 11128`
 *    ("first message is not system prompt"). {@link buildChatRequest} injects
 *    one when the caller supplied none, so a hand-built one-shot request cannot
 *    trip this. Note that the same code is also the gateway's channel-verification
 *    refusal (`msg: "conversation id missing"`), which the conversation header
 *    group this route sends is what satisfies — see `conversationHeaders` in
 *    `client.ts`. A history that is already correct can still answer 11128 for
 *    that second reason, so the code alone does not implicate the messages.
 * 3. **Reasoning rides `delta.reasoning_content`,** not OpenAI's
 *    `reasoning_summary`, and is emitted as its own DSH reasoning block.
 */
import { type OutboundContentBlock, type GenerateOptions, type StreamChunk } from '../common/llm-compat.ts';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
/**
 * The system prompt every request must open with.
 *
 * The international backend rejects a request whose first message is not a
 * system turn, so this stands in when the caller supplies no prompt at all. It
 * is deliberately neutral: it must not change model behaviour beyond satisfying
 * the shape check.
 */
declare const IMPLICIT_SYSTEM_PROMPT = "You are a helpful assistant.";
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
 * The subscription proxies to several upstream vendors, so the bound has to
 * hold for the strictest of them. 12 MB matches what this plugin's other
 * routes allow and keeps the conversation text and tool schemas in the same
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
/**
 * Build one `/v2/chat/completions` body.
 *
 * Always `stream: true`: the endpoint rejects a non-streaming request outright
 * (400 `code 11101`), so there is no second shape to produce.
 */
export declare function buildChatRequest(options: GenerateOptions, images?: ResolvedRequestImages): Record<string, unknown>;
interface PendingToolCall {
    blockIndex: number;
    id: string;
    name: string;
    arguments: string;
    started: boolean;
}
export interface WorkBuddyStreamState {
    blocks: OutboundContentBlock[];
    current: {
        index: number;
        type: 'text' | 'reasoning';
        text: string;
    } | null;
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
    /**
     * Text held back while it may still turn into a printed tool call.
     *
     * `holding` is set once a `<` that could open a call region was seen; the
     * buffer then grows until the region closes (or the cap is hit), and is
     * resolved into prose or calls exactly once.
     */
    printed: {
        pending: string;
        holding: boolean;
    };
}
export declare function createStreamState(): WorkBuddyStreamState;
/** Feed one SSE line from `/v2/chat/completions`. */
export declare function processStreamLine(line: string, state: WorkBuddyStreamState): StreamChunk[];
/** Flush every open block, then emit usage and the terminal finish. */
export declare function closeStream(state: WorkBuddyStreamState): StreamChunk[];
/**
 * A stream that ends without a terminal event is truncated, not complete.
 *
 * The endpoint always terminates with either `finish_reason` or `[DONE]`, so
 * their absence means the connection dropped mid-answer and the partial text
 * must not be presented as a finished reply.
 */
export declare function assertStreamComplete(state: WorkBuddyStreamState): void;
export { IMPLICIT_SYSTEM_PROMPT };
//# sourceMappingURL=mapper.d.ts.map