import { LlmAdapter, ReasoningEffortId, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { PROVIDER_ID, reasoningEffortsFor } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type KimiCodeCatalogModel, type KimiCodePreferenceStore } from './token-store.ts';
import { buildModelOptions, clearCachedCatalog } from './client.ts';
import { type AttachmentImageReader, type AttachmentVideoReader } from './mapper.ts';
import { KimiCodeAccountPool } from './account-pool.ts';
/**
 * Transient-failure retry policy for the `kimi-code` route.
 *
 * Kimi Code fronts the model providers, so a call can fail with a 502/503/504
 * while the subscription and the credential stay perfectly usable. The service
 * publishes exactly this case, and the body is usually
 * `{"error":{"message":"Upstream model provider is temporarily unavailable.
 * Please try again in a moment.","type":"server_error"}}` — which is precisely a
 * message telling the client to try again.
 *
 * The retryable set is therefore:
 *
 * - `SERVER` — any 5xx, including that upstream-unavailable 502, and the
 *   overloaded 429 (`UPSTREAM_OVERLOAD_PATTERNS`). Overload shares the 429
 *   status with real back-pressure but not its meaning: it describes the state
 *   of the upstream engine, which every account behind this endpoint shares, so
 *   it is filed as the server condition it is and the pool is left alone;
 * - `RATE_LIMIT` — a 429 that is genuine back-pressure ("too many requests"),
 *   which the documentation describes as transient and which does belong to the
 *   account that hit it, so rotation on it still earns its keep;
 * - `TRANSPORT` — a connection that produced no response at all;
 * - `TIMEOUT` — a stalled stream, handled by the idle watchdog.
 *
 * Deliberately outside the set:
 *
 * - `INVALID_CREDENTIAL` — a rejected access token fails identically on every
 *   attempt;
 * - `PROVIDER_ERROR` — a 400, a 401 that is really a plan-entitlement refusal,
 *   or a 403 quota limit. Retrying a quota that resets in hours against the
 *   SAME account only burns requests and delays the message the user needs to
 *   see, so none of it is retried; a 403 limit still rotates to another account
 *   when the pool holds one, which is a routing decision rather than a retry;
 * - `ABORTED` — the caller already cancelled.
 *
 * The DSH normal defaults would apply anyway; stating the values here pins them
 * so this route never retries less than the rest of the plugin.
 */
export declare const KIMI_CODE_RETRY_POLICY_CONFIG: {
    mode: 'normal';
    maxRetries: number;
    retryableCodes: string[];
    backoff: {
        initialDelayMs: number;
        maxDelayMs: number;
        jitterRatio: number;
    };
};
/** Configured effort when the model supports it, else the adapter's preference order. */
export declare function resolveDefaultReasoningEffort(efforts: readonly string[], configuredEffort?: string | null): ReasoningEffortId | undefined;
/**
 * What one failed response means for the retry policy.
 *
 * The service overloads a single status for unrelated problems — a 401 covers
 * both "your token is bad" and "your plan does not include k3", and a 429
 * covers both ordinary back-pressure and a spent quota that must not be
 * retried. The body text is what separates them, so the classification reads
 * it rather than trusting the status alone.
 */
export interface KimiFailureClassification {
    /** DSH error code; decides whether the route retries. */
    code: string;
    /** Message shown to the user, with the provider's own text appended. */
    message: string;
    /** True only when the failure is worth retrying. */
    retryable: boolean;
    /**
     * 本次失败是不是上游引擎过载（正文命中 `UPSTREAM_OVERLOAD_PATTERNS`）。
     *
     * 单列成一个字段，是因为「过载」这条信息号池需要、而 code 本身已经不够用了：
     * 过载要可重试（harness 的退避重试正是为它准备的），所以它必须留在
     * retryable 集合里；但过载不是任何账号的错，所以它绝不能被当成账号级限流
     * 写进冷却。code 只有一个，说不了这两件事；`accountScoped` 也只回答「能不能
     * 换号」，不回答「要不要冷却」——真正限流时答案是「能换号、也要冷却」，
     * 过载时是「不必换号、更不必冷却」。两条路都可重试却必须分开处理，所以这里
     * 把归属显式带出来，而不是让调用方拿状态码去猜：同一个 429 状态码同时承载
     * 这两种含义，而这正是本缺陷的成因。
     */
    upstreamOverload: boolean;
    /**
     * True when the refusal belongs to THIS account alone, so another pooled
     * account may still serve the same request.
     *
     * A spent usage window is the case that matters, and this service reports it
     * as a 403 — neither a bad credential nor retryable back-pressure, so nothing
     * in the code or the message says "rotate". Asking the same account again
     * cannot help; taking it out of rotation until its window resets lets the next
     * account answer, and each account in the pool carries its own quota.
     *
     * False for every verdict that belongs to the request or to the plan: an
     * entitlement refusal, a malformed body, ordinary overload. Rotating on one of
     * those would spend every account in the pool to learn the same answer from
     * each of them.
     */
    accountScoped: boolean;
}
/** Short, single-line excerpt of one error body, safe to show a user. */
export declare function summarizeFailureBody(raw: string): string;
/**
 * Classify one non-2xx response for the retry policy.
 *
 * @param status - HTTP status the service answered with.
 * @param bodyText - raw response body, used to separate overloaded statuses.
 */
export declare function classifyKimiFailure(status: number, bodyText: string): KimiFailureClassification;
/**
 * How long one account stays out of rotation after it reports a spent limit.
 *
 * The reset instant is read from the body whenever the service states one — as a
 * numeric field, or as an instant carrying its own zone — and the length of the
 * window the service names is used otherwise. The zone is required for that
 * instant because an unqualified one is ambiguous, and a cooldown computed from
 * the wrong zone is either hours too long or already over; where the body is
 * ambiguous the window length is the honest answer.
 *
 * Both ends of the range are load-bearing. A reset instant barely in the future
 * would otherwise read as no cooldown at all and put the account straight back
 * into rotation to be refused again; and a reset instant already in the past
 * (a stale cache, a clock skew) falls back to the window length above rather
 * than to no cooldown at all.
 */
export declare function accountLimitCooldownMs(bodyText: string, now?: number): number;
export interface KimiCodeAdapterOptions {
    fetchFn?: typeof fetch;
    attachments?: AttachmentImageReader;
    /**
     * Video reader seam.
     *
     * DSH's attachment service stores images only, so a deployment that produces
     * video references injects the reader here. Absent, video occurrences degrade
     * to an explicit text placeholder rather than silently vanishing.
     */
    videos?: AttachmentVideoReader;
    /** Live catalog loader seam; defaults to the managed `/models` call. */
    loadCatalog?: () => Promise<KimiCodeCatalogModel[]>;
}
export declare class KimiCodeAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences?;
    private readonly options;
    /**
     * Rotation pool, or null for the single stored credential.
     *
     * Only the plugin entry installs one, because it owns the pool's storage; an
     * adapter built without one must keep working off the one credential file and
     * must not create pool state of its own.
     */
    private readonly accountPool;
    constructor(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, preferences?: KimiCodePreferenceStore | undefined, options?: KimiCodeAdapterOptions, accountPool?: KimiCodeAccountPool);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): {
        width: number;
        height: number;
        maxBytes: number;
    };
    private settings;
    /**
     * Catalog for the picker: the live managed listing when reachable, the
     * shipped fallback otherwise, narrowed by the user's enabled selection.
     */
    private catalog;
    private contextWindowFor;
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private requestStream;
    /**
     * What one in-band failure becomes once the pool has been told what the
     * verdict means for it.
     *
     * Reclassification and the pool reaction are separate because they answer
     * different questions about the same classification: the code decides whether
     * the harness retries, `accountScoped` decides whether a retry could land
     * somewhere that can answer. The mapper can supply only the first, which is
     * why the wire object is recorded there and read here.
     *
     * The body is the one a non-2xx response would have carried, so every pattern
     * below reads exactly what the HTTP branch reads and a limit cannot mean one
     * thing as a status and another as an event. The request itself is NOT
     * re-issued: its body is already open and part-read, and the harness retry
     * policy owns the repeat.
     */
    private inBandStreamFailure;
    /**
     * Cool the account whose own rate limit the stream reported.
     *
     * The window this route already defaults to, never a Retry-After: there is no
     * 429 response to read one from, and a delay stated on the 200 belongs to a
     * different message. An account-scoped verdict takes its own window instead,
     * because a spent balance is not back-pressure and 15 minutes would put the
     * account back into rotation four times inside the window that refused it.
     */
    private coolInBandRateLimit;
}
export { clearCachedCatalog, buildModelOptions, reasoningEffortsFor, PROVIDER_ID };
//# sourceMappingURL=adapter.d.ts.map