import { LlmAdapter, ReasoningEffortId, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { FileCredentialStore, FileModelSettingsStore, type CommandCodeCatalogModel, type CommandCodePreferenceStore } from './token-store.ts';
import { CommandCodeAccountPool } from './account-pool.ts';
import { type AttachmentImageReader } from './mapper.ts';
/** Configured effort when the model supports it, else the adapter's preference order. */
export declare function resolveDefaultReasoningEffort(efforts: readonly string[], configuredEffort?: string | null): ReasoningEffortId | undefined;
export interface CommandCodeAdapterOptions {
    fetchFn?: typeof fetch;
    attachments?: AttachmentImageReader;
    /** Live catalog loader seam; defaults to the public `/provider/v1/models` call. */
    loadCatalog?: () => Promise<CommandCodeCatalogModel[]>;
    /** Opt into strict Zero Data Retention (ZDR) routing. Overrides host environment when set. */
    zeroDataRetention?: boolean;
}
/**
 * Resolves whether Zero Data Retention (ZDR) routing is active for Command Code.
 * An explicit boolean on adapter options takes precedence over host environment variables.
 * When not specified in options, DSH_COMMAND_CODE_ZDR is consulted first, then CMD_ZDR.
 */
export declare function resolveZeroDataRetention(optionsZdr?: boolean): boolean;
/**
 * Classifies model-specific access or plan entitlement denials.
 * These are failures of permissions/entitlement for this model/account,
 * not invalid API credentials, so the account must not be marked invalid
 * and whole-account rotation must not occur.
 */
export declare function isCommandCodeModelAccessDenied(status: number, detail: string): boolean;
/**
 * Classifies actual credential invalidity (e.g. 401 Unauthorized, or 403 with explicit key errors).
 */
export declare function isCommandCodeCredentialInvalid(status: number, detail: string): boolean;
/** What one failed response means for this route's retry policy. */
export interface CommandCodeFailureClassification {
    /** DSH error code; decides whether the route retries. */
    code: string;
    /** True only when the failure is worth repeating. */
    retryable: boolean;
}
/**
 * The verdict one failed response becomes on this route.
 *
 * An in-band `error` event is a status the provider chose not to send as a
 * status, so the chain that answers a non-2xx body has to answer it too rather
 * than a second, looser one: every rule this route already owns - a model the
 * plan does not include, a rejected key, a spent quota - keeps owning the
 * answer, and the codes below are the ONLY place the HTTP path reads them from.
 *
 * `retryable` is membership of this route's own policy rather than a second
 * judgement, because a code is worth repeating exactly when RETRY_POLICY repeats
 * it; a verdict the policy would not act on must not be filed as transient.
 *
 * @param status - the response status, or the status an in-band type stands for.
 * @param detail - the response body, or the serialized in-band error envelope.
 */
export declare function classifyCommandCodeFailure(status: number, detail: string): CommandCodeFailureClassification;
export declare class CommandCodeAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences?;
    private readonly options;
    /**
     * Rotation pool, or null for the single stored key.
     *
     * The pool is only ever installed by the plugin entry, which owns its storage.
     * An adapter built without one must keep reading the one credential file and
     * must not create pool state on its own: that state outlives the process and
     * would leak cooldowns between unrelated runs.
     */
    private readonly accountPool;
    constructor(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, preferences?: CommandCodePreferenceStore | undefined, options?: CommandCodeAdapterOptions, accountPool?: CommandCodeAccountPool);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    private settings;
    /**
     * Catalog for the picker: the live Command Code listing when reachable, the
     * shipped fallback otherwise, narrowed by the user's enabled selection.
     */
    private catalog;
    private contextWindowFor;
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private requestStream;
}
//# sourceMappingURL=adapter.d.ts.map