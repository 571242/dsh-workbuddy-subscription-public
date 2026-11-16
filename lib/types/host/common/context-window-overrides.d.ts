/**
 * Merge semantics for the per-model context window overrides every provider
 * page stores.
 *
 * A patch value of `null` means "drop this override and fall back to the
 * catalog default", which is what the settings card's restore button sends.
 * Persisted settings stay `Record<string, number>`: the `null` never reaches a
 * store, it only travels over the wire.
 */
export type ContextWindowOverridePatch = Record<string, number | null>;
export declare function mergeContextWindowOverrides(current: Record<string, number> | undefined, patch: ContextWindowOverridePatch): Record<string, number>;
//# sourceMappingURL=context-window-overrides.d.ts.map