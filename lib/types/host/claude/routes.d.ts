/**
 * The '/claude/api' surface: the settings card for the Claude subscription line.
 *
 * The route set, the '{ok,value}' / '{ok,error}' envelope, the 64 KiB body cap,
 * the 405/404/500 conventions and the same-origin requirement on every mutation
 * are all mirrors of the sibling lines' route modules ('src/host/kimi-code/routes.ts',
 * 'src/host/command-code/routes.ts', 'src/host/workbuddy/routes.ts') — deliberately,
 * because the card that renders this line is the same card whose shape those lines
 * established, and a further dialect would be another bug surface for no gain.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS
 * ---------------------------------------------------------------------------
 *
 * It is the whole settings surface for the line and nothing more: the sign-in
 * flow (loopback and the manual paste), adoption of a local Claude Code sign-in,
 * the quota reads, the model catalog and selection, the account pool, and the
 * status payload the card renders. No route is gated on an acknowledgement, a
 * feature flag or any other prior state of the card: each one works from the
 * credentials and the preferences it is handed, and refuses only what it cannot
 * do (not signed in, unsupported action, oversized body, cross-origin caller).
 *
 * Two properties here are structural rather than conventional, and both are load
 * bearing:
 *
 * - 'GET ""' and 'GET "status"' are the card's single source of truth. They
 *   report the account, the catalog, the quota, and whether this plugin owns the
 *   provider route ({@link ClaudeStatusOptions.serving} /
 *   {@link ClaudeStatusOptions.conflict}), so an id already held by another
 *   adapter family shows up as a banner on the card instead of as a model list
 *   that is mysteriously empty.
 * - 'adopt' is the ONLY route that reads the local Claude Code credential file.
 *   The status route asks {@link ClaudeStatusOptions.adoptPaths} whether such a
 *   file EXISTS and never opens it, which is what keeps a status poll from
 *   turning into a scan of the user's disk (see 'adopt.ts' Rule 2).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DECIDE
 * ---------------------------------------------------------------------------
 *
 * Whether the adapter is REGISTERED is the plugin entry's call, not this
 * module's: the entry claims the provider route and reports the outcome back
 * through {@link ClaudeStatusOptions.serving} and
 * {@link ClaudeStatusOptions.conflict}, which is what the card's route banner
 * renders. The route surface itself is registered unconditionally, because the
 * card needs it in every state — including the state where another adapter
 * family owns the provider id and the only thing to show is that fact.
 */
import type { Context } from '@deepseek-ai/cordis';
import { FileCredentialStore, FileModelSettingsStore, type ClaudeCredentials, type ClaudePreferenceStore } from './token-store.ts';
import { type ClaudeModelEntry } from './model-catalog.ts';
import { clearCachedCatalog, clearCachedQuota, getCachedQuota } from './client.ts';
import { type BeginLoginOptions } from './oauth.ts';
import { claudeCodeCredentialPaths, claudeCodeCredentialPresence } from './adopt.ts';
import { DEFAULT_CONTEXT_WINDOW, PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import type { ClaudeAccountPool } from './account-pool.ts';
import { type ClaudeModelOption, type ClaudeWebStatus, 
/** The shared declaration, imported under its own name so it can be re-exported below. */
type ClaudeAccountSummaryDto } from '../../shared/claude-contracts.ts';
/** Prefix this line's routes are registered under. */
export declare const ROUTE_PREFIX = "/claude/api";
/**
 * The selection the card should show.
 *
 * A stored list that still equals the shipped default has never been edited, so
 * it cannot know about models the live listing has since added; treating it as
 * "everything this account can call" keeps a first run from hiding models behind
 * an unedited default. Any explicit edit is honoured exactly. The rule is the
 * same one every sibling line states, and it is stated locally because the
 * helper is not shared.
 */
export declare function resolveEnabledModelIds(stored: readonly string[], available: readonly string[], enabled?: boolean): string[];
/** Build the model options the settings card renders, in catalog order. */
export declare function buildClaudeModelOptions(catalog: readonly ClaudeModelEntry[], available: readonly string[], enabledModelIds: readonly string[], overrides: Record<string, number>): ClaudeModelOption[];
export interface ClaudeStatusOptions {
    fetchFn?: typeof fetch;
    /** Whether this plugin currently owns the provider route; re-read on every status. */
    serving?: boolean | (() => boolean);
    /** Diagnostic when another plugin owns the provider route; re-read on every status. */
    conflict?: string | null | (() => string | null);
    /** Multi-account pool this line schedules through; absent keeps the single-account card. */
    accountPool?: ClaudeAccountPool;
    /**
     * Test seam for the model listing.
     *
     * Defaults to 'client.ts''s loader against the resolved credential; injected so
     * a test drives the card without a network round trip.
     */
    loadCatalog?: (credentials: ClaudeCredentials) => Promise<readonly ClaudeModelEntry[]>;
    /** Test seam for adoption: the paths the reader consults. */
    adoptPaths?: readonly string[];
    /**
     * Test seam for the sign-in flow.
     *
     * Mirrors 'oauth.ts''s own BeginLoginOptions so a test never opens a browser
     * and never binds a loopback port. The route always overrides fetchFn with the
     * one it was registered with, so the flow and the rest of the surface share a
     * single fetch.
     */
    login?: Omit<BeginLoginOptions, 'fetchFn'>;
}
/**
 * Everything the settings card renders: the account, the catalog, the quota.
 *
 * Exported so a caller (and a test) can render the same payload the route
 * returns without going through the HTTP surface.
 */
export declare function getClaudeWebStatus(store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences: ClaudePreferenceStore | undefined, options?: ClaudeStatusOptions, quotaError?: string | null, 
/** Credential and id the route already resolved for this request. */
active?: {
    id: string | undefined;
    credentials: ClaudeCredentials | undefined;
}): Promise<ClaudeWebStatus>;
/**
 * Register the Claude subscription settings routes under '/claude/api'.
 *
 * Returns the disposer. Registration is UNCONDITIONAL: the card's status poll is
 * how the user learns whether this plugin owns the provider route, so the
 * surface has to answer even when another adapter family holds the id.
 */
export declare function registerClaudeRoutes(ctx: Context, store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: ClaudePreferenceStore, options?: ClaudeStatusOptions): () => void;
/** The same check, exposed so the test suite can assert it without importing order games. */
export declare function claudeReasoningEffortDrift(): {
    missing: string[];
    extra: string[];
};
export { DEFAULT_CONTEXT_WINDOW, PROVIDER_ID, PROVIDER_NAME, getCachedQuota, clearCachedQuota, clearCachedCatalog, claudeCodeCredentialPaths, claudeCodeCredentialPresence, type ClaudeAccountSummaryDto, };
//# sourceMappingURL=routes.d.ts.map