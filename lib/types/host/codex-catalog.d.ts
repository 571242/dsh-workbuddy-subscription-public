import type { StoredOAuthCredentials } from './token-store.ts';
type FetchLike = typeof fetch;
/** One model as the live listing describes it. */
export interface CodexCatalogEntry {
    id: string;
    name: string;
    /** Window the listing stated, or null when it stated none. */
    contextWindow: number | null;
    inputModalities: readonly ('text' | 'image')[];
    /** Reasoning levels the listing says the model accepts; absent when it stated none. */
    reasoningEfforts?: readonly string[];
    defaultReasoningEffort?: string | null;
}
/** Drop the cached listing, forcing the next load to hit the network. */
export declare function clearCachedCatalog(): void;
/**
 * The listing currently held, or undefined before the first load.
 *
 * Callers that need a catalog with no credential read the shipped table
 * directly; returning it here under a different entry type would force every
 * one of them to convert it.
 */
export declare function getCachedCatalog(): readonly CodexCatalogEntry[] | undefined;
/** Whether the held listing is the shipped table standing in for a failed call. */
export declare function isCatalogFallback(): boolean;
export interface CodexCatalogLoadOptions {
    fetchFn?: FetchLike;
    signal?: AbortSignal;
    /** Bypass the cached listing and read the server again. */
    force?: boolean;
}
/**
 * Read the models this subscription can call.
 *
 * The shipped table in `shared/model-catalog.ts` stays the floor: it is what
 * answers a picker before the first sign-in, and what a failed listing falls
 * back to. The subscription listing is the authority once one is available,
 * because only the backend knows which models a plan currently serves and at
 * what context window — the reason subscription-only models exist at all.
 *
 * Single-flighted per account, because the harness resolves every model of every
 * provider when it builds the picker; without that, one picker build is one
 * round trip per model.
 */
export declare function loadCodexCatalog(credentials: StoredOAuthCredentials, options?: CodexCatalogLoadOptions): Promise<readonly CodexCatalogEntry[]>;
/**
 * Read the listing payload.
 *
 * The documented shape is `{ models: [...] }`, but a bare array is accepted too
 * so a backend that flattens the envelope does not read as an empty catalog.
 */
export declare function parseListing(payload: unknown): CodexCatalogEntry[];
export {};
//# sourceMappingURL=codex-catalog.d.ts.map