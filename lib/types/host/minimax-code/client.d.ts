/**
 * HTTP surface of the MiniMax Code subscription.
 *
 * ONE header rule governs this whole file, and it is the one the brief calls out as
 * a hard constraint: credentials are sent as `authorization: Bearer <accessToken>`.
 * The endpoint also speaks the Anthropic wire format, whose client normally
 * authenticates with `x-api-key`, and that difference was measured directly — an
 * `x-api-key` request answers 401 `{"code":401,"message":"token is required"}`
 * while the bearer form answers 200. There is deliberately no fallback that tries
 * `x-api-key` after a 401: the measured verdict is that it cannot succeed, and a
 * retry would only add a request to the subscription's bill.
 *
 * The second rule is an absence: this file has no `/v1/models` call and must never
 * grow one. That route is not configured for subscription traffic and answers 503
 * `{"errorCode":50115,"errorReason":"direct_route_not_configured"}`; the model
 * directory is hardcoded in ./model-catalog.ts instead.
 */
import { DEFAULT_DEVICE_INTERVAL_SECONDS, MESSAGES_PATH, agentBaseUrl, MINIMAX_CODE_BUILD_ENV, redactToken } from './types.ts';
import { MinimaxCodeCredentialStore, type MinimaxCodeCredentials } from './token-store.ts';
import { MinimaxCodeUnauthorizedError } from './oauth.ts';
import type { MinimaxCodeAccount, MinimaxCodeQuota, MinimaxCodeRegion } from '../../shared/minimax-code-contracts.ts';
/**
 * Headers for one Messages request.
 *
 * `authorization: Bearer` is REQUIRED and is the only credential field sent —
 * see this file's header comment for the measured reason an `x-api-key` variant
 * must not exist.
 *
 * The token itself never appears in a log line or an error: callers that need to
 * name a credential do so through `redactToken`.
 */
export declare function modelRequestHeaders(accessToken: string): Record<string, string>;
/** Headers for a non-streaming call (the probe). */
export declare function probeRequestHeaders(accessToken: string): Record<string, string>;
/** One parsed Anthropic `usage` object. */
export interface MinimaxUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
}
/** Read the four token counters the Messages response reports. */
export declare function parseAnthropicUsage(payload: unknown): MinimaxUsage | null;
/** Short, single-line excerpt of one error body, safe to show a user. */
export declare function summarizeFailureBody(raw: string): string;
export interface MinimaxProbeResult {
    ok: boolean;
    /** Model the probe used, when it reached the service. */
    model?: string;
    /** Failure sentence, already safe to render. */
    error?: string;
    latencyMs: number;
    account?: MinimaxCodeAccount | null;
    usage?: MinimaxUsage;
}
/**
 * Model the connection probe uses.
 *
 * M3 is the model the measured request used, so a probe against it exercises the
 * exact shape the reconnaissance attested rather than a preview id that may not be
 * entitled on every account.
 */
export declare const PROBE_MODEL = "MiniMax-M3";
/**
 * Prove the stored credential still authenticates.
 *
 * The probe is the real Messages endpoint, because that is the only surface the
 * subscription exposes to a third-party client: there is no account-profile route
 * and `/v1/models` is unavailable, so a 200 from `/messages` is what "signed in"
 * means here. The request is deliberately tiny — one word, 16 output tokens — so a
 * probe the user triggered by pressing a button costs almost nothing.
 */
export declare function testConnection(store: MinimaxCodeCredentialStore, options?: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
}): Promise<MinimaxProbeResult>;
/**
 * Non-streaming Messages call, used by callers that want the body rather than a stream.
 *
 * It exists so the streaming path is not the only implementation of the request
 * shape: the probe and any future test use the same headers and URL builder, which
 * is what keeps the Bearer rule from drifting in a second place.
 */
export declare function createMessage(store: MinimaxCodeCredentialStore, request: {
    model: string;
    maxTokens: number;
    prompt: string;
}, options?: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
}): Promise<{
    ok: boolean;
    status: number;
    payload?: unknown;
    error?: string;
    latencyMs: number;
}>;
/**
 * Headers for the Token Plan usage read.
 *
 * NOT {@link modelRequestHeaders}: that set asks for `text/event-stream` because
 * the Messages route streams, and this route answers one JSON document. The
 * credential is still the same bearer token.
 */
export declare function quotaRequestHeaders(accessToken: string, pathWithSearch: string, requestTime?: number): Record<string, string>;
/**
 * The host that last answered.
 *
 * Only a live call can settle which candidate serves this subscription, so the
 * winner is remembered and probed first from then on.
 */
/**
 * Why a usage snapshot is absent, when the reason is worth stating on the card.
 *
 * - `credential-not-accepted` — the endpoint answered, and refused THIS line's
 *   credential because it needs a platform API key. Measured: every candidate
 *   host answers HTTP 200 with `base_resp.status_code: 1004` for an
 *   `mcode-public` (MiniMax Code) token, under every auth shape tried.
 * - `unreachable` — no candidate host produced a usable answer at all.
 * - `token-expired` — every candidate refused the bearer with 401/403, and the
 *   one refresh that follows also failed.
 *
 * `token-expired` exists because a refusal and an outage are different facts for
 * the person looking at the card: an outage means "try again in a minute", while a
 * refused bearer means the access token aged out. Collapsing the two into
 * `unreachable` is what made a perfectly healthy account read as signed-out.
 * - `stale` - the newest read failed, but the card is still being served the last
 *   numbers that parsed. The value is real; only its age is not.
 */
export type MinimaxCodeQuotaUnavailable = 'credential-not-accepted' | 'unreachable' | 'token-expired' | 'stale';
/** Forget the cached usage snapshot (a sign-out, a sign-in, a test). */
export declare function clearCachedQuota(): void;
/** The last usage snapshot without touching the network. */
export declare function getCachedQuota(): MinimaxCodeQuota | null;
/**
 * The cached snapshot only when it belongs to this account, without touching the
 * network.
 *
 * Quota follows the account: a rotation decides whose credential is spent next,
 * so the snapshot a read produced describes the row it was made for. The pool
 * asks here while it builds the settings card's account list, which must never
 * wait on — or trigger — an upstream read.
 *
 * An absent, empty or null id keeps the pre-pool behaviour and answers with the
 * newest read, which is what the page-level block wants.
 */
export declare function getCachedQuotaFor(accountId?: string | null): MinimaxCodeQuota | null;
/** Why the last read produced no snapshot, or null when it produced one. */
export declare function getQuotaUnavailable(): MinimaxCodeQuotaUnavailable | null;
/**
 * Resolve the ambiguous `*_usage_count` fields.
 *
 * TRANSCRIBED from the official CLI (`src/utils/quota.ts`), because the ambiguity
 * is real and reading the field naively inverts the bar: older responses report
 * it as a REMAINING count while newer ones report it as a CONSUMED count. When the
 * server also returns an explicit remaining percentage, that percentage selects
 * whichever reading agrees with it; when the counts agree with neither, this
 * returns undefined and the window falls back to the percentage alone rather than
 * inventing a number.
 */
export declare function resolveQuotaCounts(reportedCount: number, total: number, remainingPercent: number | undefined): {
    used: number;
    remaining: number;
    total: number;
} | undefined;
/**
 * Map one `/v1/token_plan/remains` document onto the card's quota shape.
 *
 * Returns null when nothing usable is present, which the contract defines as the
 * card's graceful degradation.
 */
export declare function parseTokenPlanQuota(payload: unknown, now?: number): MinimaxCodeQuota | null;
/**
 * Read the Token Plan usage snapshot.
 *
 * The endpoint is undocumented (it was found in the official CLI, not in MiniMax's
 * API docs), and which host serves THIS subscription has never been measured, so
 * the candidates are tried in order and the winner is remembered. Any failure
 * yields null: the contract makes `quota` optional precisely so a usage read can
 * never break the connection half of the card.
 */
export declare function fetchTokenPlanQuota(credentials: MinimaxCodeCredentials, options?: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    force?: boolean;
    /**
     * The pooled account this read is made for.
     *
     * The credential cannot identify the account: both tokens rotate, and two
     * rows may share a region. The caller names none of that itself — it asks the
     * pool for the account that would serve the next request, so the row it
     * asked for is the row these numbers describe, and the snapshot is
     * remembered against that id rather than against the line.
     */
    accountId?: string;
    /**
     * Renew the credential and hand back the pair to retry with.
     *
     * Injected by the route, which owns the store: this module reads credentials,
     * it does not write them. Returns null when the credential cannot be renewed,
     * and callers treat that as "still expired" rather than "signed out".
     */
    renewCredential?: () => Promise<MinimaxCodeCredentials | null>;
    /**
     * Whether the credential this read presented has already been replaced.
     *
     * Set by the caller, which can see the credential in force. A 401 that arrives
     * for a token that is no longer current is not a verdict on the account, and
     * reporting it as `token-expired` would put "sign in again" on a card whose
     * sign-in is in perfect health.
     */
    isCredentialStale?: () => Promise<boolean>;
}): Promise<MinimaxCodeQuota | null>;
/**
 * Every model id the hardcoded directory offers.
 *
 * Exposed as a function rather than re-exported directly so the status route
 * cannot accidentally treat the catalog as live data: it is shipped, not fetched.
 */
export declare function listModelIds(): string[];
/** The catalog entry count, for a status line that reports what is shipped. */
export declare function catalogSize(): number;
/**
 * Whether a credential is worth reporting as signed in.
 *
 * A stored-but-expired credential still counts: the card's job is to show who is
 * signed in and let the refresh path repair the token, not to hide an account whose
 * access token happens to have aged out between two calls.
 */
export declare function describeCredentials(credentials: MinimaxCodeCredentials | null): MinimaxCodeAccount | null;
export { MinimaxCodeUnauthorizedError, agentBaseUrl, MESSAGES_PATH, DEFAULT_DEVICE_INTERVAL_SECONDS, MINIMAX_CODE_BUILD_ENV, redactToken };
export type { MinimaxCodeRegion };
//# sourceMappingURL=client.d.ts.map