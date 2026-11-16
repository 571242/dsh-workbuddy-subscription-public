import type { AccountPoolStatusDto, PoolAccountSummaryDto } from './account-pool-contracts.ts';
export interface OllamaUsageDto {
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
    /** Unix milliseconds the last completed turn was counted. */
    lastCountedAt?: number;
}
/** One account as the Ollama card renders it. Never carries the key. */
export interface OllamaAccountSummaryDto extends PoolAccountSummaryDto {
    /** Model id this account last served, when the adapter recorded one. */
    lastModelId?: string;
    usage?: OllamaUsageDto;
}
/** The whole pool slice the card needs. */
export interface OllamaPoolStatusDto {
    accounts: OllamaAccountSummaryDto[];
    activeAccountId?: string;
    rotationStrategy: AccountPoolStatusDto['rotationStrategy'];
}
/** Everything the settings card renders for the Ollama tab. */
export interface OllamaWebStatus {
    pool: OllamaPoolStatusDto;
    /** Model ids synced from the service's own tag list. */
    models: {
        id: string;
        name?: string;
    }[];
    /**
     * Which of them the user has switched on: null is 'no filter', i.e. every
     * model in the list — modelling 'all' this way rather than as an explicit
     * all-ids list means a model the service adds later is not silently hidden
     * by a selection made before it existed. An array is an explicit selection,
     * and an empty one switches every model off.
     */
    enabledModelIds: string[] | null;
    /** True when at least one account can currently serve a request. */
    usable: boolean;
    catalogSynced: boolean;
    /**
     * The thinking level the user picked in the settings card; null is 'do not
     * specify', which leaves each model on its own default.
     */
    defaultReasoningEffort: string | null;
}
/**
 * The thinking levels this line's card offers.
 *
 * Deliberately narrower than the union of what every model accepts. Ollama's
 * thinking control comes in three shapes (see {@link thinkingModeForModel} in
 * src/host/ollama/types.ts): gpt-oss takes low/medium/high, the boolean models
 * (deepseek-r1, qwq, qwen3) take only on/off, and every other model takes no
 * thinking control at all. These four strings are the vocabulary both shapes can
 * be expressed with, so one dropdown covers the whole line.
 *
 * Whether a given model can actually honour a level is decided by the host, not
 * by this list: {@link thinkForModel} in src/host/ollama/types.ts drops what a
 * model cannot express, so picking 'high' is safe for a user whose catalog holds
 * a mixture of families.
 */
export declare const OLLAMA_REASONING_EFFORTS: readonly ["none", "low", "medium", "high"];
export type OllamaReasoningEffort = typeof OLLAMA_REASONING_EFFORTS[number];
/**
 * Whether a submitted value names a level this line accepts.
 *
 * The route uses this to refuse an unknown level outright. Storing one anyway
 * would be silently useless: {@link thinkForModel} drops a level a model cannot
 * express, so the card would keep showing a choice that does nothing at all.
 */
export declare function isOllamaReasoningEffort(value: unknown): value is OllamaReasoningEffort;
/** Actions the accounts endpoint accepts. */
export type OllamaAccountAction = 'add' | 'set-primary' | 'set-alias' | 'delete' | 'clear-cooldown' | 'strategy';
//# sourceMappingURL=ollama-contracts.d.ts.map