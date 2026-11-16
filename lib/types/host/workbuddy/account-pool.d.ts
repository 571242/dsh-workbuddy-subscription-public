/**
 * WorkBuddy's account pool.
 *
 * This line is the one that adopts accounts it does not own: alongside the
 * accounts a user signs in through this plugin, it reads the CodeBuddy desktop
 * client's own `*.info` credentials so an existing IDE sign-in needs no second
 * login. Both kinds take part in scheduling through the shared
 * {@link AccountPoolCore}, and the difference is enforced here:
 *
 * - **managed** accounts were signed in through this plugin. They live in the
 *   pool's encrypted storage and may be deleted.
 * - **desktop** accounts belong to the IDE. Their credential is re-read from the
 *   IDE's file on every pick, because the IDE rotates it on its own schedule and
 *   a cached copy would go stale; they are never deleted, only hidden.
 */
import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import { FileCredentialStore, type WorkBuddyCredentials } from './token-store.ts';
import type { WorkBuddyAccountQuota, WorkBuddyAccountSummaryDto, WorkBuddyRegion } from '../../shared/workbuddy-contracts.ts';
import type { PoolAccountQuotaDto } from '../../shared/account-pool-contracts.ts';
/** One pooled WorkBuddy account: the credential plus the facts the card renders. */
export interface WorkBuddyPoolAccount extends PoolAccountShape<WorkBuddyCredentials> {
    region: WorkBuddyRegion;
    nickname?: string;
    uin?: string;
    /** Which store owns the credential; only managed accounts may be deleted. */
    source: 'desktop' | 'managed';
    /** IDE file a desktop account came from; absent for managed accounts. */
    sourceFile?: string;
}
/** Encrypted pool file this line owns. */
export declare function workBuddyPoolPath(): string;
/**
 * Validate and normalize one whole pool document.
 *
 * A record whose credential is unusable is dropped rather than repaired: the
 * account can always be adopted again from its file or by signing in again, and
 * keeping a credential-less row would offer the user an account nothing can use.
 */
export declare function parseWorkBuddyPoolData(value: unknown): PoolData<WorkBuddyPoolAccount>;
/**
 * One cached snapshot as the shared account card renders it.
 *
 * Only what the DTO states is published: every meter that measured a share
 * becomes a window, and a meter that measured none is dropped rather than drawn
 * at 0 — which would claim an unspent allowance no reading supports.
 *
 * Exported for the pool's regression tests; the card only reaches it through
 * the summary hook.
 */
export declare function workBuddyPoolQuota(snapshot: WorkBuddyAccountQuota): PoolAccountQuotaDto | undefined;
export interface WorkBuddyAccountPoolOptions {
    /** Credential store the desktop scan reads through; the pool owns scheduling. */
    store?: FileCredentialStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<WorkBuddyPoolAccount>>;
    maxAccounts?: number;
    /**
     * The settings selection: the account the user pinned and the ones hidden.
     *
     * Read on every pick rather than captured once, because both change from the
     * settings card while the adapter is serving requests.
     */
    selection?: () => {
        selectedAccountId: string | null;
        hiddenAccountIds: readonly string[];
    };
}
/**
 * WorkBuddy's account pool.
 *
 * Desktop accounts are adopted into the pool so they can be scheduled and
 * cooled down like any other, but they stay owned by the IDE: the pool refreshes
 * their credential from the IDE's own file on every pick, and deletion is
 * refused for them.
 */
export declare class WorkBuddyAccountPool extends AccountPoolCore<WorkBuddyCredentials, WorkBuddyPoolAccount, WorkBuddyAccountSummaryDto> {
    private readonly store;
    private readonly options_selection;
    /**
     * Older settings key → the id the account has now.
     *
     * A pin or a hide written before the identity fix names its account by the
     * old name-derived key. Kept in step by {@link read}, which every routing
     * decision goes through, so the mapping is never stale when it is consulted.
     */
    private readonly legacyIds;
    /**
     * Per-model parks, in memory only: account id → model → the instant it lifts.
     *
     * The subscription meters an account × MODEL over a 24h window (429 `code
     * 6004` names when it lifts), so cooling the whole ACCOUNT for one exhausted
     * model throws away every other model that account can still serve. Process
     * local on purpose, like the sibling gateway's model cooldowns: the window is
     * short, and a restart re-measures it with the first request rather than
     * trusting a stale timestamp.
     */
    private readonly modelCooldowns;
    constructor(options?: WorkBuddyAccountPoolOptions);
    /**
     * Load the pool, refreshing the legacy-key index on the way.
     *
     * Every routing decision and mutation goes through this method before it
     * consults the settings selection, so building the index here is what keeps
     * a pin written before the identity fix resolvable when
     * {@link resolveSelectionId} is asked for it.
     */
    protected loadPoolData(): Promise<PoolData<WorkBuddyPoolAccount>>;
    /** Map a settings key from before the identity fix onto the account's real id. */
    private resolveSelectionId;
    /**
     * Adopt any desktop credential the pool does not know yet.
     *
     * The IDE's directory is the source of truth for its own accounts, so a
     * credential that appears there joins the pool. Nothing is ever removed: a
     * file that disappears (the IDE signed out, a profile was moved) leaves the
     * account in place, where the user can hide or delete the managed ones.
     */
    syncDesktopAccounts(): Promise<WorkBuddyAccountSummaryDto[]>;
    /**
     * A stale `authStatus` is cleared once the credential in force has moved on.
     *
     * The marker records that ONE token was refused; it does not record that the
     * sign-in is gone. This line can still produce it from a token-endpoint
     * refusal, and the copy that refusal was about can be replaced afterwards by
     * whoever owns it — the IDE rotates a desktop account's token on its own
     * schedule, and the daily check-in renews a managed one and writes it back to
     * this plugin's store. Nothing else in the system ever revisits an
     * `authStatus`, so without this a row stays out of rotation for good and the
     * card keeps saying "需要重新登录" for an account that is signed in.
     *
     * The verdict is re-checked against what the store holds NOW: a row whose
     * account has a DIFFERENT, unexpired token is routable again and adopts it,
     * while a row still holding the refused token keeps its marker — that one
     * really does need a sign-in.
     */
    private healStaleAuthFailures;
    /** Account summaries, with a marker the credentials have outlived cleared. */
    listAccounts(): Promise<WorkBuddyAccountSummaryDto[]>;
    /**
     * Pick an account, healing a stale marker first.
     *
     * The healing belongs on the request path, not only on the card: an account
     * marked expired is excluded by the core's eligibility rule, so until the
     * marker is gone the next request is answered with "全部 N 个账号都需要重新登录"
     * for a credential the store has already replaced.
     */
    getEffectiveAccount(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch, forceRefresh?: boolean): Promise<{
        account: WorkBuddyPoolAccount;
        credentials: WorkBuddyCredentials;
    }>;
    /**
     * Pick the account for the next request.
     *
     * A desktop account's credential is re-read from the IDE's file first: the IDE
     * refreshes its own token, so the copy the pool adopted can be older than what
     * is on disk.
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch, model?: string): Promise<{
        account: WorkBuddyPoolAccount;
        credentials: WorkBuddyCredentials;
    }>;
    /**
     * Park ONE model on one account; every other model keeps serving.
     *
     * Returns the instant the park lifts, or undefined for a non-positive
     * duration (which clears any existing park rather than extending it).
     */
    markModelCooldown(accountId: string, model: string, durationMs: number): number | undefined;
    /** When this account's park on this model lifts, or undefined when it may serve. */
    modelCooldownUntil(accountId: string, model: string, now?: number): number | undefined;
    /** Accounts currently parked on one model, with lifted entries pruned on the way. */
    private parkedAccountIds;
    /**
     * Whether another account besides `triedAccountIds` can serve THIS model.
     *
     * The plain {@link hasAnotherAvailableAccount} answers for any model, so a
     * rotation loop that consulted it would keep trying while every remaining
     * account is parked on the model it is asking for — turning one exhausted
     * window into a burst of refused requests.
     */
    hasAnotherAvailableAccountFor(triedAccountIds: ReadonlySet<string>, model: string): Promise<boolean>;
    /**
     * Whether an account may serve a request.
     *
     * A hidden account keeps its place, its alias and its history, but the user
     * has taken it out of this plugin's rotation, so it is not eligible.
     */
    protected isEligible(account: WorkBuddyPoolAccount, now: number, triedAccountIds?: ReadonlySet<string>): boolean;
    private selection;
    /**
     * Add or re-authorize one account, settling its identity first.
     *
     * A completed browser sign-in states the display name but not always the uid,
     * while the IDE's own file for the same account states the uid. Passing the
     * raw response through would key the login under the name and the file under
     * the uid, so the pool would hold the same account twice — the duplicate this
     * fix exists to remove. Resolving from the credential's own token before the
     * dedupe key is computed is what makes the two paths agree.
     */
    addAccount(credentials: WorkBuddyCredentials, alias?: string): Promise<WorkBuddyPoolAccount>;
    /**
     * Remove one account inside a transaction.
     *
     * A desktop account is refused: the plugin does not own that credential file,
     * so removing it from the pool would strand the IDE's session while telling
     * the user their account was deleted. Hiding is the supported action there.
     */
    protected deleteAccountFromPool(data: PoolData<WorkBuddyPoolAccount>, accountId: string): void;
}
//# sourceMappingURL=account-pool.d.ts.map