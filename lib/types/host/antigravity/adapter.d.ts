import { LlmAdapter, ReasoningEffortId, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { FileCredentialStore, FileModelSettingsStore, type AntigravityPreferenceStore } from './token-store.ts';
import { type AttachmentImageReader } from './mapper.ts';
export declare function resolveDefaultReasoningEffort(efforts: readonly string[], configuredEffort?: string | null): ReasoningEffortId | undefined;
import { AccountPoolStore } from './account-pool.ts';
/** Cooldown applied to a 429 that states no reset time anywhere. */
export declare const DEFAULT_RATE_LIMIT_COOLDOWN_MS: number;
/**
 * Milliseconds in one duration string: protobuf JSON (`"12.5s"`) or Go form
 * (`"1h2m3.5s"`, `"373.8ms"`). Undefined when the string is neither.
 */
export declare function parseDurationMs(value: string): number | undefined;
/**
 * How long one 429 says to wait, or undefined when it does not say.
 *
 * Google states the reset in the error body rather than in `Retry-After`:
 * `ErrorInfo.metadata.quotaResetTimeStamp` (an instant) and `quotaResetDelay`
 * (a Go duration) for a spent allowance, `RetryInfo.retryDelay` for a short
 * rate limit. Reading only the header made every Antigravity 429 fall back to
 * the flat 15 minutes, whether the allowance reset in two seconds or in five
 * hours. The most specific statement wins; the header is the last resort.
 */
export declare function retryDelayMs(headers: Headers, body: string, now?: number): number | undefined;
/**
 * The same request body without its `toolConfig`, when that config asked for
 * VALIDATED; undefined when it did not (nothing to fall back from).
 */
export declare function withoutValidatedToolConfig(body: string): string | undefined;
export declare class AntigravityAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences?;
    private readonly options;
    private readonly accountPool;
    /**
     * Set once the service refuses `functionCallingConfig.mode: VALIDATED`; from
     * then on Claude requests leave the mode unset (AUTO) for this process.
     */
    private validatedToolCallingRejected;
    constructor(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, preferences?: AntigravityPreferenceStore | undefined, options?: {
        fetchFn?: typeof fetch;
        attachments?: AttachmentImageReader;
    }, accountPool?: AccountPoolStore);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): undefined;
    imageRequestPricing(_provider?: string, _model?: string): undefined;
    imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): {
        width: number;
        height: number;
        maxPixels: number;
        maxBytes: number;
    } | {
        width: number;
        height: number;
        maxBytes: number;
    };
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    private requestStream;
}
//# sourceMappingURL=adapter.d.ts.map