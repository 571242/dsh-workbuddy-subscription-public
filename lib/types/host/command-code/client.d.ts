import { PROVIDER_ID } from './types.ts';
import { FileCredentialStore, type CommandCodeCatalogModel } from './token-store.ts';
import type { CommandCodeAccount, CommandCodeAccountQuota, CommandCodeApiEnv, CommandCodeMeter, CommandCodeUsageWindow, CommandCodeWire } from '../../shared/command-code-contracts.ts';
export interface CommandCodeRequestOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    apiEnv?: CommandCodeApiEnv;
}
/**
 * Attribution headers for every Command Code request.
 *
 * The alpha routes are the ones the official CLI calls, so the plugin
 * identifies with the same vocabulary; the provider API only needs the bearer
 * token plus a JSON content type.
 */
export declare function commandCodeHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string>;
/** Map `/alpha/whoami` (or a stored key's own facts) onto the public account DTO. */
export declare function parseWhoami(payload: unknown, fallback?: Partial<CommandCodeAccount>): CommandCodeAccount;
/** Resolve the plan id the subscription or credits payload reports, when either does. */
export declare function parsePlanId(payloads: readonly unknown[]): string | null;
/**
 * Subscription status such as `active`, `trialing`, or `past_due`.
 *
 * The CLI treats exactly `active`, `trialing`, and `past_due` as entitled, so
 * the status is surfaced rather than swallowed: a card that showed an expired
 * subscription's remaining credits as usable would be worse than showing none.
 */
export declare function parseSubscriptionStatus(payload: unknown): string | null;
/** End of the current billing period, in Unix milliseconds. */
export declare function parseSubscriptionPeriodEnd(payload: unknown): number | null;
/**
 * Turn one billing/usage payload into meters.
 *
 * The named blocks the service actually sends are read first, so windows carry
 * their real labels; the generic sweep afterwards still catches any bounded
 * allowance a future payload introduces, rather than reporting nothing.
 */
export declare function parseMeters(payload: unknown): CommandCodeMeter[];
/** Parse an ISO string, Unix seconds, or Unix milliseconds into Unix milliseconds. */
export declare function parseTimestamp(value: unknown): number | null;
/** Map `/alpha/usage/summary` onto the windowed allowance DTO. */
export declare function parseUsageWindows(payload: unknown): CommandCodeUsageWindow[];
/**
 * Total remaining credits.
 *
 * `/alpha/billing/credits` reports three separate pools rather than one total
 * (`credits.monthlyCredits`, `purchasedCredits`, `freeCredits`), and a plain
 * `credits` lookup only finds the containing object — which is why this used to
 * answer null and the card showed a blank balance. The pools are summed exactly
 * as the CLI sums them; a payload that reports a flat balance still works.
 */
/** Exported for the quota regression tests; not part of the route surface. */
export declare function extractCreditsBalanceForTest(payload: unknown): string | null;
/** Parse the public `/provider/v1/models` payload. */
export declare function parseProviderModels(payload: unknown): CommandCodeCatalogModel[];
/**
 * Fetch the live catalog. The endpoint is public, so this works before sign-in
 * and is what fills the settings card's context-window defaults.
 */
export declare function fetchProviderModels(options?: CommandCodeRequestOptions): Promise<CommandCodeCatalogModel[]>;
/** Cached catalog with a TTL; a failed refresh keeps the previous snapshot.
 *
 * On the first cache miss of a process the persisted snapshot is rehydrated
 * first, so a restart serves the previous listing without waiting on the
 * network. An expired snapshot still answers immediately (stale) while a
 * refresh runs in the background — the catalog is not fast-moving data, and
 * waiting on an unreachable endpoint turned a restart into the full discovery
 * timeout on every model resolution.
 */
export declare function loadProviderModels(options?: CommandCodeRequestOptions & {
    force?: boolean;
}): Promise<CommandCodeCatalogModel[]>;
export declare function getCachedCatalog(): CommandCodeCatalogModel[];
export declare function isCatalogStale(): boolean;
export declare function getCachedCatalogFetchedAt(): number | null;
export declare function clearCachedCatalog(): void;
/** Effective context window: a saved override wins over the catalog value. */
export declare function effectiveContextWindow(modelId: string, catalog: readonly CommandCodeCatalogModel[], overrides: Record<string, number>): number;
export declare function whoami(apiKey: string, options?: CommandCodeRequestOptions): Promise<unknown>;
/**
 * Verify one API key and read the account facts behind it.
 *
 * This is the single validation point used by manual key entry, by the browser
 * callback, and by the connection test, so a key that cannot answer `whoami`
 * is never stored.
 */
export declare function verifyApiKey(apiKey: string, options?: CommandCodeRequestOptions): Promise<CommandCodeAccount>;
/**
 * Returns the quota snapshot for the most recently requested account.
 * Kept with a no-argument signature for backward compatibility.
 */
export declare function getCachedQuota(): CommandCodeAccountQuota | undefined;
/**
 * The cached snapshot only when it belongs to this account.
 *
 * Passing no account keeps the pre-pool behavior of returning whatever was
 * fetched last. This is the lookup the account pool calls while it builds its
 * summaries: a pure memory read, never a fetch.
 */
export declare function getCachedQuotaFor(accountId?: string | null): CommandCodeAccountQuota | undefined;
export declare function clearCachedQuota(): void;
export interface FetchAccountQuotaOptions {
    fetchFn?: typeof fetch;
    force?: boolean;
    accountId?: string;
}
/**
 * Read credits, subscriptions, and usage, tolerating a service that answers
 * only some of the three. Every failure is captured as a missing source rather
 * than failing the whole snapshot, because a working credit balance is still
 * worth showing when the usage route is down.
 */
export declare function fetchAccountQuota(store?: Pick<FileCredentialStore, 'read'>, fetchFnOrOptions?: typeof fetch | FetchAccountQuotaOptions, force?: boolean, accountId?: string): Promise<CommandCodeAccountQuota>;
/** Catalog entry list with the exact defaults the settings card renders. */
export declare function buildModelOptions(catalog: readonly CommandCodeCatalogModel[], enabledModelIds: readonly string[], overrides: Record<string, number>): Array<{
    id: string;
    name: string;
    enabled: boolean;
    defaultContextWindow: number;
    contextWindow: number;
    defaultMaxTokens: number;
    reasoningEfforts?: string[];
    wire: CommandCodeWire;
}>;
export { PROVIDER_ID };
//# sourceMappingURL=client.d.ts.map