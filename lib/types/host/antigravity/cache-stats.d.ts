/**
 * Per-session cache accounting for the Antigravity line.
 *
 * Antigravity's prompt cache is implicit and server-side: the client sets no
 * cache-control field, and the only evidence that a prefix was reused is the
 * pair `usageMetadata.cachedContentTokenCount` / `promptTokenCount` on each
 * response. A ratio on its own cannot explain itself, so every request also
 * fingerprints the three parts of its body that decide the prefix the service is
 * able to reuse — `request.contents`, `request.systemInstruction` and
 * `request.tools` — and diffs them against the previous request of the same
 * session.
 *
 * Everything here is process-local, scoped by session, and never written to
 * disk: the numbers describe the conversations this host served, and one
 * session's misses must never be blended into another's ratio.
 *
 * KNOWN LIMITATION — the two halves read the request at different scopes.
 *
 * This is a measured fact about this module, not a theory: the prefix snapshots
 * that produce a drift cause are keyed by SESSION alone ({@link
 * sessionScopeKey}), while the token totals are keyed by SESSION AND ACCOUNT
 * ({@link statsScopeKey}). The account is deliberately absent from the snapshot
 * because the account that will answer a request is not known when the body is
 * assembled — the adapter resolves it at the pool, after the fingerprint is
 * taken.
 *
 * What follows from that: when one conversation is served by more than one
 * pooled account (a 429 falls through to the next account mid-session), the
 * three prefix segments and the raw session id are all byte-for-byte unchanged,
 * so the drift comparator reports 'none'. A reader must NOT read that as "the
 * client sent nothing different, so the chill came from the service" — the
 * account did change. The request that reached the service was not the same
 * request, even though every field this module fingerprints is identical.
 *
 * Whether the serving account actually partitions the server-side cache is
 * INFERRED, not measured — the same unverified assumption the account-scoped
 * totals rest on, and the reason no 'account' drift cause exists yet: promoting
 * it to the contract before the assumption is checked would state it as fact.
 * The honest reading of a 'none' beside a rising fresh-token count is "the client
 * prefix held; look at which account served the turn".
 */
/**
 * The part of a request that changed since that session's previous request.
 *
 * `'none'` means the prefix held, so a cold turn is not explained by anything the
 * client sent IN THE SEGMENTS THIS MODULE FINGERPRINTS — it points at the service
 * or at something the fingerprints cannot see (see the file header's known
 * limitation: the serving account is one such thing). Every other value names the
 * input that broke the prefix, which is the half of the diagnostic a bare hit
 * ratio cannot supply.
 */
export type AntigravityPrefixDriftCause = 
/** The prefix is unchanged. */
'none'
/** The conversation itself changed. */
 | 'contents'
/** The system instruction changed. */
 | 'systemInstruction'
/** The tool list changed. */
 | 'tools'
/**
 * The session identifier the request carries changed inside one session scope.
 *
 * It names the CLIENT-SIDE string, and deliberately promises nothing about the
 * service's cache: whether that identifier partitions anything server-side is
 * inferred, not measured. In practice this branch is close to unreachable — the
 * scope key trims, so it takes two spellings of one session (a trailing space)
 * to trigger it within a single conversation.
 */
 | 'session-id'
/** Nothing to compare against: this scope's first request. */
 | 'new-session';
/** One request's token counts, as the service reported them. */
export interface AntigravityUsageSample {
    /** Prompt tokens served from the service's cache (`cachedContentTokenCount`). */
    cachedTokens: number;
    /** Prompt tokens it had to process (`promptTokenCount` minus the cached part). */
    freshTokens: number;
}
/** Rolling cache totals for one scope. */
export interface AntigravityCacheStats {
    /** Requests that reported usage. */
    requests: number;
    /** Prompt tokens served from cache across those requests. */
    cachedTokens: number;
    /** Prompt tokens processed afresh across those requests. */
    freshTokens: number;
    /** cachedTokens / (cachedTokens + freshTokens); null until a request reports usage. */
    hitRatio: number | null;
}
/** The shape the settings route publishes, and the browser card renders. */
export interface AntigravityCacheStatsDto extends AntigravityCacheStats {
    /**
     * The most recent request that came back with nothing cached.
     *
     * Only misses are published. A prefix change on its own says nothing: a new
     * user turn always changes `contents`, and that turn still hits the cache for
     * everything before it. Publishing every change made the card read "contents
     * changed" on every single turn — it named the one input that is SUPPOSED to
     * change and hid the one that actually costs: an idle gap that outlived the
     * service's cache.
     */
    lastMiss?: AntigravityCacheMiss;
}
/**
 * One total miss, and the two facts that explain it.
 *
 * A miss here means the response reported zero cached tokens — the whole prefix
 * was reprocessed. That is the event worth naming; a partial hit is the normal
 * state of a growing conversation.
 */
export interface AntigravityCacheMiss {
    /** The segment that changed since this session's previous request. */
    cause: AntigravityPrefixDriftCause;
    /**
     * Milliseconds since this session's previous request, or undefined when this
     * was the session's first. The service's cache expires on idle time it does
     * not disclose, so this is the reading that separates "the conversation
     * restarted" from "the cache timed out while the user was away".
     */
    idleMs?: number;
    /** When the miss was recorded. */
    at: number;
}
/**
 * Fingerprint the prefix of a request about to be sent, and attribute whatever
 * changed since this session's previous request.
 *
 * Called once per turn, before the request goes out, so the answer describes the
 * prefix the service will actually see. The reason is remembered for the session
 * as well, so the route can publish the attribution beside the ratio it explains.
 *
 * @param body - The serialized request body, exactly as it will be sent.
 * @param sessionId - Conversation the request belongs to, when it has one.
 * @returns The change attributed to this request.
 */
export declare function recordCacheRequest(body: string, sessionId?: unknown): AntigravityPrefixDriftCause;
/**
 * Add one request's reported counts to its session's totals.
 *
 * The scope carries the account as well as the session, because a pooled line
 * can answer one conversation from several accounts and each of those keeps its
 * own cache server-side: one account's cold misses must not be averaged into
 * another's warm hits.
 *
 * @param sample - Token counts the response reported.
 * @param sessionId - Conversation the request belonged to.
 * @param accountId - Pooled account that served it, when the pool is in use.
 */
export declare function recordCacheUsage(sample: AntigravityUsageSample, sessionId?: unknown, accountId?: string): void;
/**
 * Cache totals for one account's share of a session, one whole session, or every
 * tracked session.
 *
 * A missing session is not an error: the settings card has no conversation in
 * hand, and the process aggregate is the honest answer there.
 */
export declare function getCacheStats(sessionId?: string, accountId?: string): AntigravityCacheStatsDto;
/**
 * Forget one session's numbers, or all of them.
 *
 * Session teardown and test seam: a conversation that ended must not leave its
 * ratio behind to be read as another's.
 */
export declare function resetCacheStats(sessionId?: string): void;
//# sourceMappingURL=cache-stats.d.ts.map