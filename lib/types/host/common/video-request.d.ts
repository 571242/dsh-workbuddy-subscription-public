/**
 * Request-side machinery for video input, shared by every line that accepts it.
 *
 * Everything here walks ContentBlocks and base64-encodes bytes; none of it knows
 * which provider it is serving. A line contributes the two things that DO differ:
 * the wording for a video it cannot send, and the byte budget its endpoint
 * tolerates.
 *
 * @module dsh-chatgpt-subscription/video-request
 */
import type { GenerateOptions } from './llm-compat.ts';
import { type VideoAttachmentRef, type VideoOmissionText } from './video.ts';
/**
 * One durable video resolved for an in-flight request, or proven unreadable.
 *
 * The shape mirrors the image counterpart so the two media kinds travel the
 * same path and differ only in the wire part each produces.
 */
export type ResolvedRequestVideo = {
    readonly kind: 'inline';
    readonly mediaType: string;
    readonly data: string;
} | {
    readonly kind: 'unavailable';
};
/** Resolved videos keyed by attachment id; consumed by one request build. */
export type ResolvedRequestVideos = ReadonlyMap<string, ResolvedRequestVideo>;
/**
 * Attachment seam for video bytes.
 *
 * DSH's own attachment service stores images only, so a video reference can
 * only exist if some producer in this deployment created it. Rather than
 * pretend otherwise, the reader is an injected seam: absent means every video
 * resolves to `unavailable` and the model is told the clip is missing, which is
 * strictly better than silently sending a request with no video at all.
 */
export type AttachmentVideoReader = {
    readVideo(ref: VideoAttachmentRef, signal?: AbortSignal): Promise<{
        data: Uint8Array;
        mediaType: string;
    }>;
};
/**
 * Read every durable `{ type: 'video', attachment }` block one request carries.
 *
 * An unreadable clip resolves to `unavailable` rather than disappearing, so the
 * model is told the video is missing instead of answering about a blank.
 */
export declare function resolveRequestVideos(options: GenerateOptions, attachments: AttachmentVideoReader | undefined, signal?: AbortSignal): Promise<ResolvedRequestVideos>;
/** True when the request carries any video occurrence at all. */
export declare function requestHasVideo(options: GenerateOptions): boolean;
/**
 * Drop the oldest videos once one request would exceed `maxBytes` of base64
 * video data, replacing each with a text placeholder.
 *
 * Durable history is untouched; only the request about to be sent changes.
 * Images are left alone — they have their own, much smaller budget and their own
 * offload pass.
 *
 * @param maxBytes - the endpoint's base64 video budget.
 */
export declare function offloadOldestRequestVideos(options: GenerateOptions, maxBytes: number): GenerateOptions;
/** One video block resolved for the wire, or the reason it cannot be sent. */
export type ResolvedVideoBlock = {
    readonly inline: {
        readonly mediaType: string;
        readonly data: string;
    };
} | {
    readonly omission: string;
};
/**
 * Resolve one video block for the wire, or explain why it cannot be sent.
 *
 * @param block - the durable video occurrence.
 * @param videos - videos read for this request.
 * @param videoAccepted - whether the selected model declares video input.
 * @param omit - the line's wording for a video it cannot send.
 */
export declare function videoBlockToInline(block: Record<string, unknown>, videos: ResolvedRequestVideos, videoAccepted: boolean, omit: VideoOmissionText): ResolvedVideoBlock;
//# sourceMappingURL=video-request.d.ts.map