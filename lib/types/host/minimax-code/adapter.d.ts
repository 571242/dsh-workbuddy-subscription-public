/**
 * The DSH adapter for the MiniMax Code subscription.
 *
 * It follows the shape every other line in this package uses — claim the provider
 * id, list the hardcoded directory, resolve one model, stream one request — with
 * two differences that belong to this line alone:
 *
 * 1. the credential is the desktop app's own \`auth.json\`, read and renewed through
 *    ./oauth.ts under the read-only-first discipline; and
 * 2. there is no account pool. Pooling exists to rotate several signed-in accounts
 *    against one subscription; here there is exactly one credential, shared with an
 *    application the user is also running, and inventing a second one would mean
 *    racing that application for a rotation neither of them needs.
 */
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { PROVIDER_ID } from './types.ts';
import { MinimaxCodeCredentialStore, MinimaxCodeModelSettingsStore, type MinimaxCodePreferenceStore } from './token-store.ts';
import { clampOutputToContext, maxOutputTokensFor, type AttachmentVideoReader, type AttachmentImageReader } from './mapper.ts';
import type { MinimaxCodeAccountPool } from './account-pool.ts';
/**
 * Transient-failure retry policy for the minimax-code route.
 *
 * The subscription fronts the model providers, so a call can fail with a 502/503
 * while the subscription and the credential stay perfectly usable. The retryable
 * set is therefore SERVER (any 5xx), RATE_LIMIT (genuine back-pressure), TRANSPORT
 * (a connection that produced no response) and TIMEOUT (a stalled stream, handled
 * by the idle watchdog).
 *
 * Deliberately outside the set: INVALID_CREDENTIAL (a rejected token fails
 * identically every time), PROVIDER_ERROR (a 400 or a plan refusal), and ABORTED
 * (the caller already cancelled).
 */
export declare const MINIMAX_CODE_RETRY_POLICY_CONFIG: {
    mode: 'normal';
    maxRetries: number;
    retryableCodes: string[];
    backoff: {
        initialDelayMs: number;
        maxDelayMs: number;
        jitterRatio: number;
    };
};
/** What one failed response means for the retry policy. */
export interface MinimaxFailureClassification {
    /** DSH error code; decides whether the route retries. */
    code: string;
    /** Message shown to the user, with the service's own text appended. */
    message: string;
    /** True only when the failure is worth retrying. */
    retryable: boolean;
    /**
     * Whether the verdict is about the ACCOUNT that made the request.
     *
     * False for every failure that belongs to the request or to the plan: ordinary
     * back-pressure, an overload, a malformed body. True only for a Token Plan window
     * this account has spent, which stays spent — so cooling it is what lets the NEXT
     * request land on an account that can answer, and cooling a plan-scoped refusal
     * would take a whole pool offline over one request. Same rule and same field name
     * as the sibling lines' `accountScoped` (kimi-code/adapter.ts:246).
     */
    accountScoped: boolean;
}
/**
 * Classify one non-2xx response for the retry policy.
 *
 * A 401 on this route is the one failure with an unambiguous remedy, and it is the
 * one the credentials rule exists for: the service answers
 * \`{"code":401,"message":"token is required"}\` both when no credential was sent
 * and when the one that was sent is no longer accepted, so the message names the
 * sign-in path instead of asking the user to guess.
 */
export declare function classifyMinimaxFailure(status: number, bodyText: string): MinimaxFailureClassification;
export interface MinimaxCodeAdapterOptions {
    fetchFn?: typeof fetch;
    /** Attachment seam: verified bytes for one durable image. */
    attachments?: AttachmentImageReader;
    /**
     * Attachment seam: verified bytes for one durable video.
     *
     * Absent means every video resolves to `unavailable` and the model is told the
     * clip is missing, which is the same honest degradation the image seam uses.
     */
    videos?: AttachmentVideoReader;
    /**
     * The account pool, when this process installed one.
     *
     * With a pool the adapter rotates between accounts and lets a 429 cool one
     * account down instead of taking the whole line offline; without one it keeps
     * the single-credential behaviour it had before, reading and renewing the one
     * stored credential. Both postures are supported because the pool is optional
     * in a composition (a headless host, a test), and a missing pool must not make
     * the route unusable.
     */
    accountPool?: MinimaxCodeAccountPool;
}
export declare class MinimaxCodeAdapter extends LlmAdapter {
    private readonly store;
    /**
     * The JSON file fallback for the model selection.
     *
     * Every sibling line has one, and it is not dead weight even where a settings
     * service exists: it is what a later run on a harness that dropped the register
     * seam reads back.
     */
    private readonly modelSettings;
    /**
     * Registered model settings, when the harness still offers the register seam.
     *
     * Optional because the adapter is also constructed by tooling and tests that
     * have no settings service; {@link settings} then reads the file directly, so
     * both shapes answer the same three questions.
     */
    private readonly preferences;
    private readonly options;
    constructor(store?: MinimaxCodeCredentialStore, options?: MinimaxCodeAdapterOptions, modelSettings?: MinimaxCodeModelSettingsStore, preferences?: MinimaxCodePreferenceStore);
    /**
     * The current model selection.
     *
     * Synchronous on the register seam (the scope reads from memory) and a single
     * file read otherwise. The loop over models that consults it runs on every
     * model-picker query, so this is deliberately not memoized: a cached snapshot
     * would keep serving a model the user disabled in the card until the process
     * restarted, which is the complaint this whole settings surface exists to fix.
     */
    private settings;
    /**
     * The credential one request should present, and the pool account behind it.
     *
     * With a pool, the pool picks the account (rotation, cooldown, stickiness) and
     * owns the refresh, so this must not read the single-credential file: that file
     * mirrors one pooled account, and presenting it would silently pin every request
     * to whichever account was mirrored last.
     *
     * Without a pool the previous behaviour is kept exactly, including the
     * read-only-first refresh policy.
     */
    private acquireCredential;
    /**
     * Renew the credential the service just refused.
     *
     * With a pool, the account that failed is the one renewed, so the rotation lands
     * on that account's own record instead of the single-credential file; without a
     * pool the store's own forced refresh is what ran before the pool existed.
     */
    private renewCredential;
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): {
        width: number;
        height: number;
        maxBytes: number;
    };
    /**
     * The hardcoded directory, narrowed to what the user enabled it to serve.
     *
     * Nothing is fetched: the listing route is unavailable on this endpoint, so a
     * "live catalog" would be a request that can only ever fail.
     *
     * The line-wide switch is honoured before the selection is even resolved, so
     * turning the card's switch off exposes no model at all — including the ones
     * the user left ticked, which is what "off" has to mean if it is to mean
     * anything.
     */
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    /**
     * One model's resolved metadata, read through the current selection.
     *
     * The effective context window is the override when one is saved, and the
     * wire output cap is sized against that same number in requestStream. It is
     * deliberately not exposed as a fixed defaultMaxTokens reservation here.
     */
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    /**
     * One request, with the line's default reasoning effort materialized.
     *
     * A caller that states an effort is passed through untouched: DSH materializes
     * {@link resolveModel}'s default into the options for a picker-driven turn, so
     * a value arriving here is a deliberate choice and must not be replaced. Only
     * an unstated one is filled in, and only when the user actually configured a
     * global level — the shipped default is "say nothing", because the model has
     * its own and restating it in every body is a chance to disagree with it.
     */
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private requestStream;
}
export { PROVIDER_ID, MinimaxCodeCredentialStore };
export { maxOutputTokensFor, clampOutputToContext };
//# sourceMappingURL=adapter.d.ts.map