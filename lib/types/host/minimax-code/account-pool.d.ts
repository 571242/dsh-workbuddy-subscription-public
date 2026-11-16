/**
 * MiniMax Code 号池：the account pool for the MiniMax Code (编程订阅) line.
 *
 * This is the second line in this package that pools a credential it does not
 * own (WorkBuddy was the first), and that one fact decides every shape below:
 *
 * 1. MiniMax Code's normal credential is the desktop application's own
 *    \`~/.minimax/auth/<buildEnv>/<region>/mcode-public/auth.json\`. The plugin
 *    reads it so a user already signed in to the app never signs in twice, which
 *    is exactly the WorkBuddy precedent for the CodeBuddy client's \`*.info\`
 *    files.
 * 2. ADOPTED MEANS NEVER DESTROYED. That file belongs to an application the
 *    user is running. The pool may read it, may adopt it into its own account
 *    list, and may write a rotated token back through the store's atomic
 *    replacement — but no path in this file may revoke it or delete it. A
 *    deleted \`auth.json\` signs the user out of MiniMax Code itself, so such an
 *    account is reported as \`removable: false\` and deletion is refused
 *    ({@link MinimaxCodeAccountPool.deleteAccount}), mirroring WorkBuddy's
 *    desktop accounts.
 * 3. What the pool adds on top of the single-credential line is rotation: more
 *    than one sign-in can serve requests, a 429 cools one account down instead
 *    of taking the line offline, and the settings card can list, alias, promote
 *    and switch between them.
 *
 * The credential format stays the store's: this file never invents a field of
 * its own inside a token record, so a write back into the app's document keeps
 * the exact shape the app expects.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import { MinimaxCodeCredentialStore, type MinimaxCodeCredentialSource, type MinimaxCodeCredentials } from './token-store.ts';
import type { MinimaxCodeRegion, MinimaxCodeQuota } from '../../shared/minimax-code-contracts.ts';
import type { AccountRotationStrategy, PoolAccountQuotaDto, PoolAccountSummaryDto } from '../../shared/account-pool-contracts.ts';
/**
 * One pooled MiniMax Code account.
 *
 * The credential travels whole (the pool persists it, and the store knows how to
 * write it back to the file it came from); everything else here is a non-secret
 * fact the settings card renders without a second round trip.
 */
export interface MinimaxCodePoolAccount extends PoolAccountShape<MinimaxCodeCredentials> {
    /** Region the credential was issued in; decides every host this account uses. */
    region: MinimaxCodeRegion;
    /**
     * Which store owns the credential.
     *
     * \`minimax-native\` is MiniMax Code's own \`auth.json\`: adopted and renewed,
     * never deletable from here. \`file\` is the plugin's own store, written by a
     * device-code sign-in started in this plugin.
     */
    source: MinimaxCodeCredentialSource;
    /** Display facts, when the credential's token claims carry them. */
    email?: string;
    planName?: string;
}
/** The pool slice the settings card renders, mirroring {@link AccountPoolStatusDto}. */
export interface MinimaxCodeAccountSummaryDto extends PoolAccountSummaryDto {
    region?: MinimaxCodeRegion;
    source?: MinimaxCodeCredentialSource;
    /** Credential generation; diagnostics for two-sided refresh contention with the app. */
    generation?: number;
}
/**
 * Encrypted pool file this line owns.
 *
 * Separate from the credential file on purpose: the pool may hold several
 * accounts, while \`~/.minimax/auth\` holds exactly one session per region and is
 * the desktop app's to write.
 */
export declare function minimaxCodePoolPath(): string;
/**
 * Identity two credentials share when they are the same account.
 *
 * Neither token can be used for this: the access token is replaced on every
 * refresh and the refresh token rotates, so keying on either would make one
 * account look new after every rotation. A hash of the refresh token would have
 * the same defect and no compensating benefit, so it is not done.
 *
 * Two different identities are available, one per provenance:
 *
 * - A native credential names the desktop app's own record slot through
 *   \`recordKey\`. That key is a non-secret digest of the app's auth-home path, so
 *   it is stable across every rotation, and the app keeps exactly one session per
 *   slot: re-signing in there replaces the session, which for routing purposes is
 *   the same account, so updating the row in place is the correct outcome.
 * - A plugin-owned credential has no record slot (the app's key is a hash this
 *   plugin cannot reproduce) and no account profile, so the sign-in that produced
 *   it — its \`loginEpoch\`, which survives every rotation — is the identity. A
 *   second device-code sign-in is genuinely a second session with its own refresh
 *   token chain, so it is its own account.
 *
 * When neither is present there is nothing stable to key on: the function returns
 * undefined, the core mints \`acc_<random>\`, and the row is added rather than
 * silently merged with an unrelated credential.
 */
export declare function minimaxCodePoolIdentity(credentials: MinimaxCodeCredentials): string | undefined;
/**
 * Validate and normalize one whole pool document.
 *
 * The credential is re-parsed through the store's own validator, so a row can
 * never hold a token shape the store would refuse to write back. \`source\`,
 * \`recordKey\` and \`buildEnv\` have to be restored explicitly: the validator
 * takes them from its fallback rather than from the payload, and a native account
 * that lost them would be re-labelled as plugin-owned (so the card would offer a
 * delete that must never happen, and a rotation would land in the plugin's file
 * instead of the app's).
 */
export declare function parseMinimaxCodePoolData(value: unknown): PoolData<MinimaxCodePoolAccount>;
export interface MinimaxCodeAccountPoolOptions {
    /**
     * Credential store the pool reads the desktop app's sign-in through and mirrors
     * its primary account into.
     */
    store?: MinimaxCodeCredentialStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<MinimaxCodePoolAccount>>;
    /** Accounts this pool accepts; defaults to the core's limit. */
    maxAccounts?: number;
}
/**
 * One cached read as the shared account card renders it.
 *
 * Every window is labeled through its LENGTH rather than with a string: the
 * canonical window names live in the client's dictionary, and the host has no
 * business shipping display text. A window whose consumed share nobody measured
 * is dropped by {@link quotaWindow} — a null percentage is not 0%, it is
 * "not stated", and a bar would lie about it. An `unlimited` window states no
 * consumed share at all and the per-account shape has no way to say
 * "unlimited", so it is dropped too rather than drawn as an empty bar.
 */
export declare function minimaxCodePoolQuota(quota: MinimaxCodeQuota | null | undefined): PoolAccountQuotaDto | undefined;
/**
 * MiniMax Code's account pool.
 *
 * It owns rotation and the write-back, exactly like the sibling lines, with one
 * asymmetry the hooks below enforce: an account whose credential lives in the
 * desktop app's file is adopted, never owned.
 */
export declare class MinimaxCodeAccountPool extends AccountPoolCore<MinimaxCodeCredentials, MinimaxCodePoolAccount, MinimaxCodeAccountSummaryDto> {
    private readonly store;
    constructor(options?: MinimaxCodeAccountPoolOptions);
    /**
     * Account summaries, with a false auth failure cleared.
     *
     * A row can carry an `authStatus` of expired for a rotation that actually
     * succeeded — the second of two concurrent rotations of one session gets a final
     * verdict for a token the first already spent. Nobody comes back to clear that
     * marker, so the account stays out of rotation until the user presses 重新登录.
     *
     * The verdict is re-checked against the token in force instead: a row whose
     * credential has moved on since the failure is routable again, and the marker is
     * removed. A row still holding the refused token keeps its marker, because that
     * one really does need a sign-in.
     */
    listAccounts(): Promise<MinimaxCodeAccountSummaryDto[]>;
    /**
     * Pick an account, healing a stale auth failure first.
     *
     * The healing matters here, not only on the card: an account marked expired is
     * excluded by the core's eligibility rule, so until the marker is gone the line
     * answers a single-account pool with "all accounts need a new sign-in" — for a
     * rotation that succeeded. Doing it on the request path means the very next
     * request after a false refusal routes normally instead of waiting for the card's
     * next poll.
     */
    getEffectiveAccount(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: MinimaxCodePoolAccount;
        credentials: MinimaxCodeCredentials;
    }>;
    /**
     * Drop an `authStatus` that describes a credential this machine no longer holds.
     *
     * A row can be marked expired by a rotation that actually SUCCEEDED: the refresh
     * token is single-use, so when two callers of one session rotate at the same time
     * the loser is told `invalid_grant` for a token the winner already spent. That is
     * a verdict about a spent generation, not about the sign-in — and nothing else in
     * the system ever revisits it, which is why the account stayed parked at
     * "需要重新登录" until the user pressed a button.
     *
     * The verdict is re-checked against the credential in force: if the stored
     * credential for the same session has moved on, the marker was about the old
     * token and is removed. A row still holding the refused token keeps its marker,
     * because that one genuinely needs a sign-in.
     */
    private healStaleAuthFailures;
    /**
     * The account a usage read belongs to, together with the credential to read it
     * with.
     *
     * Authored here rather than in the routes because it is provider-shaped: the
     * routes need a credential and the ACCOUNT it was read for, so a snapshot can
     * be remembered against the row whose numbers it describes. The selection is
     * the core's own rule for a caller that names no account — the active one, then
     * the primary, then the first — repeated in these three lines because the core
     * exposes it only through `getFreshCredential`, which returns the credential
     * alone; the credential (and its single-flight refresh, write-back and
     * bookkeeping) still comes from the core, so no rotation rule lives here.
     *
     * No upstream request is made for the selection itself, and none of this moves
     * the rotation: reading quota is not serving a request.
     */
    getQuotaReadTarget(fetchFn?: typeof fetch): Promise<{
        accountId: string;
        credentials: MinimaxCodeCredentials;
    }>;
    /**
     * Pick the account for the next request.
     *
     * The returned credential carries its own region and record key, so a caller
     * must use those rather than any process-wide default. This is the method the
     * adapter uses; {@link getEffectiveAccount} beneath it already refreshes a
     * credential that is about to expire and writes the rotation back.
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: MinimaxCodePoolAccount;
        credentials: MinimaxCodeCredentials;
    }>;
    /**
     * The desktop app's own current copy of one native account's credential.
     *
     * The app rotates its token on its own schedule, so the copy the pool adopted
     * can be older than what is on disk. Only the same record slot counts: a
     * different record key or region is a different account, and substituting it
     * would present one account's token as another's. A file whose token is already
     * stale is not newer authority either — the refresh path has just written the
     * pair back, and reading the pre-refresh file would undo it.
     */
    private liveNativeCredential;
    /**
     * The desktop app's own copy of one native account's session, and whether it has
     * moved on from the row's copy.
     *
     * The app rotates its token on its own schedule, so the copy the pool adopted can
     * be older than what is on disk. Only the same record slot counts: a different
     * record key or region is a different account, and substituting it would present
     * one account's token as another's.
     *
     * `advanced` is the whole reason this does not simply return the file: an
     * EXPIRED file is not newer authority (that is the app's session having lapsed),
     * while one that has moved on from the row is. The row's refresh token was spent
     * by whichever side rotated last, and only the file can say what replaced it.
     */
    private nativeAuthority;
    /**
     * Adopt the sign-in the desktop app currently holds into the pool.
     *
     * The pre-pool projection ({@link legacyAccount}) only surfaces when the pool is
     * empty, so a user who already has a plugin-owned account needs an explicit way
     * to bring the app's session in as well. Nothing is ever removed from the app;
     * the account is added under its own record-slot identity, so adopting twice
     * updates the same row.
     */
    adoptNativeAccount(alias?: string): Promise<MinimaxCodePoolAccount>;
    /**
     * Remove one account inside a transaction.
     *
     * An account whose credential is the desktop app's own \`auth.json\` is refused:
     * this plugin does not own that file, and removing the account would either
     * strand the app's session or — if the deletion were ever allowed to reach the
     * file — sign the user out of MiniMax Code itself. Signing out there is the
     * supported way to end it, and the card is told so by \`removable: false\`.
     */
    protected deleteAccountFromPool(data: PoolData<MinimaxCodePoolAccount>, accountId: string): void;
    /** The credential store this pool mirrors its primary account into. */
    mirrorStore(): MinimaxCodeCredentialStore;
}
/** The pool slice of a status response; exactly the fields the card renders. */
export interface MinimaxCodePoolStatus {
    accounts: MinimaxCodeAccountSummaryDto[];
    activeAccountId?: string;
    rotationStrategy: AccountRotationStrategy;
    /** Whether this process installed a pool at all. */
    poolInstalled: boolean;
}
/**
 * Read the pool slice of the status DTO.
 *
 * A pool that cannot be read must not fail the whole card: the connection
 * section is still worth rendering, just with an empty account list.
 */
export declare function minimaxCodePoolStatus(pool: MinimaxCodeAccountPool | undefined): Promise<MinimaxCodePoolStatus>;
export interface MinimaxCodeAccountsRouteOptions {
    /**
     * Status the route answers a mutation with, so the card re-renders in one round
     * trip. Defaults to the pool slice alone.
     */
    readStatus?: () => Promise<unknown>;
    /**
     * Called after a mutation that can move which account serves a request, so the
     * caller can drop per-account caches (quota, catalog) that belong to the account
     * that just changed.
     */
    onAccountsChanged?: () => void;
}
/**
 * The \`/accounts\` route for this line, as a self-contained handler.
 *
 * It is a handler rather than a second \`webServer.register\` call because the
 * parent route already owns the \`/minimax-code/api\` prefix: registering a nested
 * prefix beside it would make which handler sees \`/accounts\` depend on the
 * server's prefix-matching order. The parent dispatches on \`path === 'accounts'\`
 * and calls this.
 *
 * Every POST goes through {@link isSameOriginMutation}, exactly like the sibling
 * lines' account routes, and no response ever carries a credential: what leaves
 * here is the summary DTO the card renders.
 */
export declare function createMinimaxCodeAccountsHandler(pool: MinimaxCodeAccountPool | undefined, options?: MinimaxCodeAccountsRouteOptions): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
//# sourceMappingURL=account-pool.d.ts.map