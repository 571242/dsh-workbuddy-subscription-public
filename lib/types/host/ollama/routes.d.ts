import type { Context } from '@deepseek-ai/cordis';
import type { OllamaAccountPool } from './account-pool.ts';
import type { FileModelSettingsStore } from './token-store.ts';
import { type OllamaWebStatus } from '../../shared/ollama-contracts.ts';
/** Where a user creates the keys this line stores. */
export declare const OLLAMA_KEYS_URL = "https://ollama.com/settings/keys";
export interface OllamaRouteOptions {
    accountPool: OllamaAccountPool;
    modelSettings: FileModelSettingsStore;
    fetchFn?: typeof fetch;
}
/** Assemble the whole status payload the Ollama tab renders. */
export declare function getOllamaWebStatus(options: OllamaRouteOptions): Promise<OllamaWebStatus>;
/**
 * Register the Ollama settings API.
 *
 * The surface is deliberately the same one every other line exposes - status,
 * accounts, models - so the shared settings card and the client API helper
 * work against it without a per-provider special case.
 */
export declare function registerOllamaRoutes(ctx: Context, options: OllamaRouteOptions): () => void;
//# sourceMappingURL=routes.d.ts.map