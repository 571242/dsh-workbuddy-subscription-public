/**
 * Daily check-in scheduler for the CN-region billing activity.
 *
 * Ported from workbuddy2api's `daily_checkin.py` and adapted to this host:
 * the cron job becomes an in-process timer (the plugin runs inside the DSH
 * host, so a day the host never runs is a day nothing signs in — accepted and
 * documented), and the per-file state JSON becomes one state document under
 * the harness home. The semantics are kept exactly:
 *
 * - **CN only.** The international deployment exposes no check-in surface, so
 *   those accounts are skipped rather than failing daily.
 * - **Idempotent.** The activity status is queried first; an account already
 *   signed in (by anyone) is only recorded. An account whose activity reports
 *   no entitlement is parked (see {@link CHECKIN_INACTIVE_RECHECK_MS}) rather
 *   than abandoned for the day: the host often starts before the activity's
 *   daily opening, and treating that first answer as final cost the account its
 *   only chance to sign in. Once everyone is settled, a tick sends no requests.
 * - **Bounded.** A failing account is retried at most {@link CHECKIN_ATTEMPT_CAP}
 *   times a day, so a broken account cannot turn the ten-minute tick into a
 *   request loop. A manual run ignores the cap and the window, like the
 *   reference script's `--now`, and is queued behind an in-flight run rather
 *   than dropped into it (a click must actually mean "try again now").
 *
 * Tokens stay host-side: the only write beyond the state file is the existing
 * credential store's refresh write-back, reused here unchanged.
 */
import { type FileCredentialStore } from './token-store.ts';
import type { WorkBuddyCheckinSettings, WorkBuddyCheckinSummary } from '../../shared/workbuddy-contracts.ts';
/** Activity status surface; answers whether today is signed in already. */
export declare const CHECKIN_STATUS_PATH = "/billing/meter/checkin-activity-status";
/** Check-in surface; credits are granted by posting here once a day. */
export declare const CHECKIN_PATH = "/billing/meter/daily-checkin";
/**
 * Scheduler cadence. The first tick at host startup is the daily run; the
 * interval keeps a long-lived process signing in on later days without a
 * restart. Idle ticks cost no requests — the day state short-circuits them.
 */
export declare const CHECKIN_TICK_MS: number;
/** Daily retry ceiling for one account after a failed attempt. */
export declare const CHECKIN_ATTEMPT_CAP = 3;
export declare const CHECKIN_TIMEOUT_MS = 20000;
/**
 * How long an unentitled account waits before the activity is polled again.
 *
 * The activity opens on its own schedule, so the first inactive answer of the
 * day is frequently 'not open yet' rather than 'no entitlement today'. Hourly
 * re-checks keep a host that booted early from missing the day, while still
 * costing at most one status request per hour per account.
 */
export declare const CHECKIN_INACTIVE_RECHECK_MS: number;
/**
 * Random pause between two accounts in one pass.
 *
 * Sequential accounts already serialise their requests, but they still arrive as
 * one tight cluster from one outbound IP; a dozen-account pool doing that at the
 * same minute is the burst pattern the sibling gateway added jitter for after
 * seeing upstream rate-limit whole pools.
 */
export declare const CHECKIN_JITTER_MIN_MS = 2000;
export declare const CHECKIN_JITTER_MAX_MS = 5000;
/** State document the scheduler keeps beside the other plugin stores. */
export declare function checkinStatePath(): string;
/** Local calendar day an instant belongs to; state entries are keyed by it. */
export declare function localDateString(nowMs: number): string;
export interface WorkBuddyCheckinServiceOptions {
    fetchFn?: typeof fetch;
    /** State document path; tests redirect it, production uses {@link checkinStatePath}. */
    statePath?: string;
    /** Live preferences, re-read on every tick so the toggle applies at once. */
    settings: () => WorkBuddyCheckinSettings;
    /**
     * Resolves once the preference store has read its stored document.
     *
     * Optional for callers whose settings are already in memory; the host passes
     * the preference store's own warmup so the startup pass cannot act on a
     * default that the stored document is about to overwrite.
     */
    ready?: () => Promise<void>;
    /** Clock injection for tests. */
    now?: () => number;
    /** Wait between two accounts in one pass; injected so tests run without delays. */
    pause?: (ms: number) => Promise<void>;
    /** Jitter source; injected so a test can pin the delay it caused. */
    random?: () => number;
    logger?: {
        info(message: string): void;
        warn(message: string): void;
    };
}
/**
 * The check-in scheduler. One instance per plugin load; the host owns the
 * interval and clears it from the same `ctx.effect` that created it.
 */
export declare class WorkBuddyCheckinService {
    private readonly store;
    private readonly options;
    private readonly fetchFn;
    private readonly statePath;
    private readonly now;
    private readonly pause;
    private readonly random;
    private readonly logger;
    private state;
    private loaded;
    /** Passes waiting to run, in order; `true` marks a manual pass. */
    private readonly queue;
    /** The drain loop currently working the queue, if any. */
    private draining;
    private lastRunAt;
    /** Memoized preference warmup, so it is awaited once however many passes run. */
    private readyWait;
    constructor(store: FileCredentialStore, options: WorkBuddyCheckinServiceOptions);
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
    /** Run queued passes one after another until the queue empties. */
    private drain;
    private runQueue;
    private run;
    /** Wait for the preference store's warmup read, once. */
    private ready;
    /** Check one account in, recording the outcome in its today's entry. */
    private checkinOne;
    /** Record a confirmed sign-in, clearing the transient failure bookkeeping. */
    private markSignedIn;
    /**
     * Refresh a token the server rejected, bypassing the store's expiry check.
     *
     * `ensureFresh` only acts on a locally expired token, so a session the server
     * revoked early would otherwise fail every retry until the file's own clock
     * caught up. The rotation is written back through the store either way.
     */
    private forceRefresh;
    /**
     * The aggregate the settings card renders. Reads only local state and the
     * account list; it never spends a network request.
     */
    summary(): Promise<WorkBuddyCheckinSummary>;
    private load;
    private save;
    private post;
}
//# sourceMappingURL=checkin.d.ts.map