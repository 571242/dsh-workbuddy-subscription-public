import { LlmAdapter, type GenerateOptions as HarnessGenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { type GenerateOptions } from '../common/llm-compat.ts';
import { type OllamaCatalogModel, type OllamaThinkingCapability } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type OllamaCredentials } from './token-store.ts';
import { OllamaAccountPool } from './account-pool.ts';
import { type OllamaRequest } from './client.ts';
export interface OllamaAdapterOptions {
    fetchFn?: typeof fetch;
    /** Test seam; production reads `/api/tags` with the active account's key. */
    loadCatalog?: (fetchFn: typeof fetch, credentials: OllamaCredentials) => Promise<OllamaCatalogModel[]>;
    /**
     * Attachment store used to read image bytes for the request.
     *
     * DSH delivers an image as a durable reference, not as bytes, so a route that
     * declares image input has to resolve those references before building the
     * body. Without it the image is dropped and the turn silently becomes
     * text-only while the model picker still advertises image support.
     */
    attachments?: Pick<AttachmentStore, 'readImage'>;
}
export declare class OllamaAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly options;
    /**
     * Rotation pool, or null for the single stored key.
     *
     * Only the plugin entry installs it, because the entry owns the storage; an
     * adapter built without one must keep reading the one credential file rather
     * than minting pool state that would outlive the process.
     */
    private readonly accountPool;
    /**
     * What `/api/show` has already said, per model id.
     *
     * Only a successful read is remembered. A failed one is a transient condition
     * (no key, a 500, a proxy), and caching it would pin every model to the
     * fallback ladder for the life of the process - so it is asked again next time.
     */
    private readonly thinkingCache;
    /** Probes currently in flight, so one model asked twice at once is read once. */
    private readonly thinkingProbes;
    constructor(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, options?: OllamaAdapterOptions, accountPool?: OllamaAccountPool);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    private settings;
    /**
     * Catalog for the picker: the live `/api/tags` listing when a key can reach it,
     * the shipped fallback otherwise, narrowed by the user's enabled selection.
     *
     * Ollama's model set moves quickly, so a stale local table would be the wrong
     * default; the fallback exists only so the line is usable before the first
     * successful sync.
     */
    private catalog;
    /** Any usable key, for the catalog call; the pool decides real routing later. */
    private anyCredentials;
    /**
     * What this model says about its own thinking, read once and remembered.
     *
     * Never throws and never rejects: an adapter that cannot reach `/api/show`
     * (no key stored yet, service down) is a line that still resolves models and
     * still chats, one step behind on the ladder.
     */
    private thinkingCapability;
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: HarnessGenerateOptions): AsyncIterable<StreamChunk>;
    private requestStream;
}
/**
 * Project DSH's request shape onto Ollama's, per surface.
 * Consumes the canonical Message vocabulary produced by normalizeGenerateOptions.
 */
export declare function toOllamaRequest(options: GenerateOptions, attachments?: Pick<AttachmentStore, 'readImage'>, signal?: AbortSignal, 
/**
 * What the target model says about its own thinking, when it was read. Passed
 * in rather than looked up here because this is a pure projection: it must not
 * spend a network read to decide what one request may send.
 */
declared?: OllamaThinkingCapability): Promise<Omit<OllamaRequest, 'signal'>>;
//# sourceMappingURL=adapter.d.ts.map