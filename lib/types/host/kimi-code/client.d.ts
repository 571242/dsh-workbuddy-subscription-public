import { PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, type KimiCodeCatalogModel, type KimiCodeCredentials } from './token-store.ts';
import type { KimiCodeAccount, KimiCodeAccountQuota, KimiCodeExtraUsage, KimiCodeModelOption, KimiCodeRegion, KimiCodeUsageWindow, KimiCodeWire } from '../../shared/kimi-code-contracts.ts';
/** Endpoint suffixes on the coding API base. */
export declare const MODELS_PATH = "/models";
export declare const USAGES_PATH = "/usages";
export declare const ME_PATH = "/me";
/** Parse an ISO string, Unix seconds, or Unix milliseconds into Unix milliseconds. */
export declare function parseTimestamp(value: unknown): number | null;
/**
 * Headers for a managed coding API request.
 *
 * The OpenAI-compatible surface authenticates with a bearer token. On the
 * Anthropic-compatible surface the Anthropic SDK sends the token as
 * `x-api-key` instead and deliberately omits `authorization`, so both are
 * emitted — the service documents each surface and only reads its own field.
 */
export declare function kimiCodeHeaders(accessToken: string, wire?: KimiCodeWire, extra?: Record<string, string>): Promise<Record<string, string>>;
/**
 * Headers for one model call.
 *
 * The managed service attributes usage to the installation, so the same
 * \`X-Msh-*\` device identity the account endpoints require is sent here too.
 * The product token stays this plugin's own: the service documents third-party
 * clients against this endpoint, and claiming to be the official CLI is both
 * dishonest and, per its own terms, grounds for suspending the subscription.
 * The cost of that honesty is that a non-whitelisted user agent can be routed to
 * a deprioritized pool, which answers with a transient 429 — the retry policy in
 * the adapter is what absorbs it.
 */
export declare function modelRequestHeaders(accessToken: string, wire: KimiCodeWire): Promise<Record<string, string>>;
/** Test seam: resolve the URL one request goes to. */
export declare function requestUrl(wire: KimiCodeWire, region: KimiCodeRegion): string;
export declare function clearCachedCatalog(): void;
export declare function getCachedCatalog(): KimiCodeCatalogModel[];
/**
 * Fetch the models the signed-in subscription can use.
 *
 * The live listing is authoritative — it is what tells the plugin which models
 * the account's tier actually unlocks — so it is cached for half an hour and
 * re-read on demand from the settings card.
 *
 * The cache is consulted BEFORE a token is acquired whenever the caller does not
 * already hold one. That order is load-bearing: acquiring a token reads the
 * credential store, and on Windows that is a DPAPI unprotect through a spawned
 * `powershell.exe` (~200 ms). The harness resolves every model of every
 * provider when it builds the picker's catalog, and each resolution calls in
 * here, so acquiring first turned one catalog into one process launch per
 * model. A caller that passes `accessToken` still keys the cache on the token,
 * because a different account can see a different listing.
 */
export declare function loadProviderModels(options?: {
    fetchFn?: typeof fetch;
    store?: FileCredentialStore;
    accessToken?: string;
    region?: KimiCodeRegion;
    signal?: AbortSignal;
    force?: boolean;
    /**
     * Read the active credential from the account pool.
     *
     * Every refresh rotates the refresh token and invalidates the previous one.
     * The single-credential file is a *copy* of the pool's primary account, so
     * refreshing that copy spends the token the pool will present on the next
     * model request — the account then reads as rejected until a new sign-in.
     * Supplying this keeps the loader on the one credential authority.
     */
    credentialProvider?: (region: KimiCodeRegion) => Promise<string | undefined>;
}): Promise<KimiCodeCatalogModel[]>;
/**
 * Record which credential the last listing used, so a token-free caller for the
 * same region can reuse it instead of decrypting the mirror.
 */
export declare function rememberCatalogCredential(region: KimiCodeRegion, accessToken: string): void;
/** Test seam: forget which credential the cached listings were fetched with. */
export declare function clearCatalogCredentials(): void;
/** Choose the wire dialect for one model, from the live catalog when it says. */
export declare function wireForCatalogEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): KimiCodeWire;
/**
 * Thinking levels for one model, from the catalog when it declares them.
 *
 * `supports_thinking_type` is applied last because it is the field that can
 * invalidate the effort list itself. A model that declares `only` reasons at
 * every level, so offering `none` asks for a turn the service will reject; a
 * model that declares `no` does not reason at all, so exposing its levels would
 * advertise behaviour it does not have.
 */
export declare function reasoningEffortsForEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): string[];
/**
 * Default thinking level for one model, when the server states one.
 *
 * A declared default that the resolved effort list no longer contains is
 * dropped rather than carried through: with `only` in force the list can lose
 * `none`, and a default naming a level the model can no longer be asked for
 * would fail on the first turn that relied on it.
 */
export declare function defaultReasoningEffortForEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): string | undefined;
/**
 * Whether one model accepts tool declarations at all.
 *
 * Distinct from {@link dynamicToolsForEntry}, which asks the narrower question
 * of message-level declarations: a model can take tools at the top level and
 * not accept them per message, and collapsing the two would disable tools on a
 * model that still works. Precedence is the live listing, including an
 * explicit false, then the shipped registry.
 */
export declare function toolUseForEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): boolean;
/**
 * Prompt ceiling for one model, or undefined when it equals the window.
 *
 * The completion budget still uses the full window — the cap bounds what may be
 * sent, not how much may be generated — but a caller sizing a prompt needs the
 * smaller of the two whenever the service states a lower input bound.
 */
export declare function maxInputTokensForEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): number | undefined;
/**
 * Whether one model accepts message-level tool declarations.
 *
 * THE single resolution point for `dynamically_loaded_tools`: the settings card
 * and the request builder must never disagree, because the failure mode is a UI
 * that promises a capability the sent request silently drops. Precedence is the
 * live listing (including an explicit false), then the shipped registry.
 *
 * @param modelId - exact model id.
 * @param catalog - live catalog, possibly empty when offline.
 */
export declare function dynamicToolsForEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): boolean;
/** Input modalities for one model, from the catalog when it declares them. */
export declare function inputModalitiesForEntry(modelId: string, catalog: readonly KimiCodeCatalogModel[]): Array<'text' | 'image' | 'video'>;
/** Build the picker entries the settings card renders. */
export declare function buildModelOptions(catalog: readonly KimiCodeCatalogModel[], enabledModelIds: readonly string[], contextWindowOverrides: Record<string, number>): KimiCodeModelOption[];
/**
 * The snapshot read most recently, whichever account it belongs to.
 *
 * Kept for the pre-pool single-credential card, which has no account id to ask
 * with. A pooled caller asks {@link getCachedQuotaFor} instead.
 */
export declare function getCachedQuota(): KimiCodeAccountQuota | null;
/**
 * The cached snapshot only when it belongs to this account.
 *
 * Passing no account keeps the pre-pool behavior of returning whatever was
 * fetched last. Passing one answers that account's own newest snapshot, or null
 * when this line has never read it — null is "never read", which is a different
 * statement from a snapshot whose windows are all at zero.
 */
export declare function getCachedQuotaFor(accountId?: string | null): KimiCodeAccountQuota | null;
/**
 * The newest snapshot held for one account, for display only.
 *
 * The pool asks here while it builds the account list for the settings card, so
 * this is a pure memory read: it never fetches.
 */
export declare function cachedQuotaFor(accountId: string): KimiCodeAccountQuota | null;
export declare function clearCachedQuota(): void;
/**
 * Read the windowed quota block.
 *
 * The service's own shape nests one entry per window under `usages`; a
 * community-documented alternative reports a top-level `usage` plus a
 * `limits[]` array. Both are read so a service-side change of shape does not
 * silently blank the card, and an unrecognized payload yields no windows rather
 * than a fabricated 0%.
 */
export declare function parseUsageWindows(payload: unknown): KimiCodeUsageWindow[];
/**
 * Convert the fixed-point money field the service uses into cents.
 *
 * Amounts arrive as 1e-6 cents; a positive amount that would round to zero is
 * reported as one cent, because "you have something left" is closer to the
 * truth than "you have nothing".
 */
export declare function fixedPointToCents(value: unknown): number | null;
/**
 * Read the booster wallet (the pay-as-you-go top-up pool).
 *
 * The wallet only counts when its balance is a real booster balance; anything
 * else is reported as absent so the card does not advertise credit the account
 * cannot spend.
 */
export declare function parseExtraUsage(payload: unknown): KimiCodeExtraUsage | null;
/** Human name for one machine level code, or the code itself when unknown. */
export declare function membershipLevelName(level: string | null | undefined): string | null;
/**
 * Subscription tier the payload names, from any documented shape.
 *
 * Prefers the display name when the service still sends one, then the machine
 * level (mapped to its marketing name), so a payload that dropped
 * `user_level_name` still yields a readable tier instead of a raw enum.
 */
export declare function parsePlanName(payload: unknown): string | null;
/** Machine tier level when the service reports one. */
export declare function parsePlanLevel(payload: unknown): string | null;
/**
 * Turn a `/me` payload into the public account DTO.
 *
 * The endpoint answers with snake_case fields while the card consumes
 * camelCase, and either profile source may be the one that answered, so both
 * spellings are accepted.
 */
export declare function parseUserInfo(payload: unknown, fallback?: Partial<KimiCodeAccount>): KimiCodeAccount;
export interface QuotaFetchOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** Bypass the local cache and read the service again. */
    force?: boolean;
    /**
     * Credentials to read usage for.
     *
     * A pool supplies the active account's credential here; without it the single
     * stored account is refreshed and used.
     */
    credentials?: KimiCodeCredentials;
    /**
     * Account the snapshot belongs to.
     *
     * With a pool the card must never render one account's quota under another
     * account's name, so each account keeps its own cache entry, keyed by this id.
     * Omitted, the reading is filed under the single-credential slot.
     */
    accountId?: string;
    /**
     * Refresh this credential and hand back the replacement, or undefined when
     * the caller has no way to renew it.
     *
     * A usage call that answers 401 is the only signal that an access token
     * stopped being accepted; rotation bookkeeping cannot see it, because the
     * token still looks unexpired locally. The caller that owns the credential —
     * the pool — supplies the write-back here, so the one retry happens where the
     * rotated refresh token can actually be persisted.
     */
    renewFn?: (credentials: KimiCodeCredentials) => Promise<KimiCodeCredentials | undefined>;
}
/**
 * Fetch and cache the account's quota snapshot.
 *
 * A 401 is surfaced as a rejection so the caller can invalidate the stored
 * credential; every other failure leaves the previous snapshot in place rather
 * than blanking the card, because a transient outage says nothing about the
 * account's real usage.
 */
export declare function fetchAccountQuota(store: FileCredentialStore, options?: QuotaFetchOptions): Promise<KimiCodeAccountQuota | null>;
/**
 * Build the account view for one credential.
 *
 * There is no account-profile endpoint on the coding API: the signed-in
 * identity lives in the token's own claims, so the account is assembled from
 * the stored credential (which the login and every refresh keep populated) and
 * enriched by whatever the usage payload reports about the tier.
 */
export declare function accountFromCredentials(credentials: KimiCodeCredentials, payload?: unknown, profile?: unknown): KimiCodeAccount;
/**
 * Read the plan profile from `/me`.
 *
 * The endpoint exists and is the only remaining source of the plan's display
 * name: `/usages` used to carry `user_level_name` and stopped. It is called
 * with the OAuth access token only (never a pasted plan key) and is treated as
 * enrichment — a failure returns null so the card still renders the identity it
 * already has from the token.
 */
export declare function fetchProfile(store: FileCredentialStore, options?: QuotaFetchOptions): Promise<unknown | null>;
/**
 * Read the account identity for a stored credential.
 *
 * Combines the token's own claims (the identity) with `/me` (the plan name) and
 * persists what it learns, so a later call needs no network work. It never
 * throws for a missing profile: the identity is derived locally.
 */
export declare function fetchUserInfo(store: FileCredentialStore, options?: QuotaFetchOptions): Promise<KimiCodeAccount | null>;
/**
 * Prove the stored credential still authenticates, and report how long that took.
 *
 * The probe is the real usage call rather than a profile lookup, because there
 * is no profile endpoint: a 200 from `/usages` is what shows the token is
 * accepted, and it doubles as a quota refresh for the card.
 */
export declare function testConnection(store: FileCredentialStore, options?: QuotaFetchOptions): Promise<{
    account: KimiCodeAccount | null;
    latencyMs: number;
}>;
export { PROVIDER_NAME };
//# sourceMappingURL=client.d.ts.map