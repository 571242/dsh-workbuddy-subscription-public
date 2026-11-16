/**
 * One quota refresh that runs behind an already-answered status call.
 *
 * A status card used to block on the upstream quota request whenever its
 * snapshot had aged past the line's TTL — measured at up to 3.6 s on a real
 * machine, on a tab whose other work answers in milliseconds. A snapshot that
 * exists can answer immediately instead, with the refresh running behind it.
 *
 * The outcome is remembered here rather than dropped: a refresh that keeps
 * failing would otherwise look exactly like a snapshot that never aged, and the
 * card would show old numbers with no hint of why they stopped moving.
 *
 * The caller still decides whether the snapshot may answer at all. No snapshot,
 * or one belonging to another account, has to be fetched before the card can be
 * rendered — those paths call {@link run} and wait.
 */
export declare class QuotaRefresh {
    private pending;
    private error;
    /**
     * Start one refresh behind the answer.
     *
     * A refresh that is already running is not duplicated; the caller can see
     * that one is in flight through {@link refreshing} and ask again when it
     * lands.
     */
    start(refresh: () => Promise<unknown>): void;
    /** Run one refresh and wait for it, recording the same outcome. */
    run(refresh: () => Promise<unknown>): Promise<void>;
    /** Whether a refresh started here is still running. */
    get refreshing(): boolean;
    /** Message from the most recent failed refresh, or null when none failed. */
    lastError(): string | null;
}
//# sourceMappingURL=quota-refresh.d.ts.map