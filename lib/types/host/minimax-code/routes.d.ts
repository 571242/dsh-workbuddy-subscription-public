/**
 * Web routes for the MiniMax Code line.
 *
 * The six routes below are the frozen contract the client half consumes (brief
 * section 3). Their paths, request bodies and verdicts are therefore not free:
 * this file implements them as specified rather than as this line might prefer.
 *
 * Response envelope: every route answers \`{ ok: true, value: <payload> }\`, which is
 * what the sibling lines in this package use. The three routes whose contract names
 * a top-level key as well (\`/login/start\` -> \`login\`, \`/login/poll\` -> \`status\` and
 * \`account\`, \`/test\` -> \`ok\`/\`model\`/\`error\`) carry that key at the top level too,
 * so a client written against either reading resolves. \`/test\` is the one route
 * where the envelope's \`ok\` cannot double as the payload's: its contract defines
 * \`ok\` as the probe verdict, so the envelope there is the verdict itself and the
 * duplicate lives under \`value\`.
 *
 * Mounting: the routes are registered under BOTH the contract prefix and the
 * sibling-line convention, because the two disagree in this repository and the
 * client half must not be able to miss them for that reason alone.
 *
 * \`/models\` and \`/settings\` are the model-settings half every sibling line has and
 * this one shipped without. They are two names for one route because the sibling
 * cards disagree about which to call: kimi-code and claude call it \`/models\`,
 * workbuddy and command-code call it \`/settings\`. Serving both costs one string
 * comparison and removes a client-side special case.
 */
import type { Context } from '@deepseek-ai/cordis';
import { MINIMAX_CODE_PROVIDER_ID, type MinimaxCodeWebStatus } from '../../shared/minimax-code-contracts.ts';
import { type MinimaxCodeAccountPool } from './account-pool.ts';
import { MinimaxCodeCredentialStore, MinimaxCodeModelSettingsStore, type MinimaxCodeModelSettings, type MinimaxCodePreferenceStore, type MinimaxCodeSettingsPatch } from './token-store.ts';
import { ensureAccessToken, getWebLogin } from './oauth.ts';
import type { MinimaxCodeCheckinService } from './checkin.ts';
/** The sub-path one request addresses, whichever prefix it arrived under. */
export declare function subPathOf(requestUrl: string): string;
/**
 * The stored selection, however this deployment persists it.
 *
 * The routes accept either shape so a composition that still has the register
 * settings seam and one that only has the file both work: the caller passes
 * whichever it wired, and nothing in this file needs to know which it got. The
 * patch type is the store's own, deliberately, so a field added to the settings
 * document cannot become one this route accepts but the stores silently drop.
 */
export interface MinimaxCodeSettingsSource {
    /** Current selection: a value on the register seam, a read on the file store. */
    status(): Promise<MinimaxCodeModelSettings> | MinimaxCodeModelSettings;
    update(patch: MinimaxCodeSettingsPatch): Promise<MinimaxCodeModelSettings>;
}
export interface MinimaxCodeStatusOptions {
    fetchFn?: typeof fetch;
    /** Whether this plugin currently owns the provider route; re-read on every status. */
    serving?: boolean | (() => boolean);
    /** Diagnostic when another plugin owns the provider route; re-read on every status. */
    conflict?: string | null | (() => string | null);
    /**
     * Where the model selection lives.
     *
     * Omitted, the routes read the default settings file, which is what a caller
     * that only wants the connection half of the card gets. The plugin entry
     * supplies the same store the adapter was built with, so the card and the
     * request path can never read two different selections.
     */
    settings?: MinimaxCodeSettingsSource;
    /**
     * The account pool, when this process installed one.
     *
     * Omitting it is a supported posture: the line then behaves as the
     * single-credential route it was before the pool existed, and the status
     * reports `poolInstalled: false` so the card can say so rather than render an
     * empty account list that looks like a bug.
     */
    accountPool?: MinimaxCodeAccountPool;
    /** Daily check-in scheduler; absent leaves the card's check-in row empty. */
    checkin?: Pick<MinimaxCodeCheckinService, 'tick' | 'summary'>;
}
/** Everything the settings card renders. */
export declare function getMinimaxCodeWebStatus(store: MinimaxCodeCredentialStore, options?: MinimaxCodeStatusOptions, settingsSource?: MinimaxCodeSettingsSource): Promise<MinimaxCodeWebStatus>;
export declare function registerMinimaxCodeRoutes(ctx: Context, store?: MinimaxCodeCredentialStore, options?: MinimaxCodeStatusOptions, modelSettings?: MinimaxCodeModelSettingsStore, preferences?: MinimaxCodePreferenceStore): () => void;
/** Test seam: forget which sign-in the status route reports. */
export declare function resetLatestLogin(): void;
export { MINIMAX_CODE_PROVIDER_ID, getWebLogin, ensureAccessToken };
//# sourceMappingURL=routes.d.ts.map