/**
 * Rough prompt-size estimation for one request.
 *
 * Shared because every line uses it for the same purpose: keeping `max_tokens`
 * from making a request the service will reject outright, before a single token is
 * spent. The service count stays authoritative; this only has to be close enough
 * to leave room.
 *
 * @module dsh-chatgpt-subscription/prompt-estimate
 */
import type { GenerateOptions } from "./llm-compat.ts";
/**
 * Rough prompt size for one request, in tokens.
 *
 * Derived from the serialized text with the usual ~4 characters per token
 * heuristic. It is deliberately an estimate: the purpose is only to keep
 * `max_tokens` from making a request the service will reject outright, and the
 * service's own count remains authoritative. Undefined is returned for an empty
 * request so the caller leaves the cap alone rather than clamping against zero.
 */
export declare function estimatedInputTokens(options: GenerateOptions): number | undefined;
//# sourceMappingURL=prompt-estimate.d.ts.map