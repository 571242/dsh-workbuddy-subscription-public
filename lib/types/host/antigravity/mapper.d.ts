import { type OutboundContentBlock, type GenerateOptions, type StreamChunk } from '../common/llm-compat.ts';
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { type AntigravityModelDef } from './types.ts';
import { type AntigravityToolSchemaOptions } from './tool-schema.ts';
export declare function sanitizeToolCallId(id: string, fallbackName: string): string;
/**
 * Attachment seam this route needs: verified bytes for one durable image, and a
 * downscaled request version of one that is larger than the wire wants.
 *
 * Every harness generation in the peer range declares readImageRequest; a
 * backend that cannot derive request versions rejects the call, and that
 * rejection is handled like any other unreadable image. Matching the Claude
 * route's declaration keeps the two scaled routes on one contract.
 */
export type AttachmentImageReader = Pick<AttachmentStore, 'readImage' | 'readImageRequest'>;
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
 * Base64 image payload one Antigravity request may carry. Google caps a request
 * carrying inline data at 20 MB, and the same body also holds the system
 * instruction, the conversation text, and the tool declarations.
 */
export declare const MAX_REQUEST_IMAGE_BYTES: number;
/**
 * Longest edge, in pixels, one image of this request may keep.
 *
 * CHOICE: 1024 px matches the long edge the other scaled routes send, and it is
 * what makes the scaling in {@link resolveRequestImages} effective rather than
 * nominal: the target is computed from the stored image's own dimensions, so the
 * same image yields the same request bytes in every later turn and the prefix
 * Google's implicit cache matches stays byte-stable.
 *
 * The budget stays Antigravity's own 12 MB. The 1.5 MB in
 * host/common/request-images.ts is Kimi's, and that file warns in the same
 * breath that importing one route's number into another refuses the other
 * route's own legal images; Google accepts a request of up to 20 MB.
 */
export declare const REQUEST_IMAGE_MAX_EDGE = 1024;
/**
 * Request-version target for one stored image whose long edge is over the
 * ceiling, or undefined when it already fits and is sent as stored.
 *
 * A reference without usable dimensions is sent as stored: there is no basis for
 * choosing a target, and the budget fallback in
 * {@link offloadOldestRequestImages} still applies to it.
 */
export declare function requestImageTarget(ref: ImageAttachmentRef, edge?: number): {
    width: number;
    height: number;
    maxPixels: number;
    maxBytes: number;
} | undefined;
/**
 * Replace the oldest inline images with a text placeholder once one request
 * would carry more than {@link MAX_REQUEST_IMAGE_BYTES} of base64 image data.
 *
 * Without this bound an image-heavy session keeps growing the request body until
 * Google rejects it, and the images that made it fail are the ones the model
 * needed least. The oldest occurrences go first, exactly as DSH's own providers
 * order them, and the placeholder tells the model the image is missing instead
 * of letting it answer as though the picture were simply blank.
 *
 * Each occurrence is measured at the size it will actually be sent at, so an
 * image that only fits after scaling is not replaced (see
 * {@link requestImageBytes}). Replacing an image is the LAST resort: it rewrites
 * the retained prefix and costs the next turn its whole implicit cache hit, so
 * it is worth keeping the image count stable for as long as the bytes allow.
 *
 * @param options - the request about to be built; durable history stays untouched.
 * @returns the original options when they already fit, otherwise shallow copies.
 */
export declare function offloadOldestRequestImages(options: GenerateOptions): GenerateOptions;
/**
 * Read every durable `{ type: 'image', attachment }` block one request carries.
 *
 * This provider declares image input, so DSH hands those blocks to the adapter
 * unchanged instead of projecting them to text, and Gemini can only receive them
 * as `inlineData` bytes. An image that cannot be read resolves to
 * `unavailable` rather than disappearing: `contentToUserParts` then leaves the
 * model a text marker, because a turn that silently loses its image is far
 * harder to diagnose than one that says so.
 *
 * WHY SCALE INSTEAD OF DROP. `offloadOldestRequestImages` has to replace an
 * image with placeholder text once the request exceeds
 * {@link MAX_REQUEST_IMAGE_BYTES}, and the count it replaces grows with every
 * image added afterwards. Each change rewrites the retained prefix, so Google's
 * implicit cache misses again on the very next turn. An image whose long edge is
 * over {@link REQUEST_IMAGE_MAX_EDGE} is therefore sent as the harness's
 * downscaled request version, which keeps the image COUNT steady and with it the
 * prefix. The stored image and durable history do not change, and an image that
 * already fits is sent byte-for-byte as stored. The drop path stays as the last
 * resort for a request that is over budget even after scaling.
 *
 * @param options - the exact request about to be built.
 * @param attachments - durable attachment store; absent when the host wired none.
 * @param signal - cancellation, forwarded to every attachment read.
 * @returns one resolution per distinct attachment id, empty when there is no image.
 */
export declare function resolveRequestImages(options: GenerateOptions, attachments: AttachmentImageReader | undefined, signal?: AbortSignal): Promise<ResolvedRequestImages>;
/**
 * Collapse each run of adjacent pure-text parts into a single part.
 *
 * SSE transport chunks are not semantic content blocks. One answer arrives as
 * hundreds of text deltas, and replaying each delta as its own part adds one
 * part per delta to the request prefix on every later turn of the conversation.
 * Antigravity relies on Google's implicit cache, which matches a byte-stable
 * prefix: the moment the prefix gains a part the previous request did not have,
 * everything after it misses. The Claude route lost 68.84% cache hits to exactly
 * that growth before its deltas were merged; the Gemini route sends the same
 * deltas and needs the same treatment.
 *
 * Merging is restricted to pure text, so signed, opaque, thinking, and tool
 * parts keep their boundaries exactly where the model produced them.
 *
 * @param parts - replay parts in model order; the input is never mutated.
 * @returns parts with every adjacent pure-text run merged into its first member.
 */
export declare function mergeAdjacentTextParts(parts: ReadonlyArray<Record<string, unknown>>): Array<Record<string, unknown>>;
export declare function convertMessages(options: GenerateOptions, model: AntigravityModelDef, runtimeModel: string, images?: ResolvedRequestImages): Array<{
    role: string;
    parts: Array<Record<string, unknown>>;
}>;
export declare function stripMetaSchema(schema: unknown, options?: AntigravityToolSchemaOptions): unknown;
export declare function convertTools(tools: GenerateOptions['tools'], modelId?: string, runtimeModel?: string): Array<Record<string, unknown>> | undefined;
export declare function mapToolChoiceMode(toolChoice: unknown): string;
export declare function getMaxOutputTokens(modelId: string, runtimeModel: string): number;
/**
 * `thinkingBudget` for one Gemini 2.5 runtime at one effort, inside the range
 * that runtime accepts.
 *
 * The ranges are the published Gemini API ones: 2.5 Pro takes 128-32768 and
 * cannot turn thinking off, 2.5 Flash and Flash-Lite take 0-24576. One table of
 * 4096 / 16384 / 32768 for every 2.5 model asked Flash for more than its
 * ceiling at `high`, and asked Pro for an impossible 0 when thinking was off.
 * Off on Pro is therefore its floor, with the thought summary suppressed by the
 * caller's `includeThoughts: false`.
 */
export declare function gemini25ThinkingBudget(runtimeModel: string, effort: string): number;
export declare function progressExplanationInstruction(tools: GenerateOptions['tools']): string | undefined;
/** Wire-level choices the adapter makes per request, outside the caller's options. */
export interface BuildRequestWireOptions {
    /**
     * Send `functionCallingConfig.mode: VALIDATED` for Claude runtimes that carry
     * tools and no explicit tool choice. Default on; the adapter turns it off for
     * the rest of the process once the service rejects the mode.
     */
    claudeValidatedToolCalling?: boolean;
    /**
     * Output ceiling `fetchAvailableModels` reported for this runtime. When
     * known it replaces the built-in RUNTIME_MAX_OUTPUT_TOKENS entry, which is
     * only a guess kept for when the catalog is missing or silent.
     */
    maxOutputTokens?: number;
}
export declare function buildRequest(options: GenerateOptions, model: AntigravityModelDef, projectId: string, runtimeModel: string, effort?: string, images?: ResolvedRequestImages, wire?: BuildRequestWireOptions): Record<string, unknown>;
export interface StreamState {
    blocks: OutboundContentBlock[];
    replayBlocks: Array<{
        parts: Array<Record<string, unknown>>;
    }>;
    currentBlock: {
        index: number;
        type: 'text' | 'reasoning';
        text: string;
    } | null;
    hasContent: boolean;
    hasToolCall: boolean;
    usageMetadata: Record<string, number> | null;
    finishReason?: string;
    /** Gemini's own explanation beside a non-STOP finish, when it sent one. */
    finishMessage?: string;
    done: boolean;
    finished: boolean;
}
export declare function createStreamState(): StreamState;
export declare function processStreamLine(line: string, state: StreamState): StreamChunk[];
export declare function closeStream(state: StreamState): StreamChunk[];
//# sourceMappingURL=mapper.d.ts.map