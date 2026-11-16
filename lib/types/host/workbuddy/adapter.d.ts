import { LlmAdapter, LlmError, ReasoningEffortId, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type WorkBuddyPreferenceStore } from './token-store.ts';
import { type WorkBuddyModelEntry } from './model-catalog.ts';
import { type AttachmentImageReader } from './mapper.ts';
import type { WorkBuddyCredentials } from './token-store.ts';
import type { WorkBuddyAccountPool } from './account-pool.ts';
import { type WorkBuddyUsageLedger } from './guardrails.ts';
/**
 * Effort this route materializes when the caller names none.
 *
 * Preference order: the user's configured level when the model accepts it,
 * otherwise the level the gateway's own catalog declares for that model (the
 * same default the official CLI applies), otherwise nothing — which leaves the
 * provider's own default in charge. A configured level the model does not
 * accept is ignored rather than sent, since the endpoint rejects an unsupported
 * level with `code 11150`.
 */
export declare function resolveDefaultReasoningEffort(efforts: readonly string[], configuredEffort?: string | null, modelDefaultEffort?: string | null): ReasoningEffortId | undefined;
/** Cooldown a 429 imposes when the service names no reset instant. */
export declare const POOL_COOLDOWN_MS: number;
export interface WorkBuddyAdapterOptions {
    /**
     * Per-account daily token counters behind the local guardrails.
     *
     * Absent means the guardrails cannot be evaluated, so a deployment without it
     * never refuses a request for a reason nothing is counting.
     */
    usageLedger?: WorkBuddyUsageLedger;
    fetchFn?: typeof fetch;
    attachments?: AttachmentImageReader;
    /** Live catalog loader seam; defaults to the gateway `/v3/config` call. */
    loadCatalog?: (credentials: WorkBuddyCredentials) => Promise<WorkBuddyModelEntry[]>;
    /**
     * Multi-account pool this adapter rotates through.
     *
     * Absent leaves the line on its single-credential path, which is what the
     * headless tests and any caller that predates the pool use.
     */
    accountPool?: WorkBuddyAccountPool;
}
export declare class WorkBuddyAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences?;
    private readonly options;
    /** Null keeps the pre-pool single-credential path. */
    private readonly accountPool;
    constructor(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, preferences?: WorkBuddyPreferenceStore | undefined, options?: WorkBuddyAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    private settings;
    private credentials;
    /**
     * Catalog for the picker: the live gateway listing when reachable, the
     * shipped table otherwise.
     *
     * The gateway is the authority on capabilities, so its answer replaces the
     * fallback rather than merging with it — a model whose context window changed
     * upstream must not keep a stale local value.
     */
    private catalog;
    /**
     * Models the picker may offer.
     *
     * The catalog is filtered by the account's own region: asking a region for a
     * model it does not serve answers 400 `code 11102`, so offering one would
     * hand the user a model that cannot work.
     */
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    /**
     * Effort this request should carry, or `undefined` to send none.
     *
     * Order: the caller's explicit choice, then the user's configured level, then
     * the level the gateway catalog declares for this model. The last step
     * matters because the endpoint returns an **empty `reasoning_content`** when
     * no `reasoning_effort` is present, even for a reasoning-only model: measured
     * on `deepseek-v4.1-flash`, the same prompt yields 0 reasoning characters
     * with no field and 130-215 with one. Omitting it therefore silently drops
     * the model's thinking instead of letting the provider pick, so the catalog's
     * own default (which is what the official CLI sends) is materialized here.
     *
     * A candidate the model does not accept is discarded rather than sent, since
     * the endpoint rejects an unsupported level with `code 11150`.
     */
    /**
     * Accounts the LOCAL guardrails refuse for this model right now.
     *
     * Reads only numbers this plugin already owns — the billing snapshot's
     * remaining credits and this line's own token counters — so it never becomes a
     * second, disagreeing source of truth about the upstream allowance.
     */
    private guardrailBlockedAccounts;
    private effortFor;
    private requestStream;
}
/**
 * Map one failed HTTP response onto a DSH failure.
 *
 * The subscription reports its own conditions inside a JSON `code` while the
 * status line stays generic, so the body is read for the specific cases the
 * status alone cannot express — notably the quota signal, whose message carries
 * the instant the allowance resets.
 */
export declare function classifyFailure(status: number, detail: string, headers?: Headers): LlmError;
/**
 * The reset instant a quota refusal names, as a delay from now.
 *
 * A 24h allowance that is exhausted answers 429 / `code 6004` with the wall
 * clock it lifts — but only in the MESSAGE, never in a header, and in two
 * realm-specific wordings (measured: intl "… resets at 2026-09-20 10:50:48
 * UTC+8", cn "… 将在 2026-10-09 14:44:59 UTC+8 重置"). Reading the status alone
 * therefore loses the only fact that says how long the account is out, and the
 * pool parks a 24-hour limit for five minutes before trying it again.
 *
 * Deliberately tolerant, in the same direction as their gateway: an unparseable
 * body yields `undefined` (callers keep their default cooldown) rather than an
 * error, because this runs on a failure path. An absent `UTC±h` marker means
 * UTC, which is how the sibling implementation reads it too.
 */
export declare function readRateLimitReset(detail: string, now?: number): number | undefined;
/** Read the subscription's own numeric error code out of a response body. */
export declare function readErrorCode(detail: string): number | null;
export { PROVIDER_ID, PROVIDER_NAME };
//# sourceMappingURL=adapter.d.ts.map