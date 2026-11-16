import type { WorkBuddyAccount, WorkBuddyAccountQuota, WorkBuddyMeter } from '../../shared/workbuddy-contracts.ts';
import { type WorkBuddyOutboundProduct } from './outbound-identity.ts';
import { PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, type WorkBuddyCredentials } from './token-store.ts';
import type { WorkBuddyTokenIdentity } from './identity.ts';
import { type WorkBuddyModelEntry } from './model-catalog.ts';
export interface WorkBuddyRequestOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
}
/**
 * Which chat surface a call is, for the headers only that surface needs.
 *
 * Passing this opts the request into the conversation header group. It is
 * deliberately a separate argument rather than a consequence of `sessionId`
 * being present: the group belongs to the chat endpoint's channel check, and
 * the config, billing, refresh and check-in surfaces keep the exact header set
 * they already worked with.
 */
export interface WorkBuddyChannelOptions {
    /**
     * Which client identity this request presents.
     *
     * Omitted means the line's shipped identity (`cli`). Only the chat call ever
     * sets it: the config, billing and refresh surfaces are the ones measured to
     * accept the CLI identity, and the choice exists for the chat fingerprint.
     */
    product?: WorkBuddyOutboundProduct;
    /**
     * Harness session the chat call belongs to.
     *
     * Omit it for a call with no conversation behind it (the connection-test
     * probe). The group is still sent — the gateway requires it either way — but
     * the scoped ids fall back to random values.
     */
    sessionId?: string;
}
/**
 * Attribution and identity headers for one backend request.
 *
 * The gateway gates on this header set: the international deployment answers
 * 401 without the CLI user agent and matching `Origin`/`Referer`, and both
 * deployments read the account identity headers rather than deriving it from
 * the bearer token alone.
 *
 * `channel` marks a request to the chat endpoint, which is the only surface
 * whose channel check wants the {@link conversationHeaders} group.
 */
export declare function workBuddyHeaders(credentials: Pick<WorkBuddyCredentials, 'accessToken' | 'domain' | 'uid' | 'enterpriseId' | 'backend'>, extra?: Record<string, string>, channel?: WorkBuddyChannelOptions): Record<string, string>;
/**
 * Refresh an access token against the endpoint the official IDE uses.
 *
 * The response carries a whole new `auth` block rather than just a token, so it
 * is merged over the current one: fields the endpoint omits (the domain, the
 * refresh lifetime) must survive, or the next refresh would lose its target.
 */
export declare function refreshCredentials(credentials: WorkBuddyCredentials, options?: WorkBuddyRequestOptions): Promise<WorkBuddyCredentials>;
/** Public account facts for the settings card. */
export declare function accountFromCredentials(credentials: WorkBuddyCredentials): WorkBuddyAccount;
/**
 * Read the signed-in account for a credential.
 *
 * The browser-authorization token response states the access token and the
 * refresh token but **not** which account they belong to, so a login that
 * relied on it alone could only key the account by the display name it also
 * did not have — which is where the duplicate row and the `账号 1` label came
 * from. The official client reads the account from this same endpoint right
 * after polling the token; measured live, it returns the uid, the nickname,
 * the UIN and the enterprise id for a valid bearer.
 *
 * A failure is not fatal to the sign-in: the token is usable, so the caller
 * keeps the credential it has and lets the token's own claims fill in what
 * they can.
 */
export declare function fetchAccountIdentity(credentials: WorkBuddyCredentials, options?: WorkBuddyRequestOptions): Promise<WorkBuddyTokenIdentity | null>;
/**
 * Parse one `/v3/config` payload's model list.
 *
 * Each entry carries the facts this route needs directly, so nothing is
 * inferred from the model's name. Image-generation tools (`tags` naming
 * `text-to-image`/`image-to-image`) are skipped: they are not chat models and
 * carry no context window.
 *
 * `credits` is read here rather than left to the shipped table because a
 * reachable gateway **replaces** that table entirely: a multiplier transcribed
 * offline would be the only one a signed-in user ever saw, and it would stay
 * wrong the moment the subscription repriced a model. A string this route cannot
 * turn into a number (`''`, which `default-model` publishes, or a value a
 * future gateway invents) leaves the field off the entry altogether instead of
 * writing a plausible-looking `0` — see `parseWorkBuddyCreditMultiplier`.
 */
export declare function parseConfigModels(payload: unknown, region: WorkBuddyCredentials['region']): WorkBuddyModelEntry[];
export declare function getCachedCatalog(): WorkBuddyModelEntry[];
export declare function clearCachedCatalog(): void;
/**
 * Fetch the live catalog for one account.
 *
 * The gateway is the authority on capabilities, so a successful read replaces
 * the shipped table entirely; a failure returns an empty list and the caller
 * falls back, which keeps a first run usable before sign-in.
 */
export declare function fetchConfigCatalog(credentials: WorkBuddyCredentials, options?: WorkBuddyRequestOptions): Promise<WorkBuddyModelEntry[]>;
/** Cached catalog with a TTL; a failed refresh keeps the previous snapshot.
 *
 * On the first cache miss of a process the persisted snapshot is rehydrated
 * first, so a restart serves the previous listing without waiting on the
 * network. An expired snapshot still answers immediately (stale) while a
 * refresh runs in the background — the catalog is not fast-moving data, and
 * waiting on an unreachable gateway turned a restart into the full discovery
 * timeout on every model resolution.
 */
export declare function loadConfigCatalog(credentials: WorkBuddyCredentials, options?: WorkBuddyRequestOptions & {
    force?: boolean;
}): Promise<WorkBuddyModelEntry[]>;
/** Parse one `Capacity*` account record into the public quota shape. */
export interface ParsedBilling {
    packageName: string | null;
    totalCredits: number | null;
    remainingCredits: number | null;
    cycleUsedCredits: number | null;
    cycleCredits: number | null;
    cycleStartsAt: number | null;
    cycleEndsAt: number | null;
}
/**
 * Parse the billing payload's account list.
 *
 * The response nests as `data.Response.Data.Accounts[]`; each entry describes
 * one purchased package with its own capacity counters. The first entry is the
 * active subscription, and the totals are summed across all of them because a
 * user can hold several packages at once.
 */
export declare function parseBilling(payload: unknown): ParsedBilling;
/**
 * Parse a cycle boundary.
 *
 * The service sends these as local-time strings without a zone
 * (`2026-09-01 00:00:00`), which `Date.parse` reads as local time — the same
 * reading the IDE's own panel uses, so the card agrees with it.
 */
export declare function parseCycleTime(value: unknown): number | null;
/** Turn a parsed billing snapshot into the meters the card renders. */
export declare function billingMeters(billing: ParsedBilling): WorkBuddyMeter[];
/**
 * The snapshot read most recently, whichever account it belongs to.
 *
 * Kept with a no-argument signature for backward compatibility; the page-level
 * facts use {@link getCachedQuotaFor} instead, because they describe one
 * account and must never be another account's numbers.
 */
export declare function getCachedQuota(): WorkBuddyAccountQuota | undefined;
/**
 * The snapshot remembered for one account, if it was read before.
 *
 * This is the lookup the account pool calls while it builds its summaries: a
 * pure memory read, never a fetch. Passing no account keeps the pre-pool
 * behavior of returning whatever was fetched last.
 */
export declare function getCachedQuotaFor(accountId?: string | null): WorkBuddyAccountQuota | undefined;
export declare function clearCachedQuota(): void;
/**
 * Read the account's credit allowance.
 *
 * Only one billing route exists here, so a failure is a real failure rather
 * than a partially-answered snapshot: the caller decides whether to surface it.
 */
export declare function fetchAccountQuota(store?: FileCredentialStore, fetchFn?: typeof fetch, force?: boolean, accountId?: string | null, hiddenAccountIds?: readonly string[]): Promise<WorkBuddyAccountQuota>;
export { PROVIDER_ID, PROVIDER_NAME };
//# sourceMappingURL=client.d.ts.map