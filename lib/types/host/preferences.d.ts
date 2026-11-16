import type { SubscriptionPreferencesDto, SubscriptionPreferencesUpdateDto } from '../shared/contracts.ts';
export interface SubscriptionPreferenceStore {
    status(): SubscriptionPreferencesDto;
    update(patch: SubscriptionPreferencesUpdateDto): Promise<SubscriptionPreferencesDto>;
    watch(callback: (next: SubscriptionPreferencesDto, prev: SubscriptionPreferencesDto) => void | Promise<void>): () => void;
}
/**
 * {@link SubscriptionPreferenceStore} plus the one-shot load of the
 * plugin-owned fallback file. A store bound to a settings namespace has nothing
 * to load, so its `hydrate` resolves immediately.
 */
export interface PreferenceStoreHandle extends SubscriptionPreferenceStore {
    /** Read the fallback document once; later reads are no-ops. */
    hydrate(): Promise<void>;
}
/**
 * Bind the preferences to the settings namespace when the harness still offers
 * the register seam, and to the plugin-owned JSON document when it does not
 * (harness 0.1.7 replaced the seam with Config-field forms).
 * @param settings - Live `ctx.settings` service of either harness generation.
 */
export declare function registerPreferenceStore(settings?: unknown): PreferenceStoreHandle;
export declare class PreferenceError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=preferences.d.ts.map