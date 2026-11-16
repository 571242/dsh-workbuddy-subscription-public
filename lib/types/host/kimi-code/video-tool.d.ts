/**
 * Tool that attaches a video for the next Kimi Code request.
 *
 * DSH's attachment service stores images only and no DSH surface can produce a
 * video block, so this route supplies its own ingress. The bytes are committed
 * to the plugin's video store and then injected into the conversation as a
 * plugin-sourced user message, which is the same mechanism this plugin already
 * uses to return a generated image to the model.
 *
 * Two sources are accepted:
 *
 * - an absolute local path, read straight from disk;
 * - an http(s) URL, fetched through the deployment's proxy-aware fetch and
 *   checked against the same public-address policy the search/fetch provider
 *   uses, so this cannot become an SSRF primitive against the local network.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const KIMI_VIDEO_TOOL_NAME = "kimi_attach_video";
type FetchLike = typeof fetch;
export interface KimiVideoToolOptions {
    fetchFn?: FetchLike;
}
export declare function createKimiVideoTool(ctx: Context, options?: KimiVideoToolOptions): import("@deepseek-ai/dsh-tools").ToolDefinition;
export {};
//# sourceMappingURL=video-tool.d.ts.map