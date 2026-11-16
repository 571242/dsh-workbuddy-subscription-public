import type { AttachmentStore, ImageMediaType } from '@deepseek-ai/dsh-attachment';
import { AccountPoolStore } from './account-pool.ts';
import { FileCredentialStore } from './token-store.ts';
type FetchLike = typeof fetch;
/**
 * Aspect ratios Gemini image models accept in `imageConfig.aspectRatio`.
 * Omitted, the model picks one itself, which is what the request then does.
 */
export declare const ANTIGRAVITY_IMAGE_ASPECT_RATIOS: readonly ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
export interface AntigravityImageToolOptions {
    fetchFn?: FetchLike;
    /** Whether the Antigravity line is switched on; a switched-off line serves no images. */
    isEnabled?: () => boolean;
}
/** One image part the model returned, still base64. */
export interface InlineImage {
    mimeType: string;
    data: string;
}
/** What one image response carried, gathered across every SSE frame. */
export interface ImageResponse {
    images: InlineImage[];
    text: string;
    finishReason?: string;
    finishMessage?: string;
}
/**
 * The `v1internal` envelope for one image generation.
 *
 * Deliberately bare next to the chat request: no system instruction, no tools
 * and no thinking config. An image runtime has nothing to do with the coding
 * agent persona or tool declarations, and `responseModalities` is what asks it
 * for pixels at all. `requestType: 'image_gen'` follows what community
 * Antigravity clients send for image runtimes; it has not been captured from
 * the official client.
 */
export declare function buildImageRequest(prompt: string, projectId: string, aspectRatio?: string): Record<string, unknown>;
/**
 * Collect the images and visible text of one SSE image response.
 *
 * Parts marked `thought: true` are skipped, images included: an image model can
 * stream interim drafts as thoughts, and only the final picture is the answer.
 *
 * @throws HarnessError when a frame carries an upstream error.
 */
export declare function parseImageResponse(body: string): ImageResponse;
/**
 * Decode one returned image after checking it is the type it claims and fits
 * the attachment limits. A claim the bytes contradict is refused rather than
 * stored under the wrong type.
 */
export declare function decodeInlineImage(image: InlineImage, attachments: Pick<AttachmentStore, 'imageLimits'>): {
    mediaType: ImageMediaType;
    data: Uint8Array;
};
/**
 * Generate an image through the signed-in Antigravity account pool.
 *
 * Shares the chat route's account rotation: the call draws on the Gemini
 * allowance, so an account whose Gemini allowance is cooling down is skipped and
 * a 429 cools that allowance alone (see AccountPoolStore.markFamilyCooldown).
 */
export declare function createAntigravityImageTool(accountPool: AccountPoolStore, store: FileCredentialStore, attachments: AttachmentStore, options?: AntigravityImageToolOptions): import("@deepseek-ai/dsh-tools").ToolDefinition;
export {};
//# sourceMappingURL=image-tool.d.ts.map