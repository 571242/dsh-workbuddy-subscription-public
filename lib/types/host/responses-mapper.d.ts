import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { GenerateOptions } from './common/llm-compat.ts';
import type { CodexOutputVerbosity, CodexReasoningSummary } from '../shared/contracts.ts';
export interface ResponsesPayload extends Record<string, unknown> {
    model: string;
    input: Array<Record<string, unknown>>;
    stream: true;
    store: false;
    service_tier?: string;
    /** Stable per-conversation cache key; lets the backend reuse prompt prefix. */
    prompt_cache_key?: string;
}
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface LocalRawImageOptions {
    baseUrl?: string;
    fetchFn?: FetchLike;
}
/**
 * Base64 image payload one Codex request may carry.
 *
 * THIS ROUTE HAD NO BOUND AT ALL, which is what made a long session fail
 * intermittently (issue #50). Every turn re-inlines every image still in
 * history, so the request body grew with the number of images ever read and
 * nothing ever trimmed it. Past roughly 4 MB the transport itself gives up: the
 * report's field logs show 18/18 successes in the 3–4 MB band and 3/10 in the
 * 4–5 MB band, and a synthetic probe against the subscription endpoint returned
 * `NGHTTP2_ENHANCE_YOUR_CALM` / `NGHTTP2_INTERNAL_ERROR` on every ≥4 MB body
 * while ≤3 MB always passed.
 *
 * The NUMBER is this route's own, derived from those measurements rather than
 * borrowed. Kimi's 1.5 MB figure is sized for Kimi's 2 MB request limit and
 * would silently drop images this endpoint accepts; MiniMax's 16 MB is sized
 * for a 64 MB body ceiling this route does not have. 2 MiB of image data keeps
 * the whole body inside the band that never failed, even after the
 * conversation text, tool schemas and system prompt are added. It is a
 * transport property of this deployment, not a documented API limit, so
 * `DSH_CODEX_MAX_IMAGE_BYTES` overrides it.
 *
 * It bounds the IMAGE contribution only. A request whose text alone exceeds the
 * transport is still refused by the transport, and no image budget can fix that.
 */
export declare const DEFAULT_MAX_REQUEST_IMAGE_BYTES: number;
/**
 * Image budget this process enforces, honouring the deployment override.
 *
 * Parsed as bytes and ignored when it is not a positive finite number, so a
 * typo cannot silently disable the guard by producing `NaN`.
 */
export declare function maxRequestImageBytes(env?: NodeJS.ProcessEnv): number;
/**
 * Replace the oldest images with that placeholder once the built request would
 * carry more than `maxBytes` of base64 image data.
 *
 * WHY THIS RUNS ON THE BUILT INPUT rather than on `options.messages` like the
 * other routes. Two image forms reach this wire and only one of them is a
 * message block: a pasted attachment arrives as `{ type: 'image', attachment }`,
 * but the tool-read images in issue #50 arrive as local markdown links
 * (`![](/describe-image/raw/sha256:…)`) that `mapUserText` fetches and inlines
 * while building. A message-level pass cannot see the second form at all, and
 * the shared `offloadOldestRequestImages` additionally does not recurse into
 * `tool-result` content — so measuring here, after every form has become an
 * `input_image` item, is the one place that bounds what actually goes out.
 *
 * The oldest occurrences go first and durable history is untouched; only the
 * request about to be sent changes. A retry after a model fallback reuses the
 * bounded input instead of re-inflating it.
 *
 * @param input - the payload's `input` items, mutated in place.
 * @param maxBytes - base64 image budget for the whole request.
 * @returns how many images were replaced.
 */
export declare function offloadOldestInputImages(input: Array<Record<string, unknown>>, maxBytes?: number): number;
export declare function hiddenSandboxControlToolNames(options: GenerateOptions): Set<string>;
export declare function buildResponsesPayload(options: GenerateOptions, attachments: Pick<AttachmentStore, 'readImage'> & Partial<Pick<AttachmentStore, 'imageLimits'>>, localRawImages?: LocalRawImageOptions, outputVerbosity?: CodexOutputVerbosity | null, fastMode?: boolean, reasoningSummary?: CodexReasoningSummary | null, promptCacheKey?: string): Promise<ResponsesPayload>;
//# sourceMappingURL=responses-mapper.d.ts.map