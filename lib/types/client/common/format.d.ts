/**
 * The capacity, date and countdown formatting every provider settings card shares.
 *
 * Each card used to carry its own copy of the capacity pair. The five copies
 * were byte-identical except Antigravity's `formatCapacity`, which had lost the
 * 1K floor and so rendered a zero as "0K" while its siblings rendered "0". The
 * parse has to mean the same thing on every line — it takes free-text user input
 * that feeds the overflow judgement — so this is the one place it lives. The
 * date helpers were copied the same way; WorkBuddy's countdown is here for the
 * same reason.
 */
/**
 * Parse "1M", "512K", "200000" into a positive integer token count.
 *
 * Anything that is not a plain capacity — including `0`, which no model has —
 * returns null rather than a coerced number, so the caller can leave the draft
 * uncommitted instead of storing a length that would silently break compaction.
 */
export declare function parsePositiveCapacity(value: string): number | null;
/** Render a token capacity the way the capacity field seeds itself. */
export declare function formatCapacity(value: number): string;
/** A stamp in the reader's own locale, or an em dash when there is none. */
export declare function formatDate(ms?: number | null): string;
/**
 * Countdown to a reset instant ("3d 4h"), empty when there is nothing to count
 * down to. Empty rather than "—" because callers append it to a date they have
 * already rendered, and a dash there would read as a second missing value.
 */
export declare function formatReset(resetsAt?: number | null): string;
//# sourceMappingURL=format.d.ts.map