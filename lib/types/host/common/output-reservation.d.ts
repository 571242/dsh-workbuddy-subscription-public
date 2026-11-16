/**
 * Keep fixed defaults only when they fit DSH compaction-basic's default policy.
 * This is host metadata, NEVER a wire cap. Callers must retain their original
 * wire fallback when the metadata is omitted. Explicit request caps still win.
 * Custom compaction policies and windows too small even at zero reservation
 * require deployment configuration; do not invent a larger context window.
 */
export declare function outputReservation(contextWindow: number, maxTokens: number): {
    defaultMaxTokens?: number;
};
//# sourceMappingURL=output-reservation.d.ts.map