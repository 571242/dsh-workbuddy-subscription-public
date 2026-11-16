/**
 * Daily check-in scheduler for the MiniMax Code line.
 *
 * Modeled on the sibling WorkBuddy scheduler and kept semantically identical
 * where the two services face the same problem; the wire half lives in
 * ./checkin-gateway.ts (official-client recipe, verified live).
 *
 * - **Both regions.** The official client's public gateway has an origin per
 *   region, so an account signs in against its own region's origin. There is
 *   no CN-only carve-out like WorkBuddy's: the CLI ships the same surface
 *   worldwide.
 * - **Idempotent.** The panel is read first; an account whose today is already
 *   claimed (by anyone) is only recorded. A duplicate claim answers
 *   `claim_result: 2` (AlreadyClaimed), which is a success, never a retry.
 * - **Patient with the day.** A today that is neither claimable nor claimed
 *   (upcoming/disabled) is parked and re-checked on an hourly cadence rather
 *   than abandoned: the activity flips on its own schedule, and the host
 *   usually boots before it does.
 * - **Bounded.** A failing account is retried at most {@link CHECKIN_ATTEMPT_CAP}
 *   times a day, so a broken account cannot turn the ten-minute tick into a
 *   request loop. A manual run ignores the cap and the toggle, like the
 *   workbuddy card's "check in now", and is queued behind an in-flight run.
 *
 * Credentials stay host-side: the only write beyond the state file is the
 * account pool's own refresh write-back, reused here unchanged through
 * `getFreshCredential` / `renewCredential`.
 */
import type { MinimaxCodeCheckinSummary } from '../../shared/minimax-code-contracts.ts';
import type { MinimaxCodeAccountPool } from './account-pool.ts';
/**
 * Scheduler cadence. The first tick at host startup is the daily run; the
 * interval keeps a long-lived process signing in on later days without a
 * restart. Idle ticks cost no requests — the day state short-circuits them.
 */
export declare const CHECKIN_TICK_MS: number;
/** Daily retry ceiling for one account after a failed attempt. */
export declare const CHECKIN_ATTEMPT_CAP = 3;
/**
 * How long a not-yet-claimable today waits before the panel is polled again.
 * Same reasoning as the workbuddy scheduler: the activity opens on its own
 * schedule, and the first answer of the day is frequently "not open yet".
 */
export declare const CHECKIN_INACTIVE_RECHECK_MS: number;
/** State document the scheduler keeps beside the other plugin stores. */
export declare function checkinStatePath(): string;
/** Local calendar day an instant belongs to; state entries are keyed by it. */
export declare function localDateString(nowMs: number): string;
/** The slice of the account pool the scheduler uses. */
export type MinimaxCodeCheckinPool = Pick<MinimaxCodeAccountPool, 'listAccounts' | 'getFreshCredential' | 'renewCredential'>;
export interface MinimaxCodeCheckinServiceOptions {
    fetchFn?: typeof fetch;
    /** State document path; tests redirect it, production uses {@link checkinStatePath}. */
    statePath?: string;
    /** Live preference, re-read on every tick so the toggle applies at once. */
    settings: () => {
        enabled: boolean;
    };
    /**
     * Resolves once the preference store has read its stored document, so the
     * startup pass cannot act on a default the stored document is about to
     * overwrite. Optional for callers whose settings are already in memory.
     */
    ready?: () => Promise<void>;
    /** Clock injection for tests. */
    now?: () => number;
    /** `desktop_version` the wire request reports; the plugin version in production. */
    appVersion?: string;
    logger?: {
        info(message: string): void;
        warn(message: string): void;
    };
}
/**
 * The check-in scheduler. One instance per plugin load; the host owns the
 * interval and clears it from the same `ctx.effect` that created it.
 */
export declare class MinimaxCodeCheckinService {
    private readonly pool;
    private readonly options;
    private readonly fetchFn;
    private readonly statePath;
    private readonly now;
    private readonly logger;
    private readonly appVersion;
    private state;
    private identities;
    private loaded;
    /** Passes waiting to run, in order; `true` marks a manual pass. */
    private readonly queue;
    /** The drain loop currently working the queue, if any. */
    private draining;
    private lastRunAt;
    /** Memoized preference warmup, so it is awaited once however many passes run. */
    private readyWait;
    constructor(pool: MinimaxCodeCheckinPool, options: MinimaxCodeCheckinServiceOptions);
    /**
     * One scheduler pass. Automatic passes honour the toggle and the retry cap;
     * a manual pass (`manual: true`, the card's "check in now") ignores both
     * but still respects an account already signed in today.
     *
     * A manual pass that lands while a run is already in flight is *queued*, not
     * absorbed: joining the running pass would silently discard the one thing the
     * button promises, that the retry cap and the toggle are bypassed now.
     */
    tick(manual?: boolean): Promise<void>;
    private drain;
    private runQueue;
    private run;
    /** Wait for the preference store's warmup read, once. */
    private ready;
    /**
     * Resolve the account's realUserID, cached across days.
     *
     * The OAuth document does not carry it and the check-in query string needs
     * it, so it is fetched from the identity surface once and kept in the state
     * document. The region is cached alongside because the identity call's
     * origin depends on it.
     */
    private identityFor;
    /** Check one account in, recording the outcome in its today's entry. */
    private checkinOne;
    /**
     * One full try for one account: identity, panel, and — when today is
     * claimable — the claim. Settles the entry on every outcome; throws for the
     * caller's renew-and-retry or attempt bookkeeping.
     */
    private attemptOnce;
    /** The status call, against the current credential. */
    private panel;
    /** The claim call, against the current credential. */
    private claim;
    /**
     * Fold one panel into the day's entry.
     *
     * Returns true when the entry is settled for the day (claimed already, or
     * parked inactive): the caller then skips the claim. Today claimable is the
     * one answer that returns false.
     */
    private recordPanelOutcome;
    /** Record a confirmed sign-in, clearing the transient failure bookkeeping. */
    private markSignedIn;
    /**
     * The aggregate the settings card renders. Reads only local state and the
     * account list; it never spends a network request.
     */
    summary(): Promise<MinimaxCodeCheckinSummary>;
    private load;
    private save;
}
//# sourceMappingURL=checkin.d.ts.map