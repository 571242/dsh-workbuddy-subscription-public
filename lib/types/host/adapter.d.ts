import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { PROVIDER_ID } from './model-catalog.ts';
import type { CodexCatalogEntry, CodexCatalogLoadOptions } from './codex-catalog.ts';
import { ResponsesClient } from './responses-client.ts';
import type { SubscriptionPreferenceStore } from './preferences.ts';
export declare class CodexChatGptAdapter extends LlmAdapter {
    private readonly client;
    private readonly preferences?;
    /**
     * Live listing loader, when the host can sign in. Absent in tests and in a
     * host with no credential, and then the shipped table is the catalog.
     */
    private readonly loadCatalog?;
    constructor(client: ResponsesClient, preferences?: SubscriptionPreferenceStore | undefined, 
    /**
     * Live listing loader, when the host can sign in. Absent in tests and in a
     * host with no credential, and then the shipped table is the catalog.
     */
    loadCatalog?: ((options?: CodexCatalogLoadOptions) => Promise<readonly CodexCatalogEntry[]>) | undefined);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(_provider?: string, _model?: string): undefined;
    listModels(): Promise<readonly LlmModelInfo[]>;
    resolveModel(_provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    /**
     * The live listing, or undefined when this line has no way to fetch one.
     *
     * Never throws: a listing failure must not become a failed picker or a
     * rejected model resolution. `loadCodexCatalog` already answers with the
     * shipped table on failure, so the catch here only covers a throwing loader.
     */
    private catalog;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
export { PROVIDER_ID };
//# sourceMappingURL=adapter.d.ts.map