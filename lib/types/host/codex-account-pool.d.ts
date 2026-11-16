/**
 * The ChatGPT account pool.
 *
 * TWO KINDS OF ACCOUNT, AND ONLY ONE OF THEM MAY BE REFRESHED.
 *
 * - managed — signed in through this plugin. Its credential lives in the pool's
 *   encrypted storage AND in the pre-pool credential document beside it, it is
 *   refreshable, and deleting it is this plugin's business.
 * - adopted — a SNAPSHOT read out of a local Codex CLI sign-in by 'codex-adopt.ts'
 *   (marker 'adopted: true', source 'codex'). It is used only while its own access
 *   token is still valid.
 *
 * An adopted snapshot is NEVER refreshed, and the reason is not an optimisation:
 * the ChatGPT refresh token the CLI stores rotates, and the CLI refreshes its own
 * file in place. Two processes spending one grant invalidate each other, and
 * whoever loses the race holds a token the server has already retired — which
 * leaves the user signed OUT of the Codex CLI by this plugin's good intentions. An
 * in-process single-flight cannot fix that, because the race is across PROCESSES
 * and the only state they share is a file 'codex-adopt.ts' must never write. Once
 * such a snapshot has expired the pool takes it out of rotation and surfaces
 * ADOPTED_CODEX_CREDENTIAL_EXPIRED_HINT — sign in again in the CODEX CLI and
 * re-import, not here.
 *
 * The rule is enforced twice on purpose: the needsRefresh hook answers false for
 * an adopted credential no matter what its expiry says, and the refresh hook
 * itself refuses one, so a future caller that forgets the first fails loudly
 * instead of silently spending a grant that is not ours to spend.
 *
 * MANAGED BEATS ADOPTED on a conflict, and the marker is therefore written on
 * EVERY account this file creates, including the explicit false case: the core
 * merges a re-authorization as { ...existing, ...created }, so an omitted key
 * would leave a stored 'adopted: true' — and its never-refresh consequence — on a
 * record that is now plugin-owned.
 */
import { AccountPoolCore, type PoolAccountShape, type PoolData } from './common/account-pool.ts';
import { type CredentialStore, type StoredOAuthCredentials, type TokenStore } from './token-store.ts';
import { ConcurrencyGate } from './common/concurrency-gate.ts';
import type { AccountRotationStrategy, PoolAccountQuotaDto, PoolAccountSummaryDto } from '../shared/account-pool-contracts.ts';
import type { QuotaUsageDto } from '../shared/contracts.ts';
import { CODEX_CLI_CREDENTIAL_SOURCE } from './codex-adopt.ts';
/** Where a pooled account's credential came from. */
export type CodexPoolAccountSource = 'managed' | typeof CODEX_CLI_CREDENTIAL_SOURCE;
/** One pooled ChatGPT account: the credential plus the facts the card renders. */
export interface CodexPoolAccount extends PoolAccountShape<StoredOAuthCredentials> {
    /**
     * Which store owns the credential. Only managed rows may be refreshed.
     *
     * Derived from the credential rather than trusted from the row, so the two
     * spellings of the marker can never disagree about one account.
     */
    source: CodexPoolAccountSource;
    /**
     * Whether this row is a borrowed snapshot.
     *
     * Required rather than optional: every construction site has to state it, which
     * is what keeps a stale true from surviving an in-place re-authorization.
     */
    adopted: boolean;
    /** The Codex CLI file an adopted snapshot was read from; absent for managed rows. */
    sourcePath?: string;
    email?: string;
    planType?: string;
    accountId?: string;
}
/**
 * Whether a pooled credential is an adopted snapshot.
 *
 * The two fields, and only those two: a plain credential carries no 'adopted'
 * field and must never be mistaken for a snapshot, because treating a
 * plugin-owned account as a disposable one would freeze it out of refreshing and
 * make deleteAccount refuse to remove an account the user signed in here.
 */
export declare function isAdoptedCodexPoolCredential(credentials: StoredOAuthCredentials): boolean;
/**
 * Whether a credential must be refreshed before the next request.
 *
 * FALSE for every adopted snapshot, valid or expired. That is this pool's core
 * rule: an adopted credential is borrowed for exactly as long as the Codex CLI
 * vouched for it, and this pool has no business rotating a token another process
 * is rotating too. See the module comment.
 */
export declare function codexNeedsRefresh(credentials: StoredOAuthCredentials, now: number): boolean;
/**
 * Why a stored credential is already known to be unusable, or nothing.
 *
 * Reported purely — nothing is written here — and consulted by the core for both
 * routing eligibility and credential usability, which is what makes an expired
 * snapshot non-routable WITHOUT a write on every read. The hint names the remedy
 * in the Codex CLI, because that is where the user has to go: re-adopting here is
 * only possible after the CLI itself signed in again.
 */
export declare function codexAuthRejectedReason(credentials: StoredOAuthCredentials): string | undefined;
/**
 * Message raised if a refresh of a still-valid adopted snapshot were attempted.
 *
 * Unreachable through this pool's own paths (see the module comment); it exists
 * because 'unreachable' is a claim the guard has to be able to make good on.
 */
export declare const ADOPTED_NEVER_REFRESHED_MESSAGE: string;
/** Raised when a refresh of an adopted snapshot is attempted. Never a 401. */
export declare class CodexAdoptedCredentialError extends Error {
    constructor(message: string);
}
/**
 * One account as the ChatGPT settings card renders it.
 *
 * Declared here rather than under 'src/shared/', for the same reason the Claude
 * line declares its own: source and provenance are this pool's vocabulary, and a
 * second copy in the shared contracts module is one that can drift. The base is
 * the shared summary, so every existing consumer of listAccounts() keeps working
 * unchanged — the extra fields are additive.
 */
export interface CodexAccountSummaryDto extends PoolAccountSummaryDto {
    /** Where the credential came from; a card offers different actions per source. */
    source?: CodexPoolAccountSource;
    /** Whether this row is a snapshot borrowed from a local Codex CLI sign-in. */
    adopted?: boolean;
    /** The Codex CLI file an adopted snapshot was read from. */
    sourcePath?: string;
}
/** Encrypted pool file the ChatGPT line owns; the single-credential store stays the mirror. */
export declare function codexPoolPath(): string;
/** Validate and normalize one whole pool document. */
export declare function parseCodexPoolData(value: unknown): PoolData<CodexPoolAccount>;
/** Token refresh the OAuth service lends the pool; refresh tokens rotate, so this must be the only writer. */
export interface CodexTokenRefresher {
    /** Refresh one account with the service's own token-endpoint fetch. */
    refreshAccount(credentials: StoredOAuthCredentials): Promise<StoredOAuthCredentials>;
}
export interface CodexAccountPoolOptions {
    /** Single-credential store the pool mirrors its primary account into. */
    store?: TokenStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<CodexPoolAccount>>;
    /** Accounts this pool accepts; defaults to the core's limit. */
    maxAccounts?: number;
}
export declare function chatGPTConcurrency(): ConcurrencyGate;
/**
 * One ChatGPT usage snapshot as the account card's per-account quota.
 *
 * A bucket lists its windows either in `windows` or, on older payloads, only as
 * the `primary`/`secondary` pair — the same fallback the quota card itself
 * applies, so the account row cannot show fewer windows than the card does. The
 * label stays empty on purpose: a ChatGPT window is named by its length, and
 * the card localizes that length in the reader's own language.
 */
export declare function codexAccountQuota(snapshot: {
    usage: QuotaUsageDto;
    fetchedAt: number;
}): PoolAccountQuotaDto | undefined;
export declare class CodexAccountPool extends AccountPoolCore<StoredOAuthCredentials, CodexPoolAccount, CodexAccountSummaryDto> {
    private readonly refresherRef;
    private readonly store;
    private readonly quotaSnapshotRef;
    private quotaBlockedUntil?;
    constructor(options?: CodexAccountPoolOptions);
    /** Hand the pool the OAuth service's per-account refresh implementation. */
    setRefresher(refresher: CodexTokenRefresher): void;
    /**
     * Wire in a cached-quota verdict.
     *
     * The return value is the time the account's Codex window reopens; a lookup
     * returning undefined (or a past time) leaves the account routable. This is
     * how an exhausted window is skipped before a request is even attempted,
     * instead of discovering it from a 429.
     */
    setQuotaBlockedUntil(lookup: (account: CodexPoolAccount, now: number) => number | undefined): void;
    /**
     * Wire in the account's own newest quota snapshot, for display only.
     *
     * The same map that already spares an exhausted account a wasted request also
     * answers "what did this account's window look like last time we read it".
     * The lookup must be a memory read: it runs while the settings card builds
     * its account list, and that page must never fan out an upstream request per
     * pooled account.
     */
    setQuotaSnapshot(lookup: (account: CodexPoolAccount) => PoolAccountQuotaDto | undefined): void;
    protected isEligible(account: CodexPoolAccount, now: number, triedAccountIds?: ReadonlySet<string>): boolean;
    /**
     * Force one account's token refresh and persist the rotated pair.
     *
     * Used after a 401: the core refreshes proactively when a token is close to
     * expiry, but a server-side revocation is only discovered by the request.
     */
    refreshAccountNow(accountId: string): Promise<StoredOAuthCredentials>;
    /**
     * Remove one account inside a transaction, refusing a borrowed snapshot.
     *
     * The check lives HERE rather than in the public delete method so it cannot be
     * separated from the removal by a concurrent change, and so every caller of the
     * core's own deletion inherits it. The remedy is a separate action
     * ({@link removeImportedAccount}): a card must not destroy an account this plugin
     * did not create with the same button that deletes its own.
     */
    protected deleteAccountFromPool(data: PoolData<CodexPoolAccount>, accountId: string): void;
    /**
     * Drop an imported snapshot from the pool — the card's 'remove import' action.
     *
     * Separate from {@link deleteAccount} because that refuses one, and because the
     * user is asking to stop borrowing a sign-in, not to sign out of an account. The
     * Codex CLI's own file is touched by neither path: not deleted, not rewritten,
     * not moved. This only forgets the copy.
     */
    removeImportedAccount(accountId: string): Promise<void>;
    /** The single-credential store this pool mirrors its primary account into. */
    mirrorStore(): TokenStore;
    /** Rotation strategy currently configured. */
    strategy(): Promise<AccountRotationStrategy>;
}
//# sourceMappingURL=codex-account-pool.d.ts.map