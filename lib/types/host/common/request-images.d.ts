/**
 * Image resolution, byte budgeting and data-URL handling for one request.
 *
 * Shared by the provider lines that send inline images, because the budget is a
 * property of the deployment rather than of any one endpoint, and because two
 * lines that budget differently send different request bytes for the same picture.
 *
 * The notable decision is SCALE, not drop: see {@link resolveRequestImages}.
 *
 * @module dsh-chatgpt-subscription/request-images
 */
import type { GenerateOptions } from "./llm-compat.ts";
import type { AttachmentStore, ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
/**
 * Attachment seam this route needs: verified bytes for one durable image, and a
 * downscaled request version of one that does not fit the image budget.
 *
 * Every harness generation in the peer range declares readImageRequest; a
 * backend that cannot derive request versions rejects the call, and that
 * rejection is handled like any other unreadable image.
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
export declare const NO_RESOLVED_IMAGES: ResolvedRequestImages;
/**
 * Base64 image payload one request may carry.
 *
 * Kimi rejects a request whose total message size exceeds 2 MB with a 400, and
 * the image bytes share that budget with the conversation text, tool schemas,
 * and system prompt — so the bound is deliberately the smaller of the two
 * documented limits rather than the largest body the transport would accept.
 */
export declare const MAX_REQUEST_IMAGE_BYTES = 1500000;
/** Message-body ceiling the service documents for one request. */
export declare const MAX_MESSAGE_BODY_BYTES = 2097152;
/**
 * Body ceiling once a request carries video.
 *
 * The 2 MB figure above is the documented limit for text and images, and it is
 * far too small for video: a single frame-sequence clip dwarfs it. Kimi's own
 * video guidance carries a separate, much larger request budget, so the ceiling
 * is raised only for a request that actually attaches video. A text-only or
 * image-only request keeps the tighter guard, because catching that 400 locally
 * is the whole reason it exists.
 */
export declare const MAX_VIDEO_MESSAGE_BODY_BYTES: number;
/**
 * Base64 video budget for one request.
 *
 * Deliberately below {@link MAX_VIDEO_MESSAGE_BODY_BYTES} so the surrounding
 * JSON envelope, tool schemas and text still fit; the oldest clips are dropped
 * first once the total would exceed it.
 */
export declare const MAX_REQUEST_VIDEO_BYTES: number;
/** Media types both upstream wires accept as inline base64. */
export declare const SUPPORTED_IMAGE_MEDIA_TYPES: Set<string>;
export declare function attachmentLabel(block: Record<string, unknown>): string | undefined;
/**
 * Wire-level base64 payload of each image occurrence one request carries, in the
 * order the request sends them, so index N is the Nth oldest image.
 */
export declare function requestImagePayloadLengths(options: GenerateOptions, images?: ResolvedRequestImages): number[];
/** How many of the oldest occurrences must go to bring the total under `maxBytes`. */
export declare function imagesToOffloadCount(lengths: readonly number[], maxBytes: number): number;
/**
 * Replace the first `count` image occurrences with a visible placeholder,
 * recursing into tool results. Durable history is untouched; only the request
 * about to be sent changes.
 *
 * `images` must be the same resolution {@link requestImagePayloadLengths} was
 * measured with. An image that resolved to `unavailable` is already serialized
 * as a short text placeholder, so dropping it frees no bytes — counting it as
 * replaceable here would shift every later occurrence by one against the
 * measured lengths, and the caller would under-drop for as long as such an
 * image is in the conversation.
 */
export declare function replaceOldestRequestImages(options: GenerateOptions, count: number, images?: ResolvedRequestImages): GenerateOptions;
/**
 * Longest edge any image of this request may keep.
 *
 * Kimi's own client compresses an oversized image down to roughly 2 MB of raw
 * bytes before it sends it, and this route has to fit every image of one request
 * inside a far smaller shared budget. Screening on the long edge rather than on
 * the encoded size is what makes the decision stable: it reads only the
 * attachment's own dimensions, so the same image yields the same target in every
 * later turn and the cached prefix survives.
 */
export declare const REQUEST_IMAGE_MAX_EDGE = 1024;
/**
 * Request-version target for one stored image whose long edge is over the
 * ceiling, or undefined when it fits and is sent as stored.
 *
 * A reference without usable dimensions is sent as stored: there is no basis
 * for choosing a target, and the budget fallback still applies to it.
 */
export declare function requestImageTarget(ref: ImageAttachmentRef, edge?: number): {
    width: number;
    height: number;
    maxPixels: number;
    maxBytes: number;
} | undefined;
export declare function requestImageTargetOrOriginal(ref: ImageAttachmentRef): {
    width: number;
    height: number;
    maxBytes: number;
};
/**
 * Replace the oldest inline images with a text placeholder once one request
 * would carry more than `maxBytes` of base64 image data.
 *
 * The MECHANISM is shared because it is generic: measure the retained
 * occurrences' encoded length, drop oldest-first, leave durable history alone.
 * The BUDGET is not, and it is a parameter for exactly that reason — an
 * image budget is a property of the upstream gateway, and importing one route's
 * number into another refuses that other route's own legal images. The default
 * is Kimi's, so every existing call site is byte-for-byte unchanged; a route
 * with a different ceiling passes its own.
 *
 * Durable history is untouched; only the request about to be sent changes.
 */
export declare function offloadOldestRequestImages(options: GenerateOptions, maxBytes?: number, images?: ResolvedRequestImages): GenerateOptions;
/**
 * Whether a request still carries at least one image the mapper can send.
 *
 * A request whose images have all been replaced by placeholders can no longer
 * shrink, which is what separates "drop more images" from "this body is too
 * large for a reason no image budget can fix".
 *
 * DEFINED AS the counter, not as a traversal of its own. The two have to agree
 * by construction: when they did not, {@link collectRequestImagePayloads} saw
 * the images inside a `tool-result` — which is where a `read_image` result
 * or a screenshot lands — while this answer reported that nothing was left to
 * give back, so the body-fit loop refused a request that dropping one image
 * would have fitted. A fifth hand-written recursion would have fixed that one
 * instance; deriving one from the other makes the next drift impossible rather
 * than merely unlikely.
 *
 * `images` must be the same resolution the builder will use. An image that
 * resolved to `unavailable` is serialized as text and therefore is not a
 * sendable image; reporting it as one only spins the loop until it gives up.
 */
export declare function requestHasSendableImage(options: GenerateOptions, images?: ResolvedRequestImages): boolean;
/**
 * Read every durable `{ type: 'image', attachment }` block one request carries.
 * An unreadable image resolves to `unavailable` rather than disappearing, so
 * the model is told the picture is missing instead of answering about a blank.
 *
 * An image whose long edge is over {@link REQUEST_IMAGE_MAX_EDGE} is sent as the
 * harness's downscaled request version (see {@link requestImageTarget}). The
 * stored image and durable history do not change, and an image that already
 * fits is sent byte-for-byte as stored.
 *
 * WHY scale instead of drop. `offloadOldestRequestImages` has to drop an image
 * once the request exceeds `MAX_REQUEST_IMAGE_BYTES`, and the number it drops
 * grows with every later image. Each change rewrites the retained prefix, so the
 * prompt cache is invalidated again on the very next turn. Scaling keeps the
 * image COUNT stable, which is what preserves that prefix: a conversation that
 * outgrew the budget once stays inside it instead of breaking the cache every
 * time an image is added.
 */
export declare function resolveRequestImages(options: GenerateOptions, attachments: AttachmentImageReader | undefined, signal?: AbortSignal): Promise<ResolvedRequestImages>;
export declare function unavailableImageText(block: Record<string, unknown>): string;
export interface InlineImage {
    mediaType: string;
    data: string;
}
export declare function imageBlockToInline(block: Record<string, unknown>, images: ResolvedRequestImages): InlineImage | undefined;
//# sourceMappingURL=request-images.d.ts.map