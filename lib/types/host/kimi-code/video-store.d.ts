/**
 * Local store for videos this plugin attaches to a Kimi Code request.
 *
 * DSH's attachment service normalizes and stores images only, and no DSH
 * surface can produce a video block, so the route owns its own store rather
 * than pretending DSH issued these references. The store is deliberately
 * narrow: a tool ingests bytes, a reader hands them back for one request.
 *
 * The identifier is the sha256 of the stored bytes, so re-ingesting the same
 * file is idempotent and a reference cannot silently point at different bytes.
 */
import { type VideoAttachmentRef } from './modalities.ts';
/**
 * Largest single video this route will carry.
 *
 * Two independent published limits bound this, and the smaller wins:
 *
 * - the official Kimi video integration encodes a local file as
 *   `data:video/...;base64,...` and caps that payload at about 50 MB;
 * - the VS Code client caps a picked video file at 20 MB.
 *
 * The integration figure is the one that describes what the MODEL accepts
 * over this exact wire, so the cap is set just under it rather than at the
 * editor's more conservative picker limit. Note this is an encoded payload
 * limit: base64 grows bytes by 4/3, so the raw file must stay under 3/4 of it.
 */
export declare const MAX_VIDEO_FILE_BYTES: number;
/** Maximum base64 payload derived from {@link MAX_VIDEO_FILE_BYTES}. */
export declare const MAX_VIDEO_BASE64_BYTES: number;
/** Directory the ingested videos live in. */
export declare function videoStoreDir(): string;
/**
 * Media type for one path, from its extension.
 *
 * A local file rarely carries a usable declared type, so the extension is the
 * signal; an unknown one yields undefined rather than a guess, so the caller
 * can refuse instead of sending a type the service will reject.
 */
export declare function mediaTypeForPath(filePath: string): string | undefined;
/**
 * Whether this route will actually send this container.
 *
 * The ingress accepts exactly what the mapper can put on the wire, so a file
 * is either accepted and sent or refused with a reason. An earlier revision
 * also stored Matroska (.mkv), which some third-party integrations accept but
 * the vision guide does not list; that produced a video reported as "attached"
 * which the mapper then silently downgraded to a placeholder. Accepting only
 * {@link KIMI_VIDEO_MEDIA_TYPES} keeps the tool's promise and the wire's
 * behaviour the same thing.
 */
export declare function isStorableVideoType(mediaType: string): boolean;
/** Raised when an ingest cannot produce a usable reference. */
export declare class VideoIngestError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/**
 * Commit one video's bytes and return the reference a request can cite.
 *
 * @param data - complete encoded file bytes.
 * @param declaredType - media type from the source (extension or Content-Type).
 * @param name - display name; never interpreted as a path.
 * @param declaredBytes - total the source advertised, when it did, so an
 *   oversized file is refused before its bytes are buffered.
 */
export declare function saveVideo(input: {
    data: Uint8Array;
    declaredType: string | undefined;
    name: string;
    declaredBytes?: number;
}): Promise<VideoAttachmentRef>;
/**
 * Total bytes the store may occupy before it prunes itself.
 *
 * Videos are content-addressed and re-attaching an identical file costs nothing,
 * but nothing ever removed an old clip, so the directory only grew. The budget
 * is deliberately generous (a few large clips) and enforced only on write, so a
 * prune never runs during a read of the clip about to be sent.
 */
export declare const VIDEO_STORE_BUDGET_BYTES: number;
/**
 * Drop the least recently used objects until the store fits its budget.
 *
 * Recency is the object's mtime, which writing refreshes, so a clip that was
 * just re-attached is not the one evicted. Failure is swallowed: a store that
 * cannot be pruned must not fail the attachment the caller asked for.
 */
export declare function pruneVideoStore(budgetBytes?: number): Promise<number>;
/** Path of the stored object for a reference, or undefined when it is gone. */
export declare function storedPathFor(ref: VideoAttachmentRef): string | undefined;
/**
 * Read the bytes one reference points at.
 *
 * The reference is re-verified against the stored bytes: a file whose digest
 * no longer matches its name is refused rather than sent, so a tampered or
 * truncated object cannot reach the model as if it were the original.
 */
export declare function readVideoBytes(ref: VideoAttachmentRef): Promise<Uint8Array>;
//# sourceMappingURL=video-store.d.ts.map