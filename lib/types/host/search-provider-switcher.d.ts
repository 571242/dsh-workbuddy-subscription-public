import type { Entry } from '@deepseek-ai/cordis-plugin-loader';
import type { SearchProviderPreference } from '../shared/contracts.ts';
interface LoaderLike {
    entries(): Iterable<Entry>;
}
export interface WebProviderSelectionOptions {
    readonly pluginFetch?: boolean;
    /** Explicit mode overrides both proxy detection and the search preference. */
    readonly fetchProvider?: 'auto' | 'plugin' | 'dsh';
}
/** Configuration diagnostics, not proof that an in-flight tool uses this service. */
export interface SearchProviderSwitcherStatus {
    readonly state: 'idle' | 'applying' | 'applied' | 'missing' | 'failed';
    readonly configuredSearchProvider: string | null;
    readonly configuredFetchProvider: string | null;
}
export declare class SearchProviderSwitcher {
    private readonly loader;
    private originalSearchProvider;
    private originalFetchProvider;
    private initialized;
    private pending;
    private disposed;
    dispose(): void;
    private state;
    constructor(loader: LoaderLike);
    status(): SearchProviderSwitcherStatus;
    select(preference: SearchProviderPreference, options?: WebProviderSelectionOptions): Promise<void>;
    private applySelection;
    /**
     * Wait until the entry's fiber has finished restarting, not just until it
     * happens not to be mid-restart when asked.
     *
     * `Fiber.await()` alone is a single sample: it returns at once when `inertia`
     * is unset, which is exactly the state the fiber is in on the first tick after
     * `update()` queues its restart. Sampling that reports success while the entry
     * is still UNLOADING. This waits for a restart to actually be observed, then
     * lets `Fiber.await()` drain whatever queue is left, so a slow or multi-pass
     * restart cannot be reported as applied either.
     */
    private awaitSettled;
    private findWebEntry;
}
export {};
//# sourceMappingURL=search-provider-switcher.d.ts.map