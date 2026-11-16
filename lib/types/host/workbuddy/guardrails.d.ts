/**
 * Local quota guardrails for the WorkBuddy line.
 *
 * The subscription meters an account × model over a 24h window (429 `code
 * 6004`), but it only says so AFTER the window is gone — and on the shared
 * account that window is minutes of a large model or a day of a small one. These
 * guardrails stop serving BEFORE that happens, so an exhausted window never has
 * to be discovered by a user staring at a 429.
 *
 * Three of the four guardrails workbuddy2api-hub ships are reproduced here, and
 * all three are EXACT — they read numbers this plugin already has:
 *
 *   reserveCredits    stop the account when its remaining credits fall below N
 *                     (the billing snapshot already reports the remainder)
 *   dailyTokens       stop the account for the rest of the local day at N tokens
 *   modelDailyTokens  stop ONE model for the rest of the local day at N tokens
 *
 * The fourth one there — a daily CREDITS budget — is deliberately NOT
 * reproduced: a request's credit cost is not on the wire this route reads, and
 * deriving it from the catalog multiplier × tokens would invent a number that
 * silently diverges from the bill. A guardrail that lies is worse than none.
 *
 * `0` means OFF for every field, and the default is all-off: an install that
 * never opens this setting behaves exactly as before.
 */
import type { WorkBuddyGuardrailsDto } from '../../shared/workbuddy-contracts.ts';
/**
 * The three exact guardrails.
 *
 * The shape has ONE definition — the shared wire contract — so the card and the
 * enforcement can never disagree about a field name.
 */
export type WorkBuddyGuardrails = WorkBuddyGuardrailsDto;
/** Shipped default: every guardrail off. */
export declare const DEFAULT_GUARDRAILS: WorkBuddyGuardrails;
/** Narrow a stored or patched value into guardrails; anything unusable means off. */
export declare function normalizeGuardrails(value: unknown): WorkBuddyGuardrails;
/** Whether any guardrail is armed; a no-op check must stay cheap. */
export declare function guardrailsArmed(guardrails: WorkBuddyGuardrails): boolean;
/**
 * The local calendar day a counter belongs to.
 *
 * Local, not UTC, because the reset the user reasons about is their own
 * midnight — the same choice this line makes for the CN check-in day.
 */
export declare function localDayKey(now?: number): string;
/** Per-account counters for one day. */
export interface UsageLedgerEntry {
    tokens: number;
    perModel: Record<string, number>;
}
/** Where the local usage counters live. */
export declare function usageLedgerPath(): string;
/**
 * Token counters per account per local day.
 *
 * Deliberately a small persisted document rather than an accounting system: it
 * exists to answer one question ("has this account / model used its day?") and a
 * restart must not forget it, or a guardrail would reset by restarting DSH.
 */
export declare class WorkBuddyUsageLedger {
    private readonly filePath;
    private readonly now;
    private document;
    private loaded;
    private writing;
    constructor(filePath?: string, now?: () => number);
    /** Read the counters once; a missing or unreadable file starts a fresh day. */
    load(): Promise<void>;
    /** Drop yesterday's counters the moment a read notices the day changed. */
    private rollIfNewDay;
    /** Tokens one account has used today, across models. */
    tokensToday(accountId: string): number;
    /** Tokens one account has used today on one model. */
    modelTokensToday(accountId: string, model: string): number;
    /** Today's counters, for the settings card and for tests. */
    snapshot(): Readonly<Record<string, UsageLedgerEntry>>;
    /**
     * Add one request's tokens.
     *
     * Serialized through a promise chain: two concurrent requests on different
     * accounts would otherwise read the same document, add their own counts and
     * write, losing one of them.
     */
    record(accountId: string, model: string, tokens: number): Promise<void>;
    private persist;
}
/** Why an account may not serve a request. */
export type GuardrailReason = 'reserve-credits' | 'daily-tokens' | 'model-daily-tokens';
/** The verdict for one account on one model. */
export type GuardrailVerdict = {
    allowed: true;
} | {
    allowed: false;
    reason: GuardrailReason;
    detail: string;
};
/**
 * Decide whether one account may serve one model right now.
 *
 * Pure on purpose: every number it reads is passed in, so the decision can be
 * tested without a pool, a clock or a network.
 */
export declare function evaluateGuardrails(input: {
    guardrails: WorkBuddyGuardrails;
    tokensToday: number;
    modelTokensToday: number;
    /** Remaining credits from the billing snapshot; null when never read. */
    remainingCredits: number | null | undefined;
}): GuardrailVerdict;
//# sourceMappingURL=guardrails.d.ts.map