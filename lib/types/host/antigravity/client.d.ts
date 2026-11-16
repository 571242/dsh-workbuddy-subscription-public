import { FileCredentialStore, FileModelSettingsStore, type AntigravityCatalogModel } from './token-store.ts';
import type { AntigravityAccountQuota, AntigravityQuotaGroup } from '../../shared/antigravity-contracts.ts';
export declare const ANTIGRAVITY_QUOTA_CACHE_TTL_MS: number;
export declare function defaultUserAgent(): string;
export declare function antigravityHeaders(token: string): Record<string, string>;
export declare function jsonHeaders(token: string): Record<string, string>;
export declare function endpointCandidates(): string[];
export interface AntigravityTierInfo {
    id?: string;
    name?: string;
    description?: string;
}
export interface AntigravityIneligibleTier {
    tierId?: string;
    reasonMessage?: string;
    validationUrl?: string;
}
export interface LoadCodeAssistDetailResult {
    currentTier?: AntigravityTierInfo | null;
    paidTier?: AntigravityTierInfo | null;
    allowedTiers?: AntigravityTierInfo[];
    ineligibleTiers?: AntigravityIneligibleTier[];
    projectId?: string;
    raw?: Record<string, unknown>;
}
export declare function loadCodeAssistDetail(token: string, fetchFn?: typeof fetch, signal?: AbortSignal): Promise<LoadCodeAssistDetailResult | undefined>;
export declare function onboardUser(token: string, fetchFn?: typeof fetch, signal?: AbortSignal): Promise<void>;
export declare function listCloudAICompanionProjects(token: string, fetchFn?: typeof fetch): Promise<string | undefined>;
export declare function loadCodeAssist(token: string, fetchFn?: typeof fetch): Promise<string | undefined>;
export declare function postJson(path: string, token: string, body: Record<string, unknown>, fetchFn?: typeof fetch): Promise<{
    endpoint: string;
    status: number;
    data: unknown;
}>;
export declare function parseQuotaSummary(data: unknown): {
    groups: AntigravityQuotaGroup[];
    description?: string;
};
export declare function parseCatalogModels(data: unknown): AntigravityCatalogModel[];
/**
 * Merge a freshly discovered API catalog into the stored model selection.
 *
 * The API catalog is a *request-level* listing: its ids are runtime names
 * (`gemini-3.8-flash-tiered`, `claude-opus-4-6-thinking`, `gemini-3.1-pro-high`)
 * that share no vocabulary with the selectable plugin ids (`gemini-3.8-flash`,
 * `claude-opus-4-6`, `gemini-3.1-pro`). The picker and the adapter both iterate
 * the plugin table, so pruning the selection against the API ids kept nothing:
 * the first refresh after the shipped defaults were written dropped every
 * stored id, which left the card rendering every model unchecked and made a
 * deliberate pick look like it did not persist. Prune against the table the
 * selection actually indexes, and keep the API catalog as display metadata
 * only.
 *
 * @param stored - The selection currently persisted for the picker.
 * @param storedCatalog - The API catalog the previous refresh recorded.
 * @returns The selection to persist, drawn from the plugin model table.
 */
export declare function mergeCatalogSelection(stored: readonly string[], storedCatalog: readonly AntigravityCatalogModel[]): string[];
export declare function fetchAccountQuota(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, fetchFn?: typeof fetch, force?: boolean): Promise<AntigravityAccountQuota>;
export declare function getCachedQuota(): AntigravityAccountQuota | undefined;
export declare function clearCachedQuota(): void;
//# sourceMappingURL=client.d.ts.map