/**
 * MiniMax Code's video vocabulary.
 *
 * The block type, the module augmentation and the media-type list are shared
 * with the Kimi Code line in `../common/video.ts`; only the wording is this
 * line's, because the models that accept video, and the byte budget the endpoint
 * tolerates, are MiniMax's facts.
 */
import { VIDEO_MEDIA_TYPES, type VideoOmissionReason } from '../common/video.ts';
export { VIDEO_MEDIA_TYPES, type VideoOmissionReason };
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