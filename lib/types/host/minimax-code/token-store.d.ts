/**
 * Credential storage for the MiniMax Code line.
 *
 * Unlike every other line in this package, this one does not own its credential
 * format: MiniMax Code itself keeps the signed-in session in
 * `~/.minimax/auth/<buildEnv>/<region>/mcode-public/auth.json`, and the whole
 * point of reusing it is that a user who is already signed in to the desktop app
 * does not sign in again here.
 *
 * That sharing is the design constraint:
 *
 * 1. READ-ONLY FIRST. Every call reads the file and uses the stored token when it
 *    is still valid; the plugin never rotates a credential it does not have to.
 * 2. WRITE-BACK IS ATOMIC. A rotated token replaces the file through a temporary
 *    file plus `rename`, so a failed or interrupted refresh leaves the previous
 *    `auth.json` byte-for-byte intact — the requirement the brief states at
 *    section 2.6.4.
 * 3. NO LOCK IS TAKEN. MiniMax Code holds `auth.lock` while it refreshes, and a
 *    second process must not create, delete or wait on that file: doing so could
 *    break the app's own refresh. Atomic replacement is what makes lock-free
 *    sharing safe instead — a reader sees either the whole old file or the whole
 *    new one, never a half-written one, and the record's key is preserved so the
 *    app finds its own entry where it left it.
 * 4. THE SHAPE IS PRESERVED. `schemaVersion` and every other record in
 *    `records` survive a write untouched; only the `mcode-public` record and the
 *    matching `auth-state.json` fields change.
 *
 * A credential this plugin obtained itself (device-code login with no native file
 * present) is kept in the plugin's own store under `$DSH_HOME/storages`, so the
 * two provenances never overwrite each other.
 */
import { type ContextWindowOverridePatch } from '../common/context-window-overrides.ts';
import type { MinimaxCodeReasoningEffort, MinimaxCodeRegion } from '../../shared/minimax-code-contracts.ts';
/** Where the credential and the token came from. */
export type MinimaxCodeCredentialSource = 'minimax-native' | 'file';
/**
 * One MiniMax Code subscription credential.
 *
 * Field names follow `auth.json` exactly; nothing is renamed on the way in or
 * out, so a round trip cannot lose a field the desktop app depends on.
 */
export interface MinimaxCodeCredentials {
    /** Bearer access token for the agent API. Host-only; never sent to a browser. */
    accessToken: string;
    /** Rotating refresh token. Host-only. */
    refreshToken: string;
    /** Always "Bearer" in the measured file; kept verbatim. */
    tokenType: string;
    /** Public client the record belongs to. */
    clientId: string;
    /** Scopes the token was issued for. */
    scopes: string[];
    /** Audience the token was issued for. */
    audience: string;
    /** Unix milliseconds the access token stops being valid. */
    expiresAtMs: number;
    /** Rotations the credential has been through; incremented on every refresh. */
    generation: number;
    /** Identity of the sign-in that produced the credential. */
    loginEpoch: string;
    /** Build environment segment of the path the credential lives under. */
    buildEnv: string;
    /** Region the credential was issued in. */
    region: MinimaxCodeRegion;
    /** Record key inside `auth.json`, preserved verbatim so a write lands in place. */
    recordKey: string | null;
    /** Whether this credential is the desktop app's file or the plugin's own. */
    source: MinimaxCodeCredentialSource;
    /** Unix milliseconds this plugin read or wrote the credential. */
    seenAt?: number;
}
/** The MiniMax home directory: the desktop app's data root. */
export declare function minimaxHomeDir(env?: NodeJS.ProcessEnv): string;
/** Directory holding one region's auth files. */
export declare function authDirFor(region: MinimaxCodeRegion, buildEnv?: string): string;
/** Path of the desktop app's credential file for one region. */
export declare function authJsonPath(region: MinimaxCodeRegion, buildEnv?: string): string;
/** Path of the desktop app's non-secret state file for one region. */
export declare function authStateJsonPath(region: MinimaxCodeRegion, buildEnv?: string): string;
/** Path of the plugin's own credential file, used when no native file exists. */
export declare function pluginCredentialPath(): string;
/**
 * Validate and normalize one stored credential.
 *
 * A payload that is missing a token or an expiry is rejected rather than
 * defaulted: a credential with an invented expiry would be presented to the
 * service as valid when it is not, which is exactly the failure the refresh path
 * exists to prevent.
 */
export declare function parseMinimaxCodeCredentials(value: unknown, fallback: {
    region: MinimaxCodeRegion;
    buildEnv?: string;
    recordKey?: string | null;
    source?: MinimaxCodeCredentialSource;
}): MinimaxCodeCredentials;
/** Whether a credential is valid for long enough to use as-is. */
export declare function credentialIsFresh(credentials: MinimaxCodeCredentials, now?: number): boolean;
/**
 * Whether a credential should be renewed BEFORE it can be refused.
 *
 * {@link credentialIsFresh} answers "can this token be presented right now"; this
 * answers "is it worth rotating on this plugin's own schedule instead of waiting
 * for the service to say no". The two questions need different answers: the whole
 * one-hour sign-out was the second question being answered with the first, so the
 * line only ever rotated inside the last sixty seconds of a sixty-minute token —
 * exactly the window in which concurrent callers spend the same rotating refresh
 * token, and exactly the window in which a request can already be refused.
 *
 * The desktop app reads the same file and remains the first authority for it: this
 * plugin renews a few minutes early, writes the rotation back atomically, and
 * never touches the app's own `auth.lock`.
 */
export declare function credentialNeedsRefresh(credentials: MinimaxCodeCredentials, now?: number): boolean;
/** Test seam: forget the snapshot, so one case cannot observe another's read. */
export declare function resetMinimaxCodeCredentialReads(): void;
/**
 * Whether two credentials are two generations of ONE session.
 *
 * The file this line reads holds a single record, but the plugin's own file is a
 * mirror that the pool writes for whichever account is primary — so a credential
 * read from storage may belong to a completely different account than the one a
 * caller is working on. Adopting a stranger's token would present one account's
 * session as another's, which is the one mistake this whole line must never make.
 *
 * The identity is therefore the same one {@link rotationKey} uses: a native record
 * slot, or the sign-in that produced a plugin-owned credential.
 */
export declare function minimaxCodeSameCredentialSession(a: MinimaxCodeCredentials | null, b: MinimaxCodeCredentials | null): boolean;
/**
 * Whether one credential is a LATER state of another.
 *
 * The generation is the desktop app's own rotation counter and the expiry moves
 * forward with every rotation, so either being greater means the candidate is the
 * result of a rotation the baseline predates. This is also what stops a stale copy
 * from rolling a newer state back: a pool row the mirror could not write must never
 * overwrite a fresh file.
 */
export declare function minimaxCodeCredentialAdvancedPast(candidate: MinimaxCodeCredentials | null, baseline: MinimaxCodeCredentials): boolean;
/**
 * Rotate one credential, or adopt the rotation somebody else is doing.
 *
 * The distinction matters: a caller that ADOPTED a result must use the credential
 * that comes back, because the winner replaced the whole record.
 */
export declare function rotateMinimaxCodeCredential(store: MinimaxCodeCredentialStore, credentials: MinimaxCodeCredentials, perform: () => Promise<MinimaxCodeCredentials>, options?: {
    signal?: AbortSignal;
}): Promise<{
    credentials: MinimaxCodeCredentials;
    adopted: boolean;
}>;
/** Test seam: forget every rotation, so one test cannot leak into the next. */
export declare function resetMinimaxCodeRotations(): void;
/**
 * The credential store for this line.
 *
 * `read()` prefers the desktop app's file and falls back to the plugin's own, so
 * a user who signed in through either path is served. `write()` returns the
 * credential to the file it came from, which is what keeps the two provenances
 * from clobbering each other.
 */
export declare class MinimaxCodeCredentialStore {
    private readonly region;
    constructor(region?: MinimaxCodeRegion);
    /** Path of the file the next read or write targets. */
    path(): string;
    private readNative;
    private readPluginFile;
    read(): Promise<MinimaxCodeCredentials | null>;
    /** Resolve once every operation already queued for this store's file settled. */
    private drain;
    /**
     * Read storage, ignoring the snapshot.
     *
     * Used by the rotation path, where the whole question is whether somebody else
     * has already replaced the credential: a cached answer would report the very
     * state the caller is trying to move past. This is also what makes a rotation
     * observable at all - the desktop app's write is only visible by reading the
     * file again.
     */
    readFresh(): Promise<MinimaxCodeCredentials | null>;
    /**
     * The credential in force plus where it came from, in one pass.
     *
     * A status response needs all three facts, and each of the targeted accessors
     * re-reads and re-parses the native document (a file read plus a JSON parse per
     * region probed). Reading once here keeps one /status call from doing that work
     * three times, which matters because the settings card polls this route.
     */
    readWithProvenance(): Promise<{
        credentials: MinimaxCodeCredentials | null;
        source: MinimaxCodeCredentialSource;
        path: string;
    }>;
    /** Which file the credential currently in force lives in. */
    activeSource(): Promise<MinimaxCodeCredentialSource>;
    /**
     * Persist a credential back where it came from.
     *
     * A native credential is written into the existing record, preserving the
     * document's `schemaVersion` and every other record; a plugin credential is
     * written to the plugin's own file. Either way the write is atomic.
     */
    write(credentials: MinimaxCodeCredentials): Promise<void>;
    /**
     * One write, to whichever file the credential came from.
     *
     * Called with the destination already held by {@link write}'s `serialize`; it
     * must NOT claim the same chain again, or the outer frame would be waiting on the
     * inner one while the inner one waits on the outer.
     */
    private writeOnce;
    /**
     * Forget the credential this plugin owns.
     *
     * The desktop app's `auth.json` is deliberately left alone: it is not this
     * plugin's to delete, and removing it would sign the user out of MiniMax Code
     * itself. A credential this store is only *reading* from the app therefore
     * remains in force after a sign-out, which the status route reports so the
     * user is not told a session ended when it did not.
     */
    delete(): Promise<void>;
}
/** Namespace the model selection is registered under on a register-capable harness. */
export declare const MINIMAX_CODE_PREFERENCES_NAMESPACE = "dsh-minimax-code";
/**
 * The model-selection half of this line's settings.
 *
 * The catalog (`MINIMAX_CODE_MODELS`) is deliberately not stored here. A shipped
 * catalog changes with the code, so persisting a copy of it would leave a user
 * whose file is a release behind reading a model list the build no longer serves;
 * only the user's own choices live in this document.
 */
export interface MinimaxCodeModelSettings {
    /** Line-wide switch. Absent means enabled: this line shipped enabled. */
    enabled?: boolean;
    /** Catalog ids DSH offers in the conversation model picker. */
    enabledModelIds: string[];
    /** Per-model context window, replacing the catalog's own number. */
    contextWindowOverrides: Record<string, number>;
    /** Level used when a conversation picks none; null means the model's own. */
    defaultReasoningEffort: MinimaxCodeReasoningEffort | null;
    /** Daily check-in scheduler switch. Absent means enabled. */
    checkin?: {
        enabled: boolean;
    };
}
/**
 * One settings patch.
 *
 * `contextWindowOverrides` is a patch rather than the whole map because `null`
 * has to survive as a value: it is the settings card's "restore the catalog
 * default" and deletes exactly one key. A full replacement could not express
 * that without the caller first reading the document it wants to edit.
 */
export interface MinimaxCodeSettingsPatch {
    enabled?: boolean;
    enabledModelIds?: string[];
    contextWindowOverrides?: ContextWindowOverridePatch;
    defaultReasoningEffort?: MinimaxCodeReasoningEffort | null;
    checkin?: {
        enabled: boolean;
    };
}
/**
 * The seam the routes and the adapter share.
 *
 * `status()` is synchronous on purpose: it is read on every model-picker query
 * and on every settings-card poll, and both callers only need a snapshot. A
 * promise-shaped reader here would make each of them await a file read on a hot
 * path for a value that changes at human speed.
 */
export interface MinimaxCodePreferenceStore {
    /**
     * The file-backed store warms up asynchronously, so `status()` answers from
     * shipped defaults until that read settles. A caller that acts on a
     * preference at startup — the check-in scheduler signing in on boot — must
     * await this first, or it acts on the default instead of the user's choice.
     * A register-backed store reads synchronously and resolves immediately.
     */
    ready(): Promise<void>;
    status(): MinimaxCodeModelSettings;
    update(patch: MinimaxCodeSettingsPatch): Promise<MinimaxCodeModelSettings>;
}
/** Path of the settings file used when no settings service is present. */
export declare function modelSettingsPath(): string;
/**
 * Apply one patch to one settings document.
 *
 * The merge lives outside both stores because the register-backed store has to
 * normalize the scope's value through the same rules the file store applies; two
 * copies of this logic is how the two storage paths drift apart the first time
 * one of them learns a new field.
 */
export declare function mergeMinimaxCodeSettings(current: MinimaxCodeModelSettings, patch: MinimaxCodeSettingsPatch): MinimaxCodeModelSettings;
/**
 * The settings file beside the credentials.
 *
 * This is what a harness without the register seam (0.1.7, and a headless host)
 * reads back on boot, so it is the store that has to survive a crash: the write
 * is a temporary sibling plus `rename`, and the document just written is read
 * back and compared before the write is reported as done. Without the read-back
 * a partial write, or a filesystem that dropped the rename, would report a
 * selection the next boot does not agree with — the card would show a model
 * grid the adapter never applies.
 */
export declare class MinimaxCodeModelSettingsStore {
    private readonly filePath;
    constructor(filePath?: string);
    path(): string;
    read(): Promise<MinimaxCodeModelSettings>;
    write(settings: MinimaxCodeModelSettings): Promise<void>;
    /**
     * Read-modify-write under the same per-path lock the credential writes use.
     *
     * Without it two patches landing together each read the same document and the
     * second write silently discards the first — a lost model selection, with no
     * error anywhere. The lock is shared with the credential paths because it is
     * keyed by resolved path, and the two never name the same file.
     */
    updateSettings(patch: MinimaxCodeSettingsPatch): Promise<MinimaxCodeModelSettings>;
}
/**
 * Bind the model selection to the DSH settings document when the harness still
 * offers one, and to the JSON file beside it otherwise: a harness without the
 * register seam (0.1.7, and a headless host) reads that file back on boot.
 */
export declare function registerMinimaxCodePreferenceStore(settings?: unknown, fallbackStore?: MinimaxCodeModelSettingsStore): MinimaxCodePreferenceStore;
//# sourceMappingURL=token-store.d.ts.map