/**
 * Per-account concurrency gate.
 *
 * A subscription plan bounds how many model requests one account may have in
 * flight, and several plans fail the moment that is exceeded. A multi-agent run
 * reaches that bound by itself — one root agent plus a fan-out of subagents — so
 * the bound has to be held deliberately instead of discovered by having every
 * account 429 at once.
 *
 * The gate is deliberately generic and per-account: it knows nothing about any
 * provider's plan, because a hard-coded number would be a guess about terms this
 * code cannot see. A route that has learned its real limit passes it in; a route
 * that has not passes nothing and behaves exactly as before.
 *
 * @module dsh-chatgpt-subscription/concurrency-gate
 */
export declare class ConcurrencyGate {
    private readonly held;
    private readonly queues;
    private readonly limits;
    /**
     * Record the concurrency limit for one account.
     *
     * A non-positive or non-finite limit clears the cap, which is the same as
     * never having set one: requests then pass through unbounded rather than
     * being blocked by a value nobody verified.
     */
    setLimit(accountId: string, limit: number): void;
    /** Limit currently in force for one account, or undefined when uncapped. */
    limitFor(accountId: string): number | undefined;
    /** Requests currently in flight for one account. */
    inFlight(accountId: string): number;
    /**
     * Take one slot, waiting for it when the account is at its limit.
     *
     * The returned function releases the slot and is safe to call more than once:
     * a double release on an aborted request must not hand a stranger a slot that
     * this holder never had.
     */
    acquire(accountId: string, signal?: AbortSignal): Promise<() => void>;
    private take;
    private releaseFn;
    /** Hand slots to as many waiters as the current limit allows. */
    private drain;
}
//# sourceMappingURL=concurrency-gate.d.ts.map