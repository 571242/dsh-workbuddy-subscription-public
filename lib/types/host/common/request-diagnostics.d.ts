/**
 * Reusable request diagnostics wrapper for model provider calls.
 *
 * Implements W5 usage, latency, and transport diagnostics:
 * - First-byte chunk latency (firstByteMs) and total duration
 * - Request payload bytes (null when unknown stream, not 0)
 * - Safe runtime-validated enum-only endpoint and provider classification
 * - Ephemeral keyed-HMAC fingerprints scoped per provider+endpoint
 * - Disjoint token usage mapping with missing vs zero differentiation and endpoint-awareness
 * - Complete SSE line and NDJSON streaming parser merging start/delta usage
 * - Stream proxy with backpressure preservation (highWaterMark: 0) and early cancel/abort
 * - Isolated failure boundary (diagnostics sink failures never break generation)
 *
 * @module dsh-chatgpt-subscription/request-diagnostics
 */
export declare const DIAGNOSTIC_PROVIDERS: readonly ["codex-chatgpt", "claude-subscription", "antigravity", "kimi-code", "minimax-code", "command-code", "workbuddy-subscription", "ollama", "claude", "workbuddy", "codex", "glm-coding-plan", "step-code"];
export type DiagnosticProviderId = (typeof DIAGNOSTIC_PROVIDERS)[number];
export declare const KNOWN_WIRE_ENDPOINTS: readonly ["messages", "responses", "chat_completions", "generate_content", "stream_generate_content", "ollama_chat", "ollama_generate", "workbuddy_chat", "unknown"];
export type KnownWireEndpoint = (typeof KNOWN_WIRE_ENDPOINTS)[number];
export declare function isValidProvider(provider: unknown): provider is DiagnosticProviderId;
export declare function isValidEndpoint(endpoint: unknown): endpoint is KnownWireEndpoint;
export type HttpStatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'error';
export interface DisjointUsage {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
}
export interface FingerprintComparison {
    prefixFingerprint?: string;
    toolFingerprint?: string;
    modelFingerprint?: string;
    authFingerprint?: string;
    prefixChanged?: boolean;
    toolChanged?: boolean;
    modelChanged?: boolean;
    authChanged?: boolean;
}
export interface RequestDiagnosticRecord {
    provider: DiagnosticProviderId;
    endpoint: KnownWireEndpoint;
    requestBytes: number | null;
    firstByteMs: number | null;
    ttftMs: null;
    durationMs: number;
    statusCode: number | null;
    statusClass: HttpStatusClass;
    outcome: 'completed' | 'canceled' | 'error';
    usage?: DisjointUsage;
    retries?: number;
    fingerprints?: FingerprintComparison;
}
export interface CorrelationOptions {
    sessionId?: string;
    retryCount?: number;
}
export interface DiagnosticFetchOptions {
    provider?: DiagnosticProviderId;
    endpoint?: KnownWireEndpoint;
    enabled?: boolean;
    onRecord?: (record: RequestDiagnosticRecord) => unknown;
    classifyEndpoint?: (url: string, pathname: string) => KnownWireEndpoint | null;
    correlation?: CorrelationOptions;
}
export type FetchLike = typeof fetch;
export type FetchInput = Parameters<FetchLike>[0];
export type FetchInit = Parameters<FetchLike>[1];
export declare function computeHmacPrefix(data: string): string;
export declare function clearDiagnosticSessionState(): void;
export declare function getDiagnosticSessionCacheSize(): number;
export declare function isDefaultModelPath(pathname: string): KnownWireEndpoint | null;
export declare function parseUsageObject(raw: unknown, endpoint?: KnownWireEndpoint): DisjointUsage | undefined;
/**
 * Creates a diagnostic wrapper around fetch for model requests.
 */
export declare function createDiagnosticFetch(baseFetch: FetchLike, options?: DiagnosticFetchOptions): FetchLike;
//# sourceMappingURL=request-diagnostics.d.ts.map