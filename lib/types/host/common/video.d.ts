/**
 * Video input, shared by every line in this plugin that accepts it.
 *
 * DSH ships ModelModalityMap = { text, image } and a ContentBlockMap with no
 * video entry, but both are merge-extensible interfaces. This module performs
 * that widening ONCE, in the plugin's own compilation unit, so the video
 * capability travels through DSH's real pipeline - the one that gates prompt
 * admission, the model picker and subagent delegation - rather than living in
 * a tooltip. Two providers now declare video (Kimi Code and MiniMax Code), and
 * a second augmentation of the same key would be a conflicting redeclaration,
 * so the vocabulary has to be shared rather than copied per line.
 *
 * Nothing here is provider-specific. A line supplies the wording for a video it
 * cannot send (see {@link VideoOmissionText}) and the media types its endpoint
 * accepts, and inherits the traversal, byte budgeting and base64 encoding.
 *
 * @module dsh-chatgpt-subscription/video
 */
/**
 * Container formats the coding endpoints accept as video input.
 *
 * The services validate the media type, so an unlisted container is reported
 * before it is base64-expanded into a request that would be rejected.
 */
export declare const VIDEO_MEDIA_TYPES: readonly string[];
/** Runtime membership test for one video container. */
export declare function isVideoMediaType(mediaType: string): boolean;
/**
 * One durable video reference carried by a request.
 *
 * attachmentId is a plain string rather than DSH's branded AttachmentId: no
 * DSH service issues this identifier, so branding it would imply an origin that
 * does not exist. The field name matches ImageAttachmentRef so one traversal
 * helper can walk both block kinds.
 */
export interface VideoAttachmentRef {
    attachmentId: string;
    /** Verified media type, for example video/mp4. */
    mediaType: string;
    /** Exact encoded byte length. */
    bytes: number;
    /** Intrinsic duration in milliseconds, when the producer knows it. */
    durationMs?: number;
    /** Optional display name, stripped of any local path. */
    name?: string;
}
/** One video occurrence in message content. */
export interface VideoBlock {
    type: 'video';
    attachment: VideoAttachmentRef;
}
declare module '@deepseek-ai/dsh-llm' {
    interface ModelModalityMap {
        /** Widened by this plugin for the providers that accept video. */
        video: 'video';
    }
    interface ContentBlockMap {
        /** Widened by this plugin; only this package's request mappers read it. */
        video: VideoBlock;
    }
}
/** Base64 length of raw bytes, including padding. */
export declare function base64LengthOf(bytes: number): number;
/** Canonical data URL an inline video part carries. */
export declare function videoDataUrl(mediaType: string, base64: string): string;
/**
 * Human-readable byte size for a refusal message.
 * @param bytes - exact encoded byte length.
 */
export declare function formatMediaBytes(bytes: number): string;
/** Why one video occurrence was replaced by text instead of being sent. */
export type VideoOmissionReason = 'unsupported-model' | 'unreadable' | 'unsupported-container'
/** The selected protocol has no documented video part, so none is sent. */
 | 'unsupported-wire';
/**
 * A line's own wording for a video it cannot send.
 *
 * A function rather than a fixed string because the actionable half differs per
 * provider: the models that DO take video, and whether the selected wire has a
 * video part at all, are different answers on different routes.
 */
export type VideoOmissionText = (reason: VideoOmissionReason, label?: string) => string;
/** Attachment id or display name for one block, whichever is present. */
export declare function videoBlockLabel(block: {
    attachment?: {
        name?: string;
        attachmentId?: string;
    };
}): string | undefined;
//# sourceMappingURL=video.d.ts.map