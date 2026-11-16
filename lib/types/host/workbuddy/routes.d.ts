import type { Context } from '@deepseek-ai/cordis';
import { DEFAULT_CONTEXT_WINDOW, PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type WorkBuddyAtRestKeyStore, type WorkBuddyPreferenceStore } from './token-store.ts';
import { getCachedQuota } from './client.ts';
import { type WorkBuddyModelEntry } from './model-catalog.ts';
import type { WorkBuddyModelOption, WorkBuddyWebStatus } from '../../shared/workbuddy-contracts.ts';
import type { WorkBuddyCheckinService } from './checkin.ts';
import type { WorkBuddyAccountPool } from './account-pool.ts';
/**
 * The selection the card should show.
 *
 * A stored list that still equals the shipped default has never been edited, so
 * it cannot know about models the catalog has since added; treating it as
 * "everything this account can call" keeps a first run from hiding models
 * behind an unedited default. Any explicit edit is honoured exactly.
 */
export declare function resolveEnabledModelIds(stored: readonly string[], available: readonly string[], enabled?: boolean): string[];
/**
 * Build the model options the settings card renders.
 *
 * Order comes from the caller, which passes a vendor-grouped list so a family
 * is not interleaved with the next one; this preserves whatever order it is
 * given rather than imposing a second one.
 *
 * `credits` is passed through whole, every region the entry carries. Trimming
 * it to one account's region is tempting and wrong: this DTO is also read with
 * no account in hand (the harness resolves a model list before a credential is
 * chosen), and such a caller would be told nothing rather than everything. The
 * region key the reader actually has is already on each entry as `regions`, so
 * picking a value is the renderer's job, not this one's.
 */
export declare function buildModelOptions(catalog: readonly WorkBuddyModelEntry[], available: readonly string[], enabledModelIds: readonly string[], overrides: Record<string, number>): WorkBuddyModelOption[];
export interface WorkBuddyStatusOptions {
    fetchFn?: typeof fetch;
    /** Whether this plugin currently owns the provider route; re-read on every status. */
    serving?: boolean | (() => boolean);
    /** Diagnostic when another plugin owns the provider route; re-read on every status. */
    conflict?: string | null | (() => string | null);
    /** Multi-account pool this line schedules through; absent keeps the single-account card. */
    accountPool?: WorkBuddyAccountPool;
    /** Daily check-in scheduler; absent leaves the card's check-in row empty. */
    checkin?: Pick<WorkBuddyCheckinService, 'tick' | 'summary'>;
    /**
     * Storage for the `$wbEncrypted` at-rest key.
     *
     * Absent hides the whole control: without it a pasted key could not be
     * remembered, and offering the field anyway would lose it on restart.
     */
    atRestKey?: Pick<WorkBuddyAtRestKeyStore, 'adopt' | 'clear' | 'load' | 'path'>;
}
/** Everything the settings card renders: account, quota, and the model catalog. */
export declare function getWorkBuddyWebStatus(store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: WorkBuddyPreferenceStore, options?: WorkBuddyStatusOptions): Promise<WorkBuddyWebStatus>;
/** Register the WorkBuddy settings routes under `/workbuddy/api`. */
export declare function registerWorkBuddyRoutes(ctx: Context, store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: WorkBuddyPreferenceStore, options?: WorkBuddyStatusOptions): () => void;
export { PROVIDER_ID, PROVIDER_NAME, DEFAULT_CONTEXT_WINDOW, getCachedQuota, type WorkBuddyModelOption, type WorkBuddyWebStatus, };
//# sourceMappingURL=routes.d.ts.map