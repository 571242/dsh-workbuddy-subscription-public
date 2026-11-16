/**
 * Upstream HTTP surface of the Claude subscription line.
 *
 * WHAT THIS MODULE IS. Everything between "we hold a subscription OAuth
 * credential" and "a response came back": the request headers, the model
 * listing, the two independent sources of quota numbers, a one-shot
 * connectivity probe, and the classification of a failure. It owns no
 * credential lifecycle — refreshing is `oauth.ts`'s job, storage is
 * `token-store.ts`'s — so every entry point here takes an ALREADY-CURRENT
 * access token and never writes one back.
 *
 * Each behavioural claim below names the evidence behind it. Where the evidence
 * is a reading of the locally installed reference implementation it says so;
 * where it is this module's own judgement it says that instead, because a later
 * reviewer has to be able to tell the two apart. Nothing here asserts what an
 * endpoint returns without a fixture or a live read behind it.
 *
 * ---------------------------------------------------------------------------
 * 1. THE HEADERS, AND WHY `x-api-key` MUST NOT BE THERE
 * ---------------------------------------------------------------------------
 *
 * The subscription is not the Console API. The Console authenticates with
 * `x-api-key`; the subscription authenticates with an OAuth access token in
 * `Authorization: Bearer`. Sending BOTH is a documented 401 cause — the gateway
 * sees an API-key-shaped credential on a route that does not serve API keys and
 * refuses the request. So the builder below emits `authorization` and actively
 * removes any `x-api-key` that a caller's `extra` map tried to smuggle in:
 * a caller copying another provider's header map is exactly how that bug would
 * re-enter this codebase, and a silent 401 is a bad way to find out.
 *
 * The `user-agent` is load-bearing rather than cosmetic. Upstream enforces a
 * MINIMUM REPORTED CLIENT VERSION on this path: when the model being asked for
 * is newer than the version we claim to be, the request is refused with HTTP 400
 * and the body code `claude_code_version_too_old`
 * ({@link ERROR_CODE_CLIENT_VERSION_TOO_OLD}). The version therefore comes from
 * {@link claudeCliVersion} at CALL TIME rather than from a module constant, so a
 * `setClaudeCliVersion` pin or a `DSH_CLAUDE_CLI_VERSION` in the environment
 * takes effect on the very next request without a restart.
 *
 * `anthropic-beta` is cumulative: one request carries every marker that
 * applies. Three sources contribute, and only one of them is conditional on the
 * model — the reference's own rule is that a HAIKU model does NOT receive
 * `claude-code-20250219` while every other model does. The only offline signal
 * for that is the family token in the id itself.
 *
 * ---------------------------------------------------------------------------
 * 2. THE MODEL LISTING OVERRIDES THE CONTEXT WINDOW AND NOTHING ELSE
 * ---------------------------------------------------------------------------
 *
 * This is the invariant most worth protecting in this file. `GET /v1/models`
 * states which ids the ACCOUNT can call and how much context each one takes; it
 * says nothing about image support, about which thinking form a model needs, or
 * about the reasoning ladder it exposes. Those are per-model facts that
 * `model-catalog.ts` carries and that the family name does not decide — a
 * listing-driven merge that wrote capability fields would silently replace them
 * with `undefined` and produce requests the model rejects.
 *
 * So {@link loadCatalog} produces each entry as `{ ...catalogEntry,
 * contextWindow }`: ONE written field, everything else copied verbatim from the
 * frozen table (or from its conservative stub, for an id the table does not
 * know). A test asserts that a listing cannot change any other field.
 *
 * The failure path matters as much as the success path. DSH 0.1.7 makes "the
 * model must appear in the provider's catalog" a HARD GATE, so returning an
 * empty list when the listing call fails would not degrade the picker — it would
 * block model switching entirely, and it would do so while the account is
 * perfectly usable. Every failure therefore yields {@link FALLBACK_MODELS}.
 * An empty-but-successful listing is treated the same way, for the same reason.
 *
 * ---------------------------------------------------------------------------
 * 3. TWO QUOTA SOURCES IN TWO DIFFERENT UNITS — THE BUG THIS FILE EXISTS TO STOP
 * ---------------------------------------------------------------------------
 *
 * (a) PRIMARY, `GET /api/oauth/usage`. Each window is
 *     `{ utilization, resets_at }` and `utilization` is a PERCENT USED in
 *     0-100. `utilization: 0` means nothing has been used — the ordinary state
 *     of a healthy account — and is NOT an error and NOT "no quota left".
 *
 * (b) SECONDARY, the `anthropic-ratelimit-unified-*` response headers on ANY
 *     `/v1/messages` response including 200s.
 *     `...-5h-utilization` is a FRACTION in 0-1. Same word, different unit:
 *     `0.25` here and `25` there both mean "a quarter of the window is gone".
 *     `...-5h-reset` is epoch SECONDS — not milliseconds, and not ISO — while
 *     `resets_at` in (a) IS ISO 8601. A parser that treats the two as one
 *     number under-reports by 100x or over-reports by 100x depending on which
 *     direction it guessed, and the card shows a confident wrong number either
 *     way.
 *
 * The conversion happens at exactly TWO boundaries and nowhere else: the
 * header parser multiplies by 100 once, on the way in, and the body parser
 * divides by 100 once, on the way in. After that both are the same
 * {@link ClaudeUsageWindow}, and a test asserts that `0.25` in a header and
 * `25` in a body produce byte-identical windows.
 *
 * Header data is allowed to satisfy the composer badge — the badge only needs
 * the tightest window — but it must NOT permanently replace a full read. The
 * cache therefore tracks two instants: when any source last wrote
 * (`observedAt`, gated by {@link QUOTA_CACHE_TTL_MS}) and when a FULL read last
 * succeeded (`fetchedAt`, gated by {@link QUOTA_FULL_REFRESH_MS}). Header
 * updates advance only the first, so a stream of model calls cannot keep the
 * card warm forever behind stale numbers.
 *
 * Unknown keys in the usage payload are IGNORED. The response's key set varies
 * by account type and carries churning feature-flag codenames; a key this
 * module does not know is not a window, and a missing known key is not zero.
 *
 * ---------------------------------------------------------------------------
 * 4. FAILURE CLASSIFICATION
 * ---------------------------------------------------------------------------
 *
 * Anthropic reports the real condition in the body's `error.type` while the
 * HTTP status stays coarse, so the body is authoritative and the status is the
 * fallback. The one distinction the rest of the line depends on is inside
 * `rate_limit_error`: a 429 that names a SPENT WINDOW OF THIS ACCOUNT is fixed
 * by switching accounts, and a 429 that does not is not — switching accounts on
 * a global limit would burn every account in the pool against a wall none of
 * them can pass. That distinction is exported as a first-class value rather
 * than left for the caller to re-derive from headers.
 */
import { type ClaudeCacheTtl, type ClaudeErrorType } from './types.ts';
import { type ClaudeModelEntry } from './model-catalog.ts';
import type { ClaudeCredentials } from './token-store.ts';
/** A flat, lower-cased header map, ready for `fetch`. */
export type ClaudeRequestHeaders = Record<string, string>;
/**
 * Which product string a request reports as.
 *
 * `cli` is the Messages-API identity: `claude-cli/<v> (external, cli)`. The
 * subscription usage endpoint is a different surface and the reference reports
 * a different product there — `claude-code/<v>` — so the choice is a parameter
 * rather than a constant. Reporting the wrong one is not fatal on the usage
 * route, but it is also not free: the route is behind the same gateway that
 * enforces the reported-version floor.
 */
export type ClaudeUserAgentKind = 'cli' | 'code';
/** Options for {@link buildClaudeHeaders}. */
export interface ClaudeHeaderOptions {
    /**
     * Exact model id this request targets.
     *
     * The one header consequence is the `claude-code-20250219` beta: the
     * reference's rule is that a haiku model does not receive it. Omit it for a
     * request that names no model (the usage read), which keeps the beta.
     */
    model?: string;
    /** Whether this request enables thinking; adds the interleaved-thinking beta. */
    thinking?: boolean;
    /**
     * Whether this request's body carries `thinking.block_binding`; adds the beta
     * that licenses the field. Without it the body is a 400 on every request.
     */
    thinkingBinding?: boolean;
    /**
     * Prompt-cache tier this request's body writes. `1h` adds the beta that
     * licenses it, so the header and the body cannot disagree.
     */
    cacheTtl?: ClaudeCacheTtl;
    /** HTTP method. `content-type` is emitted unless this is a GET. */
    method?: 'GET' | 'POST' | string;
    /** Which product identity to report. Defaults to the Messages-API one. */
    userAgent?: ClaudeUserAgentKind;
    /** Extra headers. `x-api-key` is stripped from the result regardless. */
    extra?: Record<string, string>;
}
/**
 * The `anthropic-beta` set for one request, in a stable order.
 *
 * Order is not observable — the server parses the header as a set — so the order
 * below is chosen for readability in a log rather than to match a reference.
 */
export declare function claudeBetas(options?: Pick<ClaudeHeaderOptions, 'model' | 'thinking' | 'thinkingBinding' | 'cacheTtl'>): string[];
/** The `User-Agent` value this line reports for one surface. */
export declare function claudeUserAgent(kind?: ClaudeUserAgentKind): string;
/**
 * Build the headers for one subscription request.
 *
 * The single builder for every surface this module touches — the Messages API,
 * the model listing, the usage read, and the probe. `extra` is how a caller
 * adds a header this module does not own (a streaming `accept`, an
 * `anthropic-beta` the adapter negotiated) without a second builder drifting
 * away from this one.
 *
 * @param accessToken - a CURRENT OAuth access token. This function does not
 *   check expiry; the caller owns refresh.
 */
export declare function buildClaudeHeaders(accessToken: string, options?: ClaudeHeaderOptions): ClaudeRequestHeaders;
/** Drop the cached listing, forcing the next load to hit the network. */
export declare function clearCachedCatalog(): void;
/** The listing currently held, or an empty array before the first load. */
export declare function getCachedCatalog(): readonly ClaudeModelEntry[];
/** Whether the held listing is the shipped table standing in for a failed call. */
export declare function isCatalogFallback(): boolean;
/** One listing entry, reduced to the two fields this line reads from it. */
interface ListingEntry {
    id: string;
    /** The window the listing stated, or null when it stated none. */
    contextWindow: number | null;
}
/**
 * Fold the live listing onto the frozen capability table.
 *
 * `contextWindow` is the ONLY field the listing may write. Everything else is
 * copied from `resolveClaudeModel`, which returns the catalog entry for a known
 * id and its conservative stub for an unknown one — so an id this line has never
 * heard of keeps the stub's "no images, no thinking form, 200K window" answer
 * instead of inheriting invented capabilities from the listing.
 *
 * The catalog is NOT widened by the listing: the returned array contains exactly
 * the ids the server named, because the listing is the authority on what this
 * account may call. (The fallback path is what keeps a failed call from
 * narrowing it to nothing.)
 */
export declare function mergeListingIntoCatalog(listing: readonly ListingEntry[]): ClaudeModelEntry[];
/** Options for {@link loadCatalog}. */
export interface CatalogLoadOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** Bypass the cached listing and read the server again. */
    force?: boolean;
}
/**
 * Read the models the signed-in account can call.
 *
 * Cached for {@link CATALOG_CACHE_TTL_MS} and single-flighted per credential,
 * because the harness resolves EVERY model of EVERY provider when it builds the
 * picker — without both, one picker build is one network round trip per model.
 *
 * A failure is cached too, deliberately. The fallback table is the full shipped
 * snapshot, so serving it for the cache window costs the user nothing but a
 * slightly wider picker, while NOT caching the failure would put a dead
 * endpoint behind fourteen sequential 20-second timeouts on every picker build.
 * {@link clearCachedCatalog} is the escape hatch: the sign-in path calls it so a
 * user who just authenticated does not sit behind a failure recorded before
 * they did.
 *
 * @param credentials - a current subscription credential; it selects the cache
 *   entry, since a different account can see a different listing.
 */
export declare function loadCatalog(credentials: ClaudeCredentials, options?: CatalogLoadOptions): Promise<readonly ClaudeModelEntry[]>;
/**
 * One account window, normalized.
 *
 * The three numeric fields are null TOGETHER, and null means "the source did
 * not say" — which is a different statement from 0, "nothing used". Collapsing
 * them would turn a payload that omitted a window into a confident zero.
 */
export interface ClaudeUsageWindow {
    /** Wire key: `five_hour`, `seven_day`, `seven_day_sonnet`. */
    id: string;
    /** Display label. */
    label: string;
    /** Nominal length of the window in minutes, or null when unknown. */
    windowMinutes: number | null;
    /** Fraction of the window consumed, 0-1. Percent divided by 100 at this boundary. */
    usedFraction: number | null;
    /** Percent of the window consumed, 0-100. */
    usedPercent: number | null;
    /** Percent of the window still available, 0-100. */
    remainingPercent: number | null;
    /** ISO 8601 instant the window resets, or null. */
    resetsAt: string | null;
    /** Which source these numbers came from. */
    source: 'usage' | 'headers';
}
/** The account's pay-as-you-go overage pool, as the usage payload states it. */
export interface ClaudeExtraUsage {
    isEnabled: boolean;
    monthlyLimit: number | null;
    usedCredits: number | null;
    /** Percent of the monthly limit consumed, 0-100 — same unit as the windows. */
    utilization: number | null;
}
/** The whole quota snapshot the settings card and the composer badge read. */
export interface ClaudeAccountQuota {
    windows: ClaudeUsageWindow[];
    extraUsage: ClaudeExtraUsage | null;
    /**
     * Epoch ms of the last successful FULL usage read.
     *
     * Null when only response headers have ever been seen. This is the field that
     * decides whether the next read may be satisfied from headers alone.
     */
    fetchedAt: number | null;
    /** Epoch ms of the most recent update from any source. */
    observedAt: number;
    /** Unified rate-limit status the headers last reported, when they did. */
    status: string | null;
    /** Window the headers last named as representative, when they did. */
    representativeClaim: string | null;
}
/** The window with the least headroom, or null when no window states one. */
export declare function tightestQuotaWindow(windows: readonly ClaudeUsageWindow[]): ClaudeUsageWindow | null;
/**
 * Read the usage payload's known keys, and only its known keys.
 *
 * The key set varies by account type and the payload also carries churning
 * feature-flag codenames; anything not named below is ignored, because reading
 * an unknown key as a window is how a wrong number gets on the card. A known
 * key that is `null` (the documented state of `seven_day_sonnet`) yields no
 * window at all rather than a zeroed one.
 */
export declare function parseUsagePayload(payload: unknown): {
    windows: ClaudeUsageWindow[];
    extraUsage: ClaudeExtraUsage | null;
};
/** Prefix every unified rate-limit header shares. */
export declare const QUOTA_HEADER_PREFIX = "anthropic-ratelimit-unified-";
/**
 * Anything header-shaped.
 *
 * A `Headers` (what `fetch` returns) or a plain map (what a test or a
 * hand-built call site has). Both are read case-insensitively, because HTTP
 * header names are case-insensitive and a plain map from a caller often is not.
 */
export type ClaudeHeaderSource = Headers | Record<string, string | readonly string[] | undefined>;
/** Convert the headers' epoch-SECONDS reset instant to the ISO form the card uses. */
export declare function epochSecondsToIso(value: number | undefined): string | null;
/** One window as the unified response headers state it. */
export interface ClaudeHeaderQuotaWindow {
    id: string;
    label: string;
    windowMinutes: number | null;
    /** The header's own unit: a FRACTION, 0-1. */
    usedFraction: number;
    /** The same number as a percent, 0-100. Derived here and nowhere else. */
    usedPercent: number;
    remainingPercent: number;
    /** ISO 8601, converted from the header's epoch SECONDS. */
    resetsAt: string | null;
    /** Always `headers`: what this window is made of, for the merged DTO. */
    source: 'headers';
}
/** Everything the unified rate-limit headers said about one response. */
export interface ClaudeQuotaHeaderReading {
    windows: ClaudeHeaderQuotaWindow[];
    /** `anthropic-ratelimit-unified-status` — e.g. a rejected/allowed verdict. */
    status: string | null;
    /** `anthropic-ratelimit-unified-representative-claim` — the window that speaks for the response. */
    representativeClaim: string | null;
    /** The overage headers, when the response carried any. */
    overage: {
        status: string | null;
        utilization: number | null;
    } | null;
}
/**
 * Read the unified rate-limit headers off any response.
 *
 * THIS is the boundary where the header FRACTION becomes a fraction in the
 * normalized DTO — it is never divided or multiplied again downstream. The
 * sibling `resets_at` field in the usage payload is ISO while the header reset
 * is epoch seconds; both land on the DTO as ISO.
 */
export declare function parseQuotaHeaders(headers: ClaudeHeaderSource): ClaudeQuotaHeaderReading;
/** Drop every cached snapshot. Called on sign-out and after a credential change. */
export declare function clearCachedQuota(): void;
/**
 * The cached snapshot, optionally only when it belongs to this credential.
 *
 * With one stored account the argument is unnecessary; it exists so a later
 * pool chunk cannot render one account's usage under another account's name.
 * Given a credential the answer is THAT account's own newest snapshot, which is
 * what keeps two pooled accounts apart: a later read of a different account
 * cannot displace it. Without one the pre-pool answer is kept — whatever was
 * written last — because the single-account card has no identity to ask with.
 */
export declare function getCachedQuota(credentials?: Pick<ClaudeCredentials, 'accessToken'>): ClaudeAccountQuota | null;
/**
 * The newest snapshot held for one credential's account, for display only.
 *
 * The token-tail form, kept for a composition with a single stored credential.
 * A pooled caller asks {@link cachedQuotaForPool} with the row id instead: a
 * token is rotated by every refresh, so an entry filed under a tail is lost the
 * moment the account renews.
 */
export declare function cachedQuotaFor(credentials: Pick<ClaudeCredentials, 'accessToken'>): ClaudeAccountQuota | null;
/**
 * The newest snapshot held for one pool row, for display only.
 *
 * The pool asks here while it builds the account list for the settings card, so
 * this is a pure memory read: it never fetches. Null means nothing was ever read
 * for this account, which is a different statement from "nothing used". A row id
 * that is undefined falls back to the credential's own tail, which is what a
 * composition without a pool has.
 */
export declare function cachedQuotaForPool(accountId: string | undefined, credentials: Pick<ClaudeCredentials, 'accessToken'>): ClaudeAccountQuota | null;
/** Options for {@link fetchAccountQuota}. */
export interface QuotaFetchOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** Bypass the cache and read the usage endpoint now. */
    force?: boolean;
    /**
     * Pool row this read is made for, when a pool is in charge.
     *
     * The snapshot is then remembered against the row rather than against the
     * access token, so the row keeps its meters across the token rotations that
     * every refresh performs.
     */
    accountId?: string;
}
/**
 * Read the account's usage meters.
 *
 * Cached for {@link QUOTA_CACHE_TTL_MS} and single-flighted per credential. The
 * cache is served only while BOTH clocks are inside their windows: a snapshot
 * kept warm by response headers still triggers a full read once the last real
 * read is older than {@link QUOTA_FULL_REFRESH_MS}, which is what stops a busy
 * conversation from pinning the card to numbers that arrived as a side effect.
 *
 * A failure never blanks the card: an existing snapshot for the same credential
 * is returned instead, because a transient outage says nothing about the
 * account's real usage. The exception is a credential failure, which is always
 * surfaced — hiding a revoked credential behind stale numbers is how a user ends
 * up staring at a card that claims they are fine.
 */
export declare function fetchAccountQuota(credentials: ClaudeCredentials, options?: QuotaFetchOptions): Promise<ClaudeAccountQuota>;
/**
 * Fold the unified response headers of any response into the cached snapshot.
 *
 * Called on every `/v1/messages` response — including 200s, which is where the
 * numbers usually come from. It advances `observedAt` and NOT `fullReadAt`, so
 * header data can satisfy the composer badge while the card is still required to
 * perform a real read once the last one is older than
 * {@link QUOTA_FULL_REFRESH_MS}.
 *
 * @param headers - response headers of a model call.
 * @param accountKey - the account those headers belong to, as
 *   {@link accountKeyFor} derives it. Omitted, the reading is filed under
 *   whoever the newest snapshot already belongs to — the correct answer for the
 *   single-account case, and a reading whose account cannot be determined is
 *   filed under none rather than under the wrong one. When it is given and
 *   disagrees with that newest snapshot's account the reading is DISCARDED
 *   rather than merged: an unnamed reading merges into the snapshot it was read
 *   beside, so admitting one that is known to belong elsewhere is how two
 *   accounts' windows would end up in one entry.
 * @returns the updated snapshot, or null when the headers carried nothing usable.
 */
export declare function recordQuotaFromHeaders(headers: ClaudeHeaderSource, accountKey?: string): ClaudeAccountQuota | null;
/** A probe that reached the Messages API and was answered. */
export interface ClaudeProbeSuccess {
    ok: true;
    model: string;
    status: number;
    latencyMs: number;
    /** `stop_reason` of the one-token answer, when the body carried one. */
    stopReason: string | null;
}
/** A probe that did not succeed, with the reason rather than an exception. */
export interface ClaudeProbeFailure {
    ok: false;
    model: string;
    /** HTTP status, or 0 when no response arrived at all. */
    status: number;
    latencyMs: number;
    failure: ClaudeFailure;
}
export type ClaudeProbeResult = ClaudeProbeSuccess | ClaudeProbeFailure;
/** Options for {@link probeConnection}. */
export interface ProbeOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /**
     * Model to probe with.
     *
     * Defaults to the cheapest id in the shipped table. A probe is a connectivity
     * and credential check, and the widest-entitlement model answers it on every
     * plan; a caller that wants to prove a SPECIFIC model's entitlement passes it
     * here. Note that the default is a haiku id, so the probe exercises the header
     * set that omits the claude-code beta — pass the user's selected model to
     * probe the exact header set that model's real calls will use.
     */
    model?: string;
    /** Deadline for the probe. Defaults to the discovery ceiling. */
    timeoutMs?: number;
}
/** The model a probe uses when the caller names none. */
export declare const PROBE_DEFAULT_MODEL = "claude-haiku-4-5";
/**
 * Prove the credential works and measure how long the round trip took.
 *
 * One non-streaming POST with `max_tokens: 1` — the smallest request the
 * Messages API accepts, which keeps a probe from consuming anything meaningful
 * even when it is run from the settings card on every save.
 *
 * An upstream rejection is RETURNED, not thrown: the card's whole job here is to
 * render the reason, and a thrown error would have to be caught and unwrapped at
 * every call site to say the same thing.
 */
export declare function probeConnection(credentials: ClaudeCredentials, options?: ProbeOptions): Promise<ClaudeProbeResult>;
/**
 * What a caller should DO about a failure — the taxonomy, not the message.
 *
 * - `credential` — the stored credential is finished (401/403). Final: retrying
 *   cannot help, and the user has to sign in again.
 * - `request` — this request was wrong (400/404/413/422). Not retryable, and
 *   for this line often a client-version or parameter problem.
 * - `rate_limit_account` — a usage WINDOW OF THIS ACCOUNT is spent. Switching
 *   accounts is what fixes it.
 * - `rate_limit_global` — a limit that is not attributable to this account's
 *   window. Switching accounts would burn the pool against a wall.
 * - `overloaded` — transient capacity shortage. Retryable, not account-specific.
 * - `server` — a 5xx that is not an overload. Retryable.
 * - `network` — no response arrived at all. Retryable.
 */
export type ClaudeFailureKind = 'credential' | 'request' | 'rate_limit_account' | 'rate_limit_global' | 'overloaded' | 'server' | 'network';
/** A classified failure, in the shape the adapter and the settings card consume. */
export interface ClaudeFailure {
    kind: ClaudeFailureKind;
    /** Wire `error.type`, when the body named one this line recognizes. */
    type: ClaudeErrorType | null;
    /** HTTP status, or 0 for a transport failure. */
    status: number;
    /** Human-readable reason, from the body when it gave one. */
    message: string;
    /** Whether repeating the SAME request could succeed. */
    retryable: boolean;
    /**
     * Whether the failure is attributable to this ACCOUNT's own usage window.
     *
     * This is the field a pool switches accounts on. It is true only for
     * `rate_limit_account`.
     */
    accountScoped: boolean;
    /** Whether the body's code was the reported-client-version floor. */
    clientVersionTooOld: boolean;
    /** ISO 8601 reset instant, when the body or the headers named one. */
    resetsAt: string | null;
    /** `retry-after`, in milliseconds, when the response carried it. */
    retryAfterMs: number | null;
}
/** Error carrying a classified failure, for the paths that must signal instead of return. */
export declare class ClaudeRequestError extends Error {
    readonly failure: ClaudeFailure;
    constructor(failure: ClaudeFailure);
}
/** A transport failure: nothing came back, so there is no status and no body. */
export declare function networkFailure(error: unknown): ClaudeFailure;
/**
 * Classify one failed response.
 *
 * The body is authoritative and the status is the fallback, because Anthropic's
 * statuses are coarse: several unrelated conditions share a status while
 * `error.type` names the real one. Both paths are exercised by tests with real
 * response fixtures.
 *
 * @param status - HTTP status.
 * @param bodyText - the response body as text. A body this function cannot
 *   parse costs a more precise `type`, never a wrong classification.
 * @param headers - response headers, read for the unified rate-limit verdict and
 *   for `retry-after`.
 */
export declare function classifyFailure(status: number, bodyText: string, headers?: ClaudeHeaderSource): ClaudeFailure;
export {};
//# sourceMappingURL=client.d.ts.map