/**
 * One follow-up poll after a status answer that carried a background refresh.
 *
 * The host answers a status card from the snapshot it already has and refreshes
 * the quota behind that answer, so a tab renders immediately instead of waiting
 * on the upstream request. The refreshed numbers would otherwise only appear on
 * the next 60 s poll, so an answer that reports a refresh in flight schedules
 * one short follow-up.
 *
 * The chain is bounded. A refresh that keeps failing leaves the snapshot aged,
 * so every answer would keep asking for a follow-up; after a few consecutive
 * attempts the surface falls back to its ordinary polling and stops hammering
 * the host.
 */
export interface QuotaFollowUp {
    /**
     * Record one status answer.
     *
     * @param refreshing - whether the host reported a refresh behind this answer.
     * @param reload - how to ask again; used only when a follow-up is owed.
     */
    observe(refreshing: boolean, reload: () => void): void;
    /** Drop any pending follow-up; call when the surface unmounts. */
    cancel(): void;
}
export declare function createQuotaFollowUp(options?: {
    delayMs?: number;
    maxAttempts?: number;
}): QuotaFollowUp;
//# sourceMappingURL=quota-follow-up.d.ts.map