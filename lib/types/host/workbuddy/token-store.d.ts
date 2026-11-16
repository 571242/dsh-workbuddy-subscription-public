import type { WorkBuddyCheckinSettings, WorkBuddyReasoningEffort, WorkBuddyRegion } from '../../shared/workbuddy-contracts.ts';
import { type ContextWindowOverridePatch } from '../common/context-window-overrides.ts';
import { type WorkBuddyGuardrails } from './guardrails.ts';
import { type WorkBuddyOutboundSetting } from './outbound-identity.ts';
import type { CredentialStore } from '../token-store.ts';
import { isIntlDomain } from './types.ts';
export declare const WORKBUDDY_PREFERENCES_NAMESPACE = "dsh-workbuddy";
export type { WorkBuddyReasoningEffort };
/**
 * One WorkBuddy credential, parsed from a CodeBuddy desktop `*.info` file.
 *
 * These files are the IDE's own credential store, not this plugin's: the plugin
 * reads them so a user who is already signed in to the IDE needs no second
 * login. A refreshed token is written back so both clients stay valid instead of
 * racing each other with a rotating refresh token.
 */
export interface WorkBuddyCredentials {
    /** Bearer token for the chat and billing APIs. Host-only. */
    accessToken: string;
    /** Rotating refresh token. Host-only. */
    refreshToken: string;
    /** Unix milliseconds the access token stops being valid. */
    expiresAt: number;
    /** Region the account belongs to; decides which backend serves it. */
    region: WorkBuddyRegion;
    /** Auth domain recorded in the file, e.g. `copilot.tencent.com`. */
    domain: string;
    /** Backend base URL derived from {@link domain}. */
    backend: string;
    uid?: string;
    nickname?: string;
    uin?: string;
    accountType?: string;
    enterpriseId?: string;
    /** Absolute path of the `*.info` file this credential came from. */
    sourceFile: string;
    /** File modification time when it was read, so a stale cache is detectable. */
    sourceMtimeMs: number;
    /** Which store owns the secret; only managed credentials may be deleted. */
    source: 'desktop' | 'managed';
    /**
     * Sealed token material, when the file holds `$wbEncrypted` envelopes.
     *
     * The desktop client stopped writing plaintext tokens on 2026-09-24, so a
     * credential read from such a file has no usable `accessToken` until the
     * at-rest key opens these. They are kept verbatim here — never logged, never
     * sent anywhere — and resolved by {@link unsealCredentials}.
     */
    sealed?: {
        accessToken?: unknown;
        refreshToken?: unknown;
    };
}
export interface WorkBuddyModelSettings {
    enabled?: boolean;
    enabledModelIds: string[];
    contextWindowOverrides: Record<string, number>;
    defaultReasoningEffort: WorkBuddyReasoningEffort | null;
    /** Stable account key selected by the user; null keeps automatic selection. */
    selectedAccountId: string | null;
    /** Desktop accounts hidden from this plugin without deleting CodeBuddy files. */
    hiddenAccountIds: string[];
    /** Daily check-in scheduler preferences. */
    checkin: WorkBuddyCheckinSettings;
    /**
     * Which outbound client identity requests present.
     *
     * `auto` assigns one product per account (stable for the account's life);
     * anything else pins it line-wide. The default is the identity this line has
     * always sent, so an untouched install behaves exactly as before.
     */
    outboundIdentity: WorkBuddyOutboundSetting;
    /** Local quota guardrails; all-off by default. */
    guardrails: WorkBuddyGuardrails;
}
export interface WorkBuddyPreferenceStore {
    /**
     * Resolve once the store has read whatever it was going to read.
     *
     * The file-backed store warms up asynchronously, so `status()` answers from
     * shipped defaults until that read settles. A caller that acts on a
     * preference at startup — the check-in scheduler signing in on boot — must
     * await this first, or it acts on the default instead of the user's choice.
     * A register-backed store reads synchronously and resolves immediately.
     */
    ready(): Promise<void>;
    status(): WorkBuddyModelSettings;
    update(patch: {
        enabled?: boolean;
        enabledModelIds?: string[];
        /** `null` deletes one override and falls back to the catalog default. */
        contextWindowOverrides?: ContextWindowOverridePatch;
        defaultReasoningEffort?: WorkBuddyReasoningEffort | null;
        selectedAccountId?: string | null;
        hiddenAccountIds?: string[];
        checkin?: Partial<WorkBuddyCheckinSettings>;
        outboundIdentity?: WorkBuddyOutboundSetting;
        guardrails?: Partial<WorkBuddyGuardrails>;
    }): Promise<WorkBuddyModelSettings>;
}
/** Shipped check-in default: on. */
export declare const DEFAULT_CHECKIN_SETTINGS: WorkBuddyCheckinSettings;
/**
 * Narrow an unknown stored/patched value into valid check-in settings.
 *
 * Documents written while the window was still configurable may carry
 * startHour/endHour; those keys are inert now and dropped on the next write.
 */
export declare function normalizeCheckinSettings(value: unknown): WorkBuddyCheckinSettings;
/**
 * Bind the model selection to the DSH settings document when the harness still
 * offers one, and to the JSON file beside it otherwise: a harness without the
 * register seam (0.1.7, and a headless test) reads that file back on boot.
 */
export declare function registerWorkBuddyPreferenceStore(settings?: unknown, fallbackStore?: FileModelSettingsStore): WorkBuddyPreferenceStore;
/**
 * Credential directory the CodeBuddy desktop client writes to.
 *
 * `CODEBUDDY_AUTH_DIR` overrides it, matching the environment variable the
 * official tooling honours, which is also what makes the scan testable without
 * touching a real profile.
 */
export declare function codeBuddyAuthDir(): string;
/** Plugin settings file, used when no settings service is present. */
export declare function modelSettingsPath(): string;
/** Encrypted account pool for credentials added through this plugin. */
export declare function managedCredentialsPath(): string;
/** Platform-encrypted storage for the pasted at-rest key (never plaintext on disk). */
export declare function atRestKeyPath(): string;
/**
 * Storage for the `$wbEncrypted` protector key.
 *
 * The key is the one secret that unlocks the desktop client's tokens, so it goes
 * through the same platform store the managed pool uses (DPAPI / Keychain /
 * Secret Service) and is installed into the process only after the client's own
 * keyblob accepts it. A pasted value that fails that check never displaces a
 * working key.
 */
export declare class WorkBuddyAtRestKeyStore {
    private readonly filePath;
    private readonly backend;
    private cached;
    constructor(filePath?: string, backend?: CredentialStore<{
        version: 1;
        keyHex: string;
    }>);
    /** Human-readable storage description, mirroring the managed pool's. */
    path(): string;
    /**
     * Load the stored key into the process.
     *
     * Called once at startup: the credential readers consult the module-level
     * slot, so a key that is only on disk would otherwise leave every sealed
     * account unreadable until something else triggered a load.
     */
    load(): Promise<Buffer | null>;
    /** Validate and persist a pasted secret; returns the key id for display. */
    adopt(text: string): Promise<string>;
    /** Forget the key, both on disk and in this process. */
    clear(): Promise<void>;
}
/**
 * Parse one CodeBuddy `*.info` payload.
 *
 * Only the fields this plugin needs are read; the file also carries the IDE's
 * own account bookkeeping, which is deliberately left untouched. A file without
 * a usable access token is rejected rather than half-accepted, so the scanner
 * can move on to the next candidate.
 */
export declare function parseCredentialFile(value: unknown, sourceFile: string, sourceMtimeMs?: number): WorkBuddyCredentials;
/** Whether a credential is at or near expiry; refreshed a minute early. */
export declare function isExpired(credentials: WorkBuddyCredentials, now?: number): boolean;
/**
 * Stable public key for selecting an account without exposing a token or tying
 * the preference to a timestamped snapshot filename.
 *
 * The chain is uid → uin → nickname → domain, and the reason it is safe is
 * **ordering**: {@link withResolvedIdentity} settles a credential's uid from
 * its own token before any id is derived, so a real sign-in and the IDE's file
 * for the same account both reach the uid branch and agree. The nickname rung
 * is only reached by a token whose claims cannot be read at all, and keeping it
 * there is what stops two such accounts in one region from collapsing onto the
 * shared deployment key below it.
 *
 * A nickname must therefore never be the *first* rung: that is what split one
 * account into two pool rows, because the browser-login response states the
 * display name while the IDE's file states the uid. Likewise the uid must be
 * settled *before* the id is minted, which is why the heal runs inside the
 * credential parsers and the pool's own account creation.
 */
export declare function workBuddyAccountId(credentials: Pick<WorkBuddyCredentials, 'region' | 'uid' | 'uin' | 'nickname' | 'domain'>): string;
/**
 * Every key one credential may have been addressable under.
 *
 * A settings document written before the identity fix pinned and hid accounts
 * by the old chain (`uid → uin → nickname → domain`), so an account that only
 * had a nickname stored was addressed as `region:<nickname>`. The heal moves
 * that account to its uid, and without this alias the stored pointer would
 * silently stop matching — a pinned account would fall back to automatic
 * routing and a hidden one would reappear. Callers therefore accept either
 * spelling; only the current one is ever written.
 */
export declare function workBuddyAccountIdAliases(credentials: Pick<WorkBuddyCredentials, 'region' | 'uid' | 'uin' | 'nickname' | 'domain'>): string[];
/** Strict parser for credentials owned by the plugin's encrypted pool. */
export declare function parseManagedCredentials(value: unknown): WorkBuddyCredentials[];
/**
 * Candidate ordering for the scanned credential files.
 *
 * A user's auth directory accumulates timestamped snapshots beside the live
 * file, and the live one is not always the newest. Preference order is: the
 * plain `workbuddy-desktop.info` / `codebuddy-desktop.info` files first, then
 * the newest `expiresAt` among the timestamped snapshots. Picking purely by
 * mtime selected a stale snapshot during development, so the token's own
 * expiry is what decides.
 */
/** What the last credential scan observed about sealed (`$wbEncrypted`) files. */
export interface SealedCredentialDiagnostics {
    /** Sealed credential files the scan met. */
    sealedFiles: number;
    /** Of those, how many the held key opened. */
    opened: number;
    /** True when at least one sealed file was skipped because no key is held. */
    missingKey: boolean;
    /** Why the last sealed file refused to open, when it did. */
    lastError: string | null;
}
/** Snapshot of the last scan's sealed-credential observations. */
export declare function sealedCredentialDiagnostics(): SealedCredentialDiagnostics;
/**
 * Resolve a credential's sealed tokens into usable plaintext.
 *
 * Returns `null` when the credential is sealed and this process holds no key
 * that opens it: such a file is not an error the caller can act on per-file, it
 * is a missing key the settings card reports once.
 */
export declare function unsealCredentials<T extends WorkBuddyCredentials>(credentials: T): T | null;
/**
 * Scan the CodeBuddy auth directory for usable credentials.
 *
 * Every `*.info` file is considered; unreadable or malformed ones are skipped
 * rather than failing the whole scan, because the directory routinely holds
 * expired snapshots next to the live credential.
 */
export declare function scanCredentials(dir?: string): Promise<WorkBuddyCredentials[]>;
/** Encrypted credentials added through the WorkBuddy settings page. */
export declare class ManagedCredentialStore {
    private readonly filePath;
    private readonly backend;
    constructor(filePath?: string, backend?: CredentialStore<{
        version: 1;
        accounts: WorkBuddyCredentials[];
    }>);
    path(): string;
    private serialize;
    list(): Promise<WorkBuddyCredentials[]>;
    add(credentials: WorkBuddyCredentials): Promise<void>;
    update(credentials: WorkBuddyCredentials): Promise<void>;
    delete(accountId: string): Promise<boolean>;
}
/**
 * Credential store backed by the CodeBuddy desktop client's own auth files.
 *
 * The plugin does not own these files, so there is nothing to encrypt here: the
 * secret is the IDE's, already on disk, and the only write this store performs
 * is an atomic write-back of a refreshed token so the IDE does not lose its
 * session. Tokens are never sent to a browser.
 */
export declare class FileCredentialStore {
    private readonly dir;
    /** How long a scan result is reused before the directory is re-read. */
    private readonly cacheTtlMs;
    private readonly managed;
    private cached;
    private scannedAt;
    /** Serializes refresh/write-back per account; different accounts never share a token. */
    private readonly refreshInFlight;
    constructor(dir?: string, 
    /** How long a scan result is reused before the directory is re-read. */
    cacheTtlMs?: number, managed?: ManagedCredentialStore);
    /** Directory this store scans. */
    directory(): string;
    /** Human-readable storage description for the settings card. */
    path(): string;
    managedPath(): string;
    /** Read the selected credential, or the best visible candidate in automatic mode. */
    read(options?: {
        force?: boolean;
        accountId?: string | null;
        hiddenAccountIds?: readonly string[];
    }): Promise<WorkBuddyCredentials | null>;
    /** Whether a cached credential's source file is unchanged on disk. */
    private isStillCurrent;
    /**
     * All distinct usable accounts, best credential first.
     *
     * The desktop directory keeps historical snapshots. They are credentials for
     * the same account, not additional account choices, so only the first (best)
     * candidate for each stable account id is exposed.
     */
    list(): Promise<WorkBuddyCredentials[]>;
    /**
     * Desktop credentials only, best first.
     *
     * The account pool adopts these so the IDE's own sign-ins take part in
     * scheduling. Unlike {@link list} this never mixes in managed accounts:
     * only the desktop set is re-adopted when the IDE changes its directory.
     */
    discoverDesktopCredentials(): Promise<WorkBuddyCredentials[]>;
    /**
     * Re-read one desktop credential file.
     *
     * A pooled desktop account must serve the IDE's current token rather than
     * the copy taken when it was adopted, because the IDE rotates that token on
     * its own schedule. Returns null when the file is gone or unreadable.
     */
    readDesktopFile(filePath: string): Promise<WorkBuddyCredentials | null>;
    addManaged(credentials: WorkBuddyCredentials): Promise<void>;
    deleteManaged(accountId: string): Promise<boolean>;
    /** Forget the cached scan; the next read re-reads the directory. */
    invalidate(): void;
    /**
     * Return a credential whose access token is valid, refreshing it first when
     * it is at or near expiry.
     *
     * Concurrent callers share one refresh: the refresh token rotates, so two
     * simultaneous refreshes would invalidate each other.
     */
    ensureFresh(credentials: WorkBuddyCredentials, refresh: (current: WorkBuddyCredentials) => Promise<WorkBuddyCredentials>): Promise<WorkBuddyCredentials>;
    /**
     * Persist a refreshed token back into the IDE's own credential file.
     *
     * Only the `auth` block is rewritten, and the write is atomic so a crash
     * cannot leave the IDE with a half-written file. A failure here is not fatal
     * to the in-flight request: the refreshed token still works for this process,
     * and the next scan simply finds the older token on disk.
     */
    writeBack(credentials: WorkBuddyCredentials): Promise<void>;
}
/** Plain-JSON model settings used when the settings service is unavailable. */
export declare class FileModelSettingsStore {
    private readonly filePath;
    constructor(filePath?: string);
    path(): string;
    read(): Promise<WorkBuddyModelSettings>;
    write(settings: WorkBuddyModelSettings): Promise<void>;
    updateSettings(patch: {
        enabled?: boolean;
        enabledModelIds?: string[];
        /** `null` deletes one override and falls back to the catalog default. */
        contextWindowOverrides?: ContextWindowOverridePatch;
        defaultReasoningEffort?: WorkBuddyReasoningEffort | null;
        selectedAccountId?: string | null;
        hiddenAccountIds?: string[];
        checkin?: Partial<WorkBuddyCheckinSettings>;
        outboundIdentity?: WorkBuddyOutboundSetting;
        guardrails?: Partial<WorkBuddyGuardrails>;
    }): Promise<WorkBuddyModelSettings>;
}
export { isIntlDomain };
//# sourceMappingURL=token-store.d.ts.map