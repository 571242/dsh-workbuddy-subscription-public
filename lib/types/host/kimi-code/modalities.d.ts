/**
 * Kimi Code's video vocabulary, re-exported from the shared video modules.
 *
 * The traversal, byte budgeting and base64 encoding live in
 * `../common/video-request.ts` now that a second line accepts video too; a
 * second copy of the module augmentation would be a conflicting redeclaration
 * of the same `video` key.
 *
 * What stays here is the part that is genuinely Kimi's: the models that take
 * video, and the wording used when one cannot be sent.
 */
import { type VideoOmissionReason } from '../common/video.ts';
export { VIDEO_MEDIA_TYPES, base64LengthOf, formatMediaBytes, isVideoMediaType, videoBlockLabel, videoDataUrl, type VideoAttachmentRef, type VideoBlock, type VideoOmissionReason, } from '../common/video.ts';
/**
 * Deterministic text standing in for a video the request cannot carry.
 *
 * The model is told the video existed and why it is absent, so it asks for a
 * description instead of answering as though the message were empty.
 * @param reason - why the occurrence was omitted.
 * @param label - display name or attachment id, when known.
 */
export declare function videoOmissionText(reason: VideoOmissionReason, label?: string): string;
//# sourceMappingURL=modalities.d.ts.map