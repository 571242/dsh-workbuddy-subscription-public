import type { Context } from '@deepseek-ai/cordis';
import { PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type CommandCodeCatalogModel, type CommandCodePreferenceStore } from './token-store.ts';
import { CommandCodeAccountPool } from './account-pool.ts';
import { getCachedCatalog } from './client.ts';
import type { CommandCodeApiEnv, CommandCodeWebStatus } from '../../shared/command-code-contracts.ts';
/**
 * The selection the card should show.
 *
 * A stored list that still equals the shipped default has never been edited, so
 * it cannot know about models the live catalog has since added; treating it as
 * "everything currently offered" keeps a first run from hiding the whole
 * catalog behind an unedited default. Any explicit edit is honoured exactly.
 */
export declare function resolveEnabledModelIds(stored: readonly string[], catalog: readonly CommandCodeCatalogModel[], enabled?: boolean): string[];
export interface CommandCodeStatusOptions {
    fetchFn?: typeof fetch;
    /** Whether this plugin currently owns the provider route; re-read on every status. */
    serving?: boolean | (() => boolean);
    /** Diagnostic when another plugin owns the provider route; re-read on every status. */
    conflict?: string | null | (() => string | null);
    /**
     * Account pool instance used for multi-account management.
     *
     * Only the plugin entry installs one, because it owns the pool's storage. A
     * caller that passes none keeps the single-key behavior, and no code path
     * invents pool state that would outlive the process.
     */
    accountPool?: CommandCodeAccountPool;
    /** Whether Zero Data Retention (ZDR) routing is active for Command Code requests. */
    zeroDataRetention?: boolean;
}
/** Everything the settings card renders: account, quota, and the model catalog. */
export declare function getCommandCodeWebStatus(store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: CommandCodePreferenceStore, options?: CommandCodeStatusOptions, accountPool?: CommandCodeAccountPool | undefined): Promise<CommandCodeWebStatus>;
/** Register the Command Code settings routes under `/command-code/api`. */
export declare function registerCommandCodeRoutes(ctx: Context, store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: CommandCodePreferenceStore, options?: CommandCodeStatusOptions, accountPool?: CommandCodeAccountPool | undefined): () => void;
export { PROVIDER_ID, PROVIDER_NAME, type CommandCodeApiEnv, getCachedCatalog };
//# sourceMappingURL=routes.d.ts.map