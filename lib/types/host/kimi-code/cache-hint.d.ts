/**
 * When it is worth telling the user their prompt cache has gone cold.
 *
 * Kimi's cache is automatic and content-hash based, so a client gets no marker
 * that it is no longer being reused — the only evidence is the read ratio in
 * the usage stream. A conversation that sat idle past the cache TTL pays the
 * full prompt again on its next turn, and it is large enough on a real
 * codebase to be worth a sentence.
 *
 * The trigger mirrors the official client's: idle beyond the tier's lifetime
 * AND a context large enough that reprocessing it actually costs something.
 * The upstream rules arrive from a remote config that a private deployment
 * cannot reach, so the thresholds here are the documented defaults; the
 * decision function itself is written to take them, so swapping the source
 * later changes only where the numbers come from.
 */
import type { KimiCodeCacheTtl } from '../../shared/kimi-code-contracts.ts';
/**
 * How long an entry written at each tier survives.
 *
 * The tier is LOCKED when the prefix is first written, so this is the lifetime
 * of the entry a request actually created rather than of the tier as a name.
 */
export declare const CACHE_TTL_MS: Record<KimiCodeCacheTtl, number>;
/**
 * Context below which a cold cache is not worth mentioning.
 *
 * Reprocessing a few thousand tokens is invisible; reprocessing a few hundred
 * thousand is the difference between an instant and a visible pause, and
 * telling someone about the former trains them to ignore the notice.
 */
export declare const MIN_TOKENS_TO_HINT = 100000;
/**
 * Note that a session just did something.
 *
 * Called on every turn, so the timestamp answers how long since this
 * conversation last ran, which is what decides whether its cache entry can
 * still be alive.
 */
export declare function markSessionActive(sessionId: string | undefined, now?: number): void;
/** When a session last did something, or undefined when it never has. */
export declare function sessionLastActiveAt(sessionId: string | undefined): number | undefined;
/** Forget one session's activity, or all of it. Test seam and teardown. */
export declare function resetSessionActivity(sessionId?: string): void;
export interface CacheHintInput {
    /** Current time, epoch ms. */
    readonly now: number;
    /**
     * When the conversation last did anything, epoch ms.
     *
     * Absent means nothing is known, and the hint is skipped: a client that
     * cannot say how long the session was idle cannot claim the entry expired.
     */
    readonly lastActiveAt?: number;
    /** Context currently loaded, in tokens. Absent means no local estimate. */
    readonly totalTokens?: number;
    /** Tier the conversation's entries were written at. */
    readonly cacheTtl?: KimiCodeCacheTtl | null;
}
export type CacheHintDecision = {
    readonly kind: 'skip';
} | {
    readonly kind: 'hint';
    readonly idleMs: number;
    readonly totalTokens: number;
};
/**
 * Whether one conversation should be warned about a cold cache.
 *
 * Every missing-data branch skips. That asymmetry is deliberate and matches
 * the official client: a false negative costs one turn nobody noticed, while a
 * false positive teaches the user the notice is noise and stops them reading
 * the one that mattered.
 */
export declare function evaluateCacheHint(input: CacheHintInput): CacheHintDecision;
//# sourceMappingURL=cache-hint.d.ts.map