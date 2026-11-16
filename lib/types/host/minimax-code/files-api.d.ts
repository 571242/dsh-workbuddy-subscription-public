/**
 * MiniMax Code Files API client.
 *
 * The one capability this line could not serve inline: a clip whose base64 would
 * overrun the 64 MB request body. Uploading it to the Files API and sending an
 * `mm_file://` reference is the only documented way to send a large media file.
 *
 * EVERY fact in this file was measured against the subscription endpoint on
 * 2026-10-05, not read from the official client and not assumed:
 *
 * - The endpoint is `{agentBase}/mavis/api/v1/llm/v1/files/upload`. The
 *   `files_api_upload_endpoint: '/v1/files/upload'` in the official catalog is
 *   RELATIVE to the messages base, and the official resolver strips the
 *   `/anthropic` compatibility suffix before appending it.
 * - It requires `multipart/form-data` with `purpose` FIRST and then `file`;
 *   `purpose` is `image_understanding` or `video_understanding`.
 * - It answers `{"file":{"file_id":…},"base_resp":{"status_code":0}}`,
 *   and `status_code` must be 0 for the id to be usable.
 * - **It rejects the `X-Msh-*` identity headers that every other request on this
 *   line sends.** With them the answer is `{"file":null,…"invalid params"}`,
 *   identical to a genuinely malformed body - so a request that is correct in
 *   every other respect fails with a message that points nowhere. This client
 *   therefore sends the bearer token ALONE, and the only thing that fixes a
 *   `2013 invalid params` here is dropping those headers, not changing the form.
 * - A successful upload is referenced as `mm_file://<file_id>` in a
 *   `{ type, source: { type: 'url', url } }` block. A bare id is rejected with
 *   "image url must be http(s):// or data:...;base64", so the scheme is load-bearing.
 * - There is no list or delete route on this surface (`GET /files` answers 503
 *   `direct_route_not_configured`), so expiry cannot be confirmed server-side.
 *
 * @module dsh-chatgpt-subscription/minimax-files-api
 */
/** Path suffix appended to the messages URL to reach the Files API. */
export declare const FILES_UPLOAD_PATH = "/files/upload";
/** Scheme a stored file is referenced by on the wire. */
export declare const FILE_REF_SCHEME = "mm_file://";
/**
 * Lifetime this client assumes for an uploaded file id.
 *
 * 12 hours, matching the official client's own default (its resolver falls back
 * to 43,200 seconds when the server states no TTL). It is deliberately shorter
 * than a day: a stale reference is worth a cheap re-upload, while a reference
 * that outlives its file is worth a failed turn.
 */
export declare const DEFAULT_FILE_ID_TTL_SEC = 43200;
/** Ceiling on one upload, so a runaway path cannot spend the whole budget. */
export declare const MAX_UPLOAD_BYTES: number;
/** Time budget for one upload request. */
export declare const UPLOAD_TIMEOUT_MS = 120000;
/** Why one upload could not produce a usable file id. */
export type FilesApiFailure = 'not-configured' | 'too-large' | 'unauthorized' | 'rejected'
/** The gateway answered 50115: the route is not enabled for this credential. */
 | 'route-not-configured' | 'unreadable' | 'network';
/** One failed upload, with a message the settings surface can show. */
export declare class FilesApiError extends Error {
    readonly reason: FilesApiFailure;
    constructor(reason: FilesApiFailure, message: string);
}
/** What one upload request needs. */
export interface FilesApiUploadRequest {
    readonly accessToken: string;
    readonly baseUrl: string;
    /** Bare base64 of the bytes, without a data-URL prefix. */
    readonly base64: string;
    /** Exact decoded byte length. */
    readonly bytes: number;
    readonly mediaType: string;
    readonly purpose: 'image_understanding' | 'video_understanding';
    readonly filename: string;
    readonly signal?: AbortSignal;
}
/** Everything the Files API upload surface was measured to accept. */
export interface FilesApiUploadOptions {
    readonly fetchFn?: typeof fetch;
    /** Test seam: the clock, in epoch ms. */
    readonly nowMs?: () => number;
    /**
     * Test seam: where the id cache lives.
     *
     * `undefined` keeps it in memory, so a test neither reads the real cache
     * file nor leaves ids behind in it.
     */
    readonly storePath?: string | undefined;
}
/**
 * Forget every cached file id in the in-memory store.
 *
 * Test seam only. A file id is scoped to an account, so an id left over from
 * another test would make the next upload look cached and never exercise the
 * request at all.
 */
export declare function resetInMemoryFileIds(): void;
/** The wire reference for a stored file id. */
export declare function fileRef(fileId: string): string;
/**
 * The Files API upload URL for one messages URL.
 *
 * The upload is a SIBLING of `/messages`, not a child of it: the measured route
 * is `.../llm/v1/files/upload`. Appending to the messages URL would ask for
 * `/messages/files/upload`, which answers 503 `direct_route_not_configured` -
 * an error that reads like the feature is switched off rather than a path that
 * is one segment off.
 */
export declare function filesUploadUrl(messagesEndpoint: string): string;
/** The `purpose` value one media type uploads under. */
export declare function filesPurposeFor(mediaType: string): 'image_understanding' | 'video_understanding' | undefined;
/**
 * Upload one media file and return its id, reusing a live cached id when the
 * same bytes were already uploaded by the same account.
 *
 * @param accountKey - identifies the account the bytes are uploaded under.
 *   Ids are never shared across accounts; see {@link FileIdStore}.
 * @returns the file id, or undefined when the request should carry the media
 *   inline instead (too large, unconfigured, or the upload failed).
 */
export declare function uploadMediaFile(request: Omit<FilesApiUploadRequest, 'purpose' | 'filename'>, accountKey: string, options?: FilesApiUploadOptions): Promise<string | undefined>;
//# sourceMappingURL=files-api.d.ts.map