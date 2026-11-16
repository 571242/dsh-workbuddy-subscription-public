import type { CredentialStore } from '../token-store.ts';
import type { AccountAuthStatus, AccountRotationStrategy, PoolAccountSummaryDto } from '../../shared/account-pool-contracts.ts';
/** Refresh an access token this many milliseconds before it expires. */
export declare const POOL_REFRESH_MARGIN_MS = 60000;
/** Accounts a single pool may hold before `addAccount` refuses another one. */
export declare const DEFAULT_MAX_POOL_ACCOUNTS = 20;
/**
 * The parts of a pooled account every provider line agrees on.
 *
 * A provider's own account type extends this with whatever non-secret display
 * facts its card renders (project id, key name, region, plan …).
 */
export interface PoolAccountShape<TCredentials> {
    id: string;
    alias: string;
    credentials: TCredentials;
    addedAt: number;
    lastUsedAt?: number;
    isPrimary?: boolean;
    cooldownUntil?: number;
    cooldownReason?: string;
    authStatus?: AccountAuthStatus;
    authFailedReason?: string;
}
/** One provider's whole pool document, as it lives in encrypted storage. */
export interface PoolData<TAccount> {
    version: 1;
    activeAccountId?: string;
    rotationStrategy: AccountRotationStrategy;
    accounts: TAccount[];
}
/** Everything the core hands a provider hook that mints an account record. */
export interface PoolAccountInput<TCredentials, TAccount> {
    id: string;
    alias: string;
    credentials: TCredentials;
    addedAt: number;
    isPrimary: boolean;
    /** The account this one replaces, when the dedupe key already exists. */
    existing?: TAccount;
}
/**
 * Provider-specific behaviour of one account pool.
 *
 * The storage, serialization, eligibility, rotation and cooldown rules live in
 * {@link AccountPoolCore}; only these hooks differ per provider line.
 */
export interface AccountPoolHooks<TCredentials, TAccount extends PoolAccountShape<TCredentials>, TSummary extends PoolAccountSummaryDto> {
    /** Provider id used in storage descriptions and diagnostics. */
    providerId: string;
    /** Human label used in the messages the core raises. */
    displayName: string;
    /** Plaintext path of the pool file; the encrypted variants derive from it. */
    poolFile: string;
    /** Keychain / Secret Service service name on macOS and Linux. */
    keychainService: string;
    /** Validate and normalize one whole pool document. */
    parsePoolData(value: unknown): PoolData<TAccount>;
    /** Mint an account record; the core only decides id, alias and primary flag. */
    createAccount(input: PoolAccountInput<TCredentials, TAccount>): TAccount;
    /** Identity two credentials share when they are the same upstream account. */
    dedupeKey?(credentials: TCredentials): string | undefined;
    /**
     * Stable id to store a new account under, instead of a generated one.
     *
     * A provider that already keys its accounts by a public, non-secret identity
     * (one that its stored settings also reference) returns that key here. Doing
     * so keeps every id the settings card sends back — a pinned account, a hidden
     * account — meaningful to the pool without a translation layer or a migration.
     */
    accountId?(credentials: TCredentials): string | undefined;
    /** Alias for an account whose credentials name nothing the user would recognize. */
    defaultAlias(credentials: TCredentials, position: number): string;
    /** Unix milliseconds the access token expires; absent for a non-expiring key. */
    expiresAt?(credentials: TCredentials): number | undefined;
    /** Whether the credential must be refreshed before the next request. */
    needsRefresh?(credentials: TCredentials, now: number): boolean;
    /** Refresh one credential, returning the value to persist back into the pool. */
    refresh?(credentials: TCredentials, fetchFn: typeof fetch): Promise<TCredentials>;
    /**
     * Classify a failed refresh.
     *
     * Returning a status takes that account out of rotation (it is kept, so a new
     * sign-in restores it) and lets the next eligible account serve the request.
     * Returning undefined lets the refresh error surface: a transient failure
     * must not cost an account its place in the pool.
     */
    refreshFailureStatus?(error: unknown): AccountAuthStatus | undefined;
    /**
     * Reason the stored credential is already known to be unusable (a rejected
     * refresh token, for instance). Reported purely: nothing is written here.
     */
    authRejectedReason?(credentials: TCredentials): string | undefined;
    /**
     * Best-effort repair for an account the pool no longer owns.
     *
     * The pool holds a COPY of an account's credential when one was adopted from
     * another application, and a copy can go stale: the moment either side rotates,
     * the refresh token the pool holds is spent. Recovery is not a refresh (that
     * would spend the dead token again) but a re-read of the authority, keeping the
     * authoritative copy only when it still describes the same account.
     *
     * Returning null means "no newer authority"; the pool then leaves the row alone.
     * Absent means the provider keeps no external authority at all.
     *
     * The "has it moved on" test belongs to the provider, which knows what identity
     * means for its credential: the core only asks for the authority and lets the
     * provider decide whether it is a newer state of the same account.
     */
    liveCredentialsFor?(account: TAccount): Promise<{
        credentials: TCredentials;
        advanced: boolean;
    } | null>;
    /**
     * Best-effort, local-store synchronization after a credential commit.
     *
     * Runs under the pool lock and only once the pool write is verified, so a
     * provider mirror can never get ahead of the pool. It must not re-enter the
     * pool, and a failure is swallowed: the committed pool is the authority.
     */
    credentialsCommitted?(account: TAccount): Promise<void>;
    /** Pre-pool single credential, projected as the primary account on read. */
    legacyAccount?(): Promise<TAccount | null>;
    /** Mirror the primary account into the single-credential store; `null` clears it. */
    mirrorPrimary?(credentials: TCredentials | null): Promise<void>;
    /**
     * Add the provider's own display facts (project id, key name, region …) to
     * the shared summary the core already filled in.
     */
    extendSummary?(account: TAccount, base: PoolAccountSummaryDto, now: number): TSummary;
    /** Message raised when the pool holds no account at all. */
    emptyMessage?: string;
    /**
     * Message raised when every account is cooling down or unusable.
     *
     * `waitMinutes` is null when NOTHING is cooling down: the caller then knows no
     * reset instant was measured and must not name one.
     */
    allUnavailableMessage?(count: number, waitMinutes: number | null): string;
    /**
     * Message raised when every unusable account is unusable because its
     * credential was rejected, and nothing is cooling down.
     *
     * Separate from {@link allUnavailableMessage} because the two conditions need
     * opposite actions: waiting versus signing in again. Reporting a rejected pool
     * as "rate limited, try again in N minutes" sent people to wait out a cooldown
     * that never started and would never end.
     */
    allAuthFailedMessage?(count: number): string;
    /** Accounts this pool accepts; defaults to {@link DEFAULT_MAX_POOL_ACCOUNTS}. */
    maxAccounts?: number;
    /**
     * Account the user pinned in settings, or null/absent for automatic choice.
     *
     * When set and the account is eligible, it is chosen ahead of the rotation
     * strategy; when it is ineligible the automatic choice takes over rather than
     * failing the request, because a pinned account that is cooling down must not
     * take the line offline.
     */
    preferAccountId?(): string | null;
    /** Test seam; production builds the platform backend from the paths above. */
    backend?: CredentialStore<PoolData<TAccount>>;
}
/** Stable keychain account name for one pool file, isolated per `DSH_HOME`. */
/** Accept a stored rotation strategy, or fall back to sequential. */
export declare function normalizeRotationStrategy(value: unknown): AccountRotationStrategy;
export declare function poolCredentialAccount(filePath: string): string;
/**
 * The shared multi-account pool: encrypted storage, eligibility filtering,
 * rotation strategy, 429 cooldowns and per-account auth failures.
 *
 * @typeParam TCredentials - the provider's stored credential shape.
 * @typeParam TAccount - the provider's pooled account record.
 * @typeParam TSummary - the public DTO the settings card renders.
 */
export declare class AccountPoolCore<TCredentials, TAccount extends PoolAccountShape<TCredentials>, TSummary extends PoolAccountSummaryDto> {
    protected readonly hooks: AccountPoolHooks<TCredentials, TAccount, TSummary>;
    private readonly filePath;
    private readonly backend;
    /**
     * Bumped by every write that can move which account serves a request.
     *
     * Reading it costs nothing — unlike {@link read}, which decrypts the pool file
     * (a DPAPI unprotect through a spawned `powershell.exe` on Windows, ~200 ms).
     * A cache that must not report one account's data under another account's name
     * can therefore invalidate on identity change without paying a credential read
     * to discover it.
     */
    /** Pool-file identity of this instance: locks, revisions and flights key on it. */
    private readonly operationKey;
    constructor(hooks: AccountPoolHooks<TCredentials, TAccount, TSummary>);
    /**
     * A cheap, in-memory revision of the pool's serving identity.
     *
     * Compared against a previously observed value to detect an account change
     * without decrypting the pool file. Every mutating write advances it, because
     * which account a request resolves to depends on more than membership:
     * eligibility reads `authStatus` and `cooldownUntil`, and the rotation
     * strategy reads `isPrimary`, `activeAccountId` and `lastUsedAt`. All of
     * those are written through {@link write}, so bumping it there covers every
     * one of them without having to enumerate them per mutator.
     * Over-invalidating only costs one credential read, while under-invalidating
     * would report one account's usage under another account's name.
     */
    currentIdentityRevision(): number;
    /** Human description of where this pool's credentials live. */
    path(): string;
    /**
     * Queue one storage transaction for this pool file.
     *
     * NOT reentrant: a transaction must use {@link loadPoolData} and
     * {@link updatePool} rather than calling the public read/write methods.
     */
    private serialize;
    private saveVerified;
    /**
     * Read the pool.
     *
     * A pool that holds no account yet projects the pre-pool single credential as
     * the primary account. That projection stays side-effect free on purpose:
     * every caller that changes the pool writes it back immediately afterwards,
     * so persisting it here only bought an extra encrypted round trip and made a
     * getter write to disk.
     */
    read(): Promise<PoolData<TAccount>>;
    /**
     * Load the pool without holding the file lock.
     *
     * Providers override this to maintain their own in-memory indexes, so every
     * load — including one inside {@link updatePool} — refreshes them.
     */
    protected loadPoolData(): Promise<PoolData<TAccount>>;
    private persistPoolData;
    /**
     * Replace the whole document (initialization, import), NOT a read-modify-write.
     * Prefer {@link updatePool} for mutations so the draft is read under the lock.
     */
    write(data: PoolData<TAccount>): Promise<void>;
    /**
     * Read the LATEST document, mutate it and persist it as one file transaction.
     *
     * This is the whole fix for the read-modify-write race: the old shape read a
     * snapshot, awaited (a token refresh, a settings write, an encrypted round
     * trip) and then wrote that whole stale snapshot back, erasing whatever landed
     * in between — including another account's freshly rotated token.
     *
     * The callback runs under the file lock, so it must not call read, write or
     * updatePool (the lock is not reentrant) and must not do network I/O.
     * Provider-local stores belong in `afterCommit`, which runs only once the
     * pool write is verified, and must not re-enter the pool either.
     */
    protected updatePool<T>(mutate: (data: PoolData<TAccount>) => T | Promise<T>, afterCommit?: (data: PoolData<TAccount>, result: T) => Promise<void>): Promise<T>;
    /** Public summaries, with cooldowns that already expired reported as absent. */
    listAccounts(): Promise<TSummary[]>;
    protected summarize(account: TAccount, now: number): TSummary;
    /** Add or re-authorize one account; an existing dedupe key updates in place. */
    addAccount(credentials: TCredentials, alias?: string): Promise<TAccount>;
    /**
     * Add or re-authorize inside an existing transaction.
     *
     * Capacity, dedupe and the primary decision are all taken against the live
     * document, so two simultaneous sign-ins cannot each pass a check the other
     * has already invalidated.
     */
    protected addAccountToPool(data: PoolData<TAccount>, credentials: TCredentials, alias?: string): TAccount;
    setPrimary(accountId: string): Promise<void>;
    /**
     * Persist a refreshed credential for one account.
     *
     * `expected` makes this a conditional write: when the stored credential is
     * no longer the one the caller started from, something newer won the race (a
     * re-login, a rotation committed while this call was in flight) and the
     * latest row is returned WITHOUT being overwritten. A deleted account is
     * never brought back.
     *
     * Used by a forced refresh (a 401 mid-request) rather than by the rotating
     * getEffectiveAccount path, which refreshes through its own single-flight.
     */
    updateAccountCredentials(accountId: string, credentials: TCredentials, expected?: TCredentials): Promise<TAccount | undefined>;
    setAlias(accountId: string, alias: string): Promise<void>;
    deleteAccount(accountId: string): Promise<void>;
    /**
     * Remove one account inside a transaction.
     *
     * Provider refusal rules (a snapshot this plugin does not own, a desktop
     * account it may only hide) belong in an override of this, so the check and
     * the removal cannot be separated by a concurrent change.
     */
    protected deleteAccountFromPool(data: PoolData<TAccount>, accountId: string): void;
    setStrategy(strategy: AccountRotationStrategy): Promise<void>;
    /** Cool one account down after an upstream 429. */
    markCooldown(accountId: string, durationMs: number, reason: string): Promise<void>;
    clearCooldown(accountId: string): Promise<void>;
    /**
     * Record that an account can no longer authenticate.
     *
     * The account stays in the pool: signing in again is what restores it, and a
     * deleted account would take the user's alias and ordering with it.
     */
    markAuthFailed(accountId: string, reason: string, status?: AccountAuthStatus): Promise<void>;
    clearAuthFailed(accountId: string): Promise<void>;
    /** Whether an account may serve a request right now. */
    protected isEligible(account: TAccount, now: number, triedAccountIds?: ReadonlySet<string>): boolean;
    hasAnotherAvailableAccount(triedAccountIds: ReadonlySet<string>): Promise<boolean>;
    /**
     * Read one account's credential for work that is *not* a metered model
     * request, without letting rotation state stand in the way.
     *
     * There are two different questions, and conflating them broke both:
     *
     * - "which account should serve this request?" — a routing decision, answered
     *   by {@link getEffectiveAccount} through cooldowns, auth status and the
     *   rotation strategy.
     * - "may I have a usable ChatGPT credential?" — a credential question, asked
     *   by the web search, web fetch and image tools.
     *
     * A spent Codex rate-limit window says nothing about the other ChatGPT
     * endpoints: search, fetch and image generation are not metered against it and
     * keep working with the very same token. Routing those tools through
     * {@link getEffectiveAccount} made one exhausted window fail all of them —
     * and reported it as "credentials are required", which sent people looking for
     * a sign-in problem they did not have.
     *
     * A credential that is *known* to be unusable is still refused (a rejected
     * refresh token, an account the upstream already rejected at sign-in); only
     * cooldowns — which are rotation bookkeeping — are ignored.
     *
     * @param fetchFn - fetch used if the credential is close to expiry.
     */
    getCredentialAccount(fetchFn?: typeof fetch, forceRefresh?: boolean): Promise<{
        account: TAccount;
        credentials: TCredentials;
    }>;
    /**
     * Refresh one named account's credential for a caller that is not a metered
     * model request.
     *
     * The settings card is what this exists for. It addresses an account by id
     * rather than taking a rotation slot, and it used to hand the stored
     * credential to the provider unchanged; with a 15-minute access token that
     * meant a card opened more than a quarter of an hour after the last model
     * request sent an expired bearer to the usage endpoint and was answered with
     * 401 — "sign in again" for a credential that a plain refresh would have
     * renewed.
     *
     * Rotation bookkeeping is deliberately ignored, matching
     * {@link getCredentialAccount}: a cooldown or a pinned account describes
     * routing, not whether the credential can be read. A credential the provider
     * has already declared unusable is still refused, because refreshing it
     * cannot succeed.
     *
     * @param accountId - the pool account to read, or undefined for the primary.
     * @param fetchFn - fetch used by the provider's token refresh.
     */
    getFreshCredential(accountId?: string, fetchFn?: typeof fetch): Promise<TCredentials>;
    /**
     * Renew one account's credential unconditionally.
     *
     * This is the answer to a 401 that the local clock did not predict: an access
     * token can be revoked upstream or rotated by another holder while it still
     * looks unexpired, and only the service's own refusal says so. Renewing it is
     * what separates that from a credential that genuinely needs a new sign-in.
     */
    renewCredential(accountId?: string, fetchFn?: typeof fetch, expected?: TCredentials): Promise<TCredentials>;
    /**
     * Resolve, and if needed renew, one account's credential.
     *
     * With no id the account that would serve the next request is used — the
     * active one, then the primary, then the first — because a caller that does
     * not name an account (the catalog loader) still has to present the
     * credential that is actually in play.
     */
    private credentialFor;
    /**
     * Return one account's current row, refreshing it at most once per generation.
     *
     * Shared by every entry point — routing, auxiliary tools, the settings card
     * and forced renewals — across all instances of the pool file, because a
     * rotating refresh token may be spent once: two parallel exchanges both fail,
     * and the losing one gets recorded as a dead sign-in.
     *
     * Reading the current generation and registering/joining its flight happen in
     * one short transaction, so a commit cannot slip between the two decisions.
     * The network call is fired AFTER the lock is released, and the plan returned
     * from the lock is a plain value: awaiting a flight while holding the lock
     * would deadlock that flight's own commit.
     */
    private freshAccount;
    /**
     * Refresh one account: network outside the lock, then a conditional commit.
     *
     * Every write-back is checked against the credential the refresh started from,
     * which is what keeps a late response from restoring a spent token over a
     * re-login, and keeps a deleted account from coming back.
     */
    private refreshAccount;
    private assertUsableAccount;
    /** Whether one account's credential must be refreshed before it is handed out. */
    private shouldRefreshCredential;
    /**
     * Whether an account's stored credential is known to be unusable.
     *
     * Rotation bookkeeping — cooldowns, the tried set — is deliberately absent:
     * those describe routing, not the credential.
     */
    protected isCredentialUsable(account: TAccount): boolean;
    /** The account a rotation strategy picks out of an already-eligible set. */
    private selectAccount;
    /**
     * The error every-account-unavailable raises.
     *
     * WHICH unavailable state this is decides both the code and the sentence, and
     * the two are not interchangeable:
     *
     * - Nothing cooling down, and every row unusable because its credential was
     *   rejected: this is a sign-in problem. Reported as `AUTH` with the sign-in
     *   remedy. The previous form called it a rate limit and invented "wait 15
     *   minutes" on top, because the shortest-cooldown scan below finds nothing
     *   when nothing is cooling down and fell back to a hardcoded 15. The user was
     *   told to wait out a window that had never started and would never end,
     *   while the only real fix — signing in again — was never mentioned.
     * - Anything cooling down: an honest 429, with the measured instant when one
     *   exists. `waitMinutes` is null when no reset instant was measured, and the
     *   message then says so instead of naming a made-up number.
     *
     * The mixed case (some cooling down, some rejected) reports the 429: a window
     * really is open, and the sentence names the wait. What it must not do — and
     * no longer does — is claim a wait when no cooldown was ever written.
     */
    private allUnavailableError;
    /**
     * Pick the account for the next request, refreshing its credential when it is
     * about to expire.
     *
     * @param excludeIds - accounts already tried for this request, so a retry
     *   lands on a different account.
     * @param fetchFn - fetch used by the provider's token refresh.
     * @throws LlmError with `RATE_LIMIT` when every account is cooling down.
     */
    getEffectiveAccount(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch, forceRefresh?: boolean): Promise<{
        account: TAccount;
        credentials: TCredentials;
    }>;
}
//# sourceMappingURL=account-pool.d.ts.map