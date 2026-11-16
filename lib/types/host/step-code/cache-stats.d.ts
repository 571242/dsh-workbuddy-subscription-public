/**
 * Cache-waste diagnosis for the Step Code route: how many prompt tokens should
 * have been cache reads and were billed fresh anyway.
 *
 * Ported from the official Step-Code client
 * (`_ref-stepcode/packages/coding-agent/src/core/cache-stats.ts`, 164 lines).
 * The arithmetic and the counting rules are kept as they are; only the data
 * sources change, because this repository has no `SessionEntry` type and this
 * route must not depend on one:
 *
 * - the official scan walks persisted session entries; here the caller hands in
 *   an already-ordered list of {@link StepCodeCacheEntry} values,
 * - the official message carries `usage.cost`; on this route every price is
 *   zero, so {@link StepCodeCacheMiss.missedCost} is 0 and the card is told not
 *   to render money at all.
 *
 * WHY the diagnosis is worth porting here rather than into the shared cache
 * layer: Step's cache is automatic and invisible. The client gets no marker when
 * a prefix stopped being reused, so the only evidence is the read number on the
 * next turn — and the question "did we throw the prefix away, or did the server?"
 * is answered by comparing against the previous request.
 *
 * Pure functions only: no state is retained here, so the caller owns the history
 * and the lifetime of it.
 *
 * @module dsh-chatgpt-subscription/step-code-cache-stats
 */
/**
 * Prompt-cache time-to-live.
 *
 * An idle gap longer than this is the likeliest explanation for a miss, and it
 * is the only cheap hint this diagnosis can give: the upstream offers no
 * "your entry expired" signal, so the idle period is the whole evidence.
 * Five minutes is the TTL the official client uses for the same notice.
 */
export declare const CACHE_TTL_MS: number;
/**
 * Misses at or below this are cache-breakpoint granularity, not waste.
 *
 * A prefix cache breaks at block boundaries, so a few hundred tokens of drift
 * between two turns is normal re-shuffling. Reporting it teaches the user to
 * ignore the notice, which costs the one notice that mattered.
 */
export declare const NOISE_FLOOR_TOKENS = 1024;
/**
 * Whether this route can put money on a cache number.
 *
 * Always false: the official model table hardwires every price to 0
 * (`STEP_MODEL_DEFAULTS.cost`, `step-provider/index.ts:102`), and Step Plan is a
 * subscription rather than a metered SKU. A caller that renders
 * `missedCost` from a zero price shows a correct, useless "you saved $0"; the
 * alternative — inventing a rate — would show a plausible, false number. So the
 * card shows the token dimension alone.
 */
export declare function isCacheWasteCostPriced(): boolean;
/** Disjoint token counts for one assistant turn, as this route reports them. */
export interface StepCodeCacheUsage {
    /** Uncached prompt tokens. */
    inputTokens: number;
    /** Output tokens, which reasoning is billed against. */
    outputTokens?: number;
    /** Prompt tokens served from the automatic prefix cache. */
    cacheReadTokens?: number;
    /**
     * Always 0 on this route — the cache is automatic, so there is no client-side
     * write to count. Kept in the shape because the arithmetic below reads it.
     */
    cacheWriteTokens?: number;
}
/** One assistant turn: what it spent, when, and on which model. */
export interface StepCodeCacheTurn {
    readonly usage: StepCodeCacheUsage;
    /** Epoch milliseconds the request completed. */
    readonly timestamp: number;
    /**
     * Identity of the model route, `{provider}/{model}`.
     *
     * Compared as a string rather than as two fields so a caller can extend it
     * (region, profile, wire) without this file needing to know what a "route" is.
     */
    readonly modelKey: string;
}
/**
 * What the previous request in this segment left behind.
 *
 * Everything in its prompt should be a cache read on the next turn; that is the
 * premise the whole diagnosis rests on.
 */
export interface StepCodePreviousRequest {
    /** Its aggregate prompt count. */
    promptTokens: number;
    readonly modelKey: string;
    readonly timestamp: number;
    /**
     * Sticky: some earlier request in this segment reported cache activity.
     *
     * This is what separates two cases that look identical from the outside — a
     * total miss on a read-reporting endpoint versus an endpoint that reports no
     * caching at all. Without it, the second would be reported as a total miss on
     * every single turn.
     */
    readonly reportedCache: boolean;
}
/** A counted cache miss on one assistant turn. */
export interface StepCodeCacheMiss {
    /** Tokens that were in the previous prompt and were NOT read from cache. */
    missedTokens: number;
    /** Always 0 on this route; see {@link isCacheWasteCostPriced}. */
    missedCost: number;
    /** Milliseconds since the previous request, which last refreshed the cache. */
    idleMs: number;
    /** True when the model changed relative to the previous request. */
    modelChanged: boolean;
}
/** Cumulative waste across a segment. */
export interface StepCodeCacheWasteTotals {
    missedTokens: number;
    missedCost: number;
    /** Counted misses — turns above {@link NOISE_FLOOR_TOKENS}. */
    missCount: number;
}
/**
 * One entry of the ordered history this diagnosis scans.
 *
 * The two context-change kinds exist because compaction and branch summaries
 * legitimately REPLACE the prompt: the next turn's context is new content, not
 * re-billed content, so counting it as waste would be wrong.
 */
export type StepCodeCacheEntry = {
    readonly kind: 'turn';
    readonly turn: StepCodeCacheTurn;
} | {
    readonly kind: 'compaction';
} | {
    readonly kind: 'branch-summary';
};
/** Aggregate prompt count of one turn: uncached input plus both cache buckets. */
export declare function promptTokensOf(usage: StepCodeCacheUsage): number;
/**
 * The segment state one turn leaves behind, or undefined when it carries no
 * prompt and therefore cannot be a baseline.
 */
export declare function asPreviousRequest(turn: StepCodeCacheTurn, reportedCache: boolean): StepCodePreviousRequest | undefined;
/**
 * Cache miss for one turn relative to the previous request, or undefined when
 * nothing is counted.
 *
 * Not counted: the first turn (no baseline), a turn with no prompt, a turn whose
 * segment reported no cache activity at all (see
 * {@link StepCodePreviousRequest.reportedCache}), and a miss at or below
 * {@link NOISE_FLOOR_TOKENS}.
 */
export declare function detectCacheMiss(prev: StepCodePreviousRequest | undefined, turn: StepCodeCacheTurn): StepCodeCacheMiss | undefined;
/**
 * Whether an idle period is long enough to suspect the cache entry expired.
 *
 * Strictly greater: an entry alive exactly to its TTL has not expired, and
 * rounding must not turn that into a warning.
 */
export declare function cacheLikelyExpired(idleMs: number): boolean;
/**
 * Cumulative cache waste across a segment: prompt tokens that should have been
 * cache reads because they were in the previous turn's prompt, and were not.
 */
export declare function computeCacheWaste(entries: readonly StepCodeCacheEntry[]): StepCodeCacheWasteTotals;
/**
 * Every counted miss, keyed by the turn that paid for it (by reference).
 *
 * The key is the turn object, so a caller re-deriving notices while rebuilding a
 * transcript can look a turn up without inventing a second identity for it.
 */
export declare function collectCacheMisses(entries: readonly StepCodeCacheEntry[]): ReadonlyMap<StepCodeCacheTurn, StepCodeCacheMiss>;
/**
 * The miss for a turn that has just completed.
 *
 * `entries` must NOT already contain `turn`: the caller passes the history as
 * of before the turn. A turn that is present twice would be compared against
 * itself, which always reads as a total miss.
 */
export declare function detectCacheMissForTurn(entries: readonly StepCodeCacheEntry[], turn: StepCodeCacheTurn): StepCodeCacheMiss | undefined;
//# sourceMappingURL=cache-stats.d.ts.map