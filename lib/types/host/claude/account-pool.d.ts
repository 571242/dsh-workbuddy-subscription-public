/**
 * The Claude subscription line's account pool.
 *
 * ---------------------------------------------------------------------------
 * TWO KINDS OF ACCOUNT, AND ONLY ONE OF THEM MAY BE REFRESHED
 * ---------------------------------------------------------------------------
 *
 * A row in this pool is one of:
 *
 * - **managed** — signed in through this plugin. Its credential lives in the
 *   pool's encrypted storage AND in the pre-pool credential document beside it,
 *   it is refreshable, and deleting it is this plugin's business.
 * - **adopted** — a SNAPSHOT read out of a local Claude Code sign-in by
 *   'adopt.ts' (marker 'adopted: true', source 'claude-code'). It is used only
 *   while its own access token is still valid.
 *
 * An adopted snapshot is NEVER refreshed, and the reason is not an optimisation:
 * Claude Code's refresh token ROTATES. Every refresh consumes the stored token
 * and issues a new one, so two processes refreshing the same grant invalidate
 * each other — whoever loses the race holds a token the server has already
 * retired, and the user ends up signed OUT of Claude Code by this plugin's good
 * intentions. An in-process single-flight cannot fix that, because the race is
 * across PROCESSES: this plugin and Claude Code are separate programs, and the
 * only shared state between them is a file that 'adopt.ts' must never write.
 * Once such a snapshot is expired the pool takes it out of rotation and
 * surfaces ADOPTED_CREDENTIAL_EXPIRED_HINT — sign in again in CLAUDE CODE and
 * re-import, not here.
 *
 * The rule is enforced twice on purpose:
 *
 * 1. {@link claudeNeedsRefresh} returns false for an adopted credential no
 *    matter what its expiry says, so neither the routing path nor the auxiliary
 *    credential path ever reaches for a refresh.
 * 2. the refresh hook itself refuses one ({@link ClaudeAdoptedCredentialError}),
 *    so a future caller that forgets rule 1 fails loudly instead of silently
 *    spending a grant that is not ours to spend.
 *
 * ---------------------------------------------------------------------------
 * ONE ACCOUNT, ONE KEY
 * ---------------------------------------------------------------------------
 *
 * 'token-store.ts' keys a stored account by an immutable internalId
 * ('cl_' + 20 hex) and keeps identity aliases ('uuid:..', 'email:..',
 * 'seed:<sha256(refreshToken)>') as an APPEND-ONLY set hanging off it. This pool
 * adopts that same id rather than minting its own, and it resolves every
 * identity question THROUGH it:
 *
 * - {@link ClaudeAccountPool.recordIdFor} turns a credential's strongest alias
 *   into the owning record's internalId, never into an alias string and never
 *   into a token digest. Both the dedupeKey and the accountId hook return that
 *   id, so the pool and the credential document cannot drift into two key
 *   spaces — which is how ghost accounts appear: one account, two rows, one of
 *   them stale forever.
 * - 'seed:' aliases are LOOKUP keys only. A seed is a digest of a rotating
 *   token, so it is never returned, never stored as an account id, and never
 *   compared for equality between two credentials.
 *
 * The single accepted limitation is inherited from the store and restated here
 * so nobody has to rediscover it: a credential that states NEITHER a uuid NOR an
 * address has only its token seed as identity, so a re-login produces a
 * different seed and a second record. {@link ClaudeAccountPool.mergeAccounts} is
 * the remedy, and it is a deliberate user action rather than a guess.
 *
 * ---------------------------------------------------------------------------
 * THE DOCUMENT SEAM (why an adapter class exists here)
 * ---------------------------------------------------------------------------
 *
 * 'oauth.ts' signs in and refreshes against a minimal two-method store (read /
 * write of ONE credential), because that module deliberately knows nothing about
 * how accounts are laid out on disk. This line's store is
 * {@link FileCredentialStore} — a MULTI-account document. The bridge is
 * {@link ClaudeCredentialStoreAdapter}: it addresses exactly one record by
 * internalId on read and writes back into that record's own entry (through
 * saveAccount(credentials, { internalId }), which MERGES identity aliases
 * instead of replacing them). Every caller that needs the two-method surface —
 * the sign-in flow, and a later route that acts on one account — gets it from
 * {@link ClaudeAccountPool.credentialStoreFor}.
 *
 * The pool's own refresh deliberately calls 'oauth.ts''s refreshAccessToken
 * rather than its higher-level ensureAccessToken. That is not a shortcut: the
 * single-flight in ensureAccessToken is ONE MODULE-LEVEL PROMISE shared by every
 * caller in the process, so with a pool it would hand the second account the
 * first account's freshly rotated credential — and, through the adapter above,
 * write it into the second account's record. The pool therefore keeps its OWN
 * single-flight, per pool file and account, which preserves the property
 * the frozen module wanted (one rotation per expiry, no two callers spending the
 * same rotating token) without the cross-account contamination.
 *
 * ---------------------------------------------------------------------------
 * MANAGED WINS A CONFLICT
 * ---------------------------------------------------------------------------
 *
 * The same Claude account can reach the pool twice: as a plugin sign-in and as
 * an adopted snapshot. The two rows merge into one, and the MANAGED one wins the
 * refresh right — it is the only one that is allowed to refresh at all. When
 * they merge the adopted marker must NOT survive, because a surviving
 * 'adopted: true' would silently freeze the merged record out of refreshing
 * forever. That is why this class writes the marker (including its false case)
 * on EVERY account it creates, rather than only on the adopted ones: the core
 * merges a re-authorization as { ...existing, ...created }, so an omitted key
 * would leave the stored marker in place.
 */
import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import type { AccountAuthStatus, PoolAccountQuotaDto, PoolAccountSummaryDto } from '../../shared/account-pool-contracts.ts';
import { FileCredentialStore, type ClaudeCredentials } from './token-store.ts';
import { ClaudeUnauthorizedError, type ClaudeTokenStore } from './oauth.ts';
import { CLAUDE_CODE_CREDENTIAL_SOURCE } from './adopt.ts';
import { type ClaudeAccountQuota, type ClaudeFailure } from './client.ts';
/**
 * How early this pool refreshes, mirroring 'oauth.ts''s own REFRESH_MARGIN_MS.
 *
 * A mirror rather than an import because the frozen module keeps that constant
 * private, and this chunk's rule is to mirror the five-minute margin rather than
 * invent one. The consequence is stated rather than hidden: 'oauth.ts' ALREADY
 * subtracts the same five minutes when it stamps expiresAt, so a credential this
 * pool refreshes is refreshed roughly ten minutes ahead of the real expiry. That
 * direction is the safe one for this line — a refresh that arrives early costs
 * one rotation, while one that arrives late costs a 401 in the middle of a turn.
 */
export declare const CLAUDE_REFRESH_MARGIN_MS = 300000;
/**
 * Message raised when the pool holds no account at all.
 *
 * Word for word the string 'oauth.ts' raises when its store is empty, so a user
 * who reads either one is sent to the same place.
 */
export declare const CLAUDE_EMPTY_POOL_MESSAGE = "Not signed in to Claude. Sign in from Settings > Claude.";
/**
 * Message for a credential that cannot reach /v1/messages at all.
 *
 * 'user:inference' is the scope that makes a token a SUBSCRIPTION credential;
 * without it the credential authenticates but is not entitled to the routes this
 * provider exists to serve, so the account is listed and refused rather than
 * retried.
 */
export declare function claudeNonSubscriptionReason(): string;
/**
 * Message raised if a refresh of a still-valid adopted snapshot were ever
 * attempted.
 *
 * Unreachable through this pool's own paths (see the module comment); it exists
 * because 'unreachable' is a claim the guard has to be able to make good on.
 */
export declare const ADOPTED_NEVER_REFRESHED_MESSAGE: string;
/**
 * The adoption markers, as they hang off a credential stored by this pool.
 *
 * FLATTENED onto the credential, unlike the snapshot 'adopt.ts' returns, which
 * nests the token under 'credentials'. Two reasons, both structural:
 *
 * - the pool's hooks (needsRefresh, refresh, authRejectedReason) receive the
 *   CREDENTIAL and never the account record, so the marker has to be reachable
 *   from there;
 * - every other field this line reads (expiresAt, accessToken) sits at the top
 *   level, and a second nesting level would mean two shapes for one account.
 *
 * The predicate is therefore {@link isAdoptedPoolCredential} rather than
 * 'adopt.ts''s own isAdoptedClaudeCredential, which additionally requires that
 * nested 'credentials' record and so answers false for this spelling. The FIELDS
 * it tests — adopted === true and source === 'claude-code' — are the same two,
 * and the source constant is imported from that module rather than re-typed.
 */
export interface ClaudeAdoptedCredentialMarkers {
    adopted?: true;
    source?: string;
    sourcePath?: string;
}
/** One pooled credential: the stored credential, plus the markers above. */
export type ClaudePoolCredentials = ClaudeCredentials & ClaudeAdoptedCredentialMarkers;
/** Where a pooled account's credential came from. */
export type ClaudePoolAccountSource = 'managed' | typeof CLAUDE_CODE_CREDENTIAL_SOURCE;
/** One pooled Claude account: the credential plus the facts the card renders. */
export interface ClaudePoolAccount extends PoolAccountShape<ClaudeCredentials> {
    /**
     * Append-only alias set, mirroring the credential document's own.
     *
     * Kept on the row so a merge (or the explicit
     * {@link ClaudeAccountPool.mergeAccounts}) can carry an alias across instead of
     * losing the only handle a seed-only snapshot has.
     */
    identityKeys: string[];
    /** Which store owns the credential. Only managed rows may be refreshed. */
    source: ClaudePoolAccountSource;
    /**
     * Whether this row is a borrowed snapshot.
     *
     * Required rather than optional: every construction site has to state it, which
     * is what keeps a stale true from surviving an in-place re-authorization.
     */
    adopted: boolean;
    /** Claude Code file an adopted snapshot was read from; absent for managed rows. */
    sourcePath?: string;
    /** Address the sign-in reported, when it reported one. */
    email?: string;
    /** Subscription tier the exchange reported, verbatim ('max', 'pro', ...). */
    subscriptionType?: string;
    /** Display form of {@link subscriptionType}; the card's plan badge. */
    planLabel?: string;
}
/**
 * One account as the Claude settings card renders it.
 *
 * Declared here rather than under 'src/shared/': this slice is the pool's own
 * vocabulary, and a later chunk imports it from this module instead of growing a
 * second copy that drifts.
 */
export interface ClaudeAccountSummaryDto extends PoolAccountSummaryDto {
    /** Where the credential came from; a card offers different actions per source. */
    source?: ClaudePoolAccountSource;
    /** Whether this row is a snapshot borrowed from a local Claude Code sign-in. */
    adopted?: boolean;
    /** The Claude Code file an adopted snapshot was read from. */
    sourcePath?: string;
    /** Subscription tier, from the credential itself. */
    subscriptionType?: string;
}
/** Encrypted pool file this line owns; the credential document stays the mirror. */
export declare function claudePoolPath(): string;
/**
 * Parse one stored credential TOLERANTLY; null when the row cannot serve.
 *
 * Deliberately not 'token-store.ts''s parseClaudeCredentials, and the difference
 * is the point:
 *
 * - that parser is STRICT and refuses a credential with no 'user:inference'
 *   scope, which is right for the document it guards but would DELETE the row
 *   here. This pool has to be able to LIST a credential it refuses, so the
 *   refusal can be reported with a reason (see {@link claudeAuthRejectedReason})
 *   instead of the account silently vanishing from the card.
 * - an adopted snapshot states no scopes at all when Claude Code's document did
 *   not, and 'adopt.ts' refuses to invent them.
 *
 * What is still refused, because such a row could never serve a request: a
 * missing token, or an expiry that is not a finite number.
 */
export declare function parseClaudePoolCredentials(value: unknown): ClaudePoolCredentials | null;
/**
 * Prefix of the id this pool gives a borrowed snapshot.
 *
 * A snapshot has no credential-document record, so there is no internalId to
 * adopt; the pool has to name it. The name is WHERE IT CAME FROM rather than a
 * digest of its tokens, and that choice is load-bearing: Claude Code refreshes
 * its own file, so a re-import of an unchanged sign-in carries a DIFFERENT
 * refresh token and therefore a different 'seed:' alias. Keying on the source
 * file is what makes "import it again after signing in again in Claude Code" an
 * UPDATE of the row the user already has, instead of a new row every time.
 *
 * The residual, stated rather than hidden: two accounts imported one after the
 * other from the SAME path are one row, because the row means 'the sign-in that
 * file currently holds' — which is exactly what a borrowed snapshot is. And a
 * snapshot whose route did not record a path at all shares the 'unstated' name
 * with any other such snapshot, so those collapse into one row too.
 */
export declare const ADOPTED_ACCOUNT_KEY_PREFIX = "adopted:";
/** The pool's own name for a borrowed snapshot. Never a token digest. */
export declare function adoptedPoolAccountKey(credentials: ClaudeCredentials): string;
/**
 * Whether a pooled credential is an adopted snapshot.
 *
 * The two fields, and only those two: a plain credential has no 'adopted' field
 * and must never be mistaken for a snapshot, because treating a plugin-owned
 * account as disposable would refuse to refresh an account the user added here.
 */
export declare function isAdoptedPoolCredential(credentials: ClaudeCredentials): boolean;
/**
 * Whether a credential must be refreshed before the next request.
 *
 * FALSE for every adopted snapshot, valid or expired. That is this chunk's core
 * rule: an adopted credential is borrowed for exactly as long as Claude Code
 * vouched for it, and this pool has no business rotating a token another process
 * is rotating too. See the module comment.
 */
export declare function claudeNeedsRefresh(credentials: ClaudeCredentials, now: number): boolean;
/**
 * Why a stored credential is already known to be unusable, or nothing.
 *
 * Reported purely — nothing is written here — and consulted by the core for both
 * routing eligibility and credential usability, which is what makes an expired
 * snapshot non-routable without a write on every read.
 *
 * Order matters: the expired-snapshot hint comes first because it is the
 * actionable one (the remedy is in Claude Code, not here).
 */
export declare function claudeAuthRejectedReason(credentials: ClaudeCredentials): string | undefined;
/** Validate and normalize one whole pool document. */
export declare function parseClaudePoolData(value: unknown): PoolData<ClaudePoolAccount>;
/**
 * The two-method credential store 'oauth.ts' wants, addressed at ONE account.
 *
 * See the module comment for why this bridge exists at all. The id is the
 * document's own immutable internalId, which is also the pool row's id, so a
 * refresh driven through here lands in the very record the pool lists — no
 * second key space.
 *
 * write goes through saveAccount(credentials, { internalId }) rather than
 * replacing the document, so the record keeps its append-only alias set and
 * whatever a later chunk hung on it. It does NOT special-case an adopted
 * snapshot: nothing in the pool ever asks this adapter to write one (the refresh
 * guard refuses first), and silently discarding a caller's write would be a
 * worse failure than the store's own strict validation.
 */
export declare class ClaudeCredentialStoreAdapter implements ClaudeTokenStore {
    private readonly store;
    private readonly internalId;
    constructor(store: FileCredentialStore, internalId: string);
    read(): Promise<ClaudeCredentials | null>;
    write(credentials: ClaudeCredentials): Promise<void>;
}
/**
 * What the adapter must do with the account that produced a failed request.
 *
 * THE CONTRACT, and it is the adapter's to honour rather than this module's to
 * enforce:
 *
 * - switch accounts, or cool one down, ONLY for a CREDENTIAL failure or an
 *   ACCOUNT-SCOPED rate limit. Both are attributable to one account, so another
 *   account can plausibly serve the same request.
 * - NEVER rotate on a global rate limit, an overload (529), a server error, a
 *   transport failure, or a malformed request. None of them is any account's
 *   fault, and rotating would spend the whole pool against a wall every account
 *   is behind — while cooling accounts down would take the line offline with a
 *   cooldown nobody earned.
 *
 * The rule is NOT re-derived here: 'client.ts' classifyFailure already answers
 * it, and ClaudeFailure.accountScoped is precisely 'this is THIS account's own
 * spent window' (true only for rate_limit_account, and a 429 carrying no unified
 * rate-limit header is deliberately classified GLOBAL). The helper below is that
 * flag applied to a decision, so the adapter has one place to ask.
 */
export type ClaudeAccountRotationAction = {
    action: 'mark-auth-failed';
    status: AccountAuthStatus;
} | {
    action: 'cool-down';
    durationMs: number;
} | {
    action: 'none';
};
/**
 * Fallback cooldown for an account-scoped 429 that named no retry-after.
 *
 * Fifteen minutes mirrors the core's own assumption in its all-unavailable
 * message, so a pool that falls back computes the wait a user would have been
 * shown anyway.
 */
export declare const CLAUDE_DEFAULT_COOLDOWN_MS = 900000;
/**
 * The rotation decision for one classified failure.
 *
 * @param failure - a 'client.ts' ClaudeFailure, or the three fields of one.
 */
export declare function claudeAccountRotationAction(failure: Pick<ClaudeFailure, 'kind' | 'accountScoped' | 'retryAfterMs'>, options?: {
    fallbackCooldownMs?: number;
}): ClaudeAccountRotationAction;
/** Raised when a refresh of an adopted snapshot is attempted. Never a 401. */
export declare class ClaudeAdoptedCredentialError extends ClaudeUnauthorizedError {
    constructor(message: string);
}
export interface ClaudeAccountPoolOptions {
    /** Pre-pool credential document the pool mirrors its accounts into. */
    store?: FileCredentialStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<ClaudePoolAccount>>;
    /** Accounts this pool accepts; defaults to the core's limit. */
    maxAccounts?: number;
    /** The account the card pinned, or null for automatic selection. */
    preferAccountId?: () => string | null;
    /**
     * Test seam for the token exchange itself.
     *
     * Replacing it does NOT bypass the adopted guard or the per-account
     * single-flight above it, and the document write-back still happens: the seam
     * is the network call, not the policy.
     */
    refreshCredentials?: (credentials: ClaudeCredentials, fetchFn: typeof fetch) => Promise<ClaudeCredentials>;
}
/**
 * One account's own newest quota snapshot, in the shape the account card draws.
 *
 * The snapshot comes from 'client.ts''s per-account cache, and this is where
 * this line's own numbers are translated into the shared shape. Every judgement
 * below trades a possibly-nice-looking bar for an honest one:
 *
 * - a window whose consumed share nobody measured is DROPPED (`quotaWindow`
 *   returns null), because "0% used" and "not stated" are different claims;
 * - the share falls back to `100 - remainingPercent` only when that field was
 *   stated; when the payload stated NEITHER share there is nothing to draw;
 * - the read time is the full read's own `fetchedAt`, or — for a snapshot that
 *   only response headers ever kept warm, which performed no full read — the
 *   `observedAt` instant those numbers arrived. Either way it is when this line
 *   saw the numbers, never when upstream served them.
 *
 * A null snapshot means "this account was never read", which `poolQuota` reports
 * as undefined so the card can say exactly that instead of drawing a zero.
 */
export declare function claudePoolQuota(snapshot: ClaudeAccountQuota | null): PoolAccountQuotaDto | undefined;
/**
 * The Claude subscription account pool.
 *
 * Read the module comment first: it carries the two rules this class exists to
 * enforce — an adopted snapshot is never refreshed, and one account has one key
 * — together with the reasoning behind both.
 */
export declare class ClaudeAccountPool extends AccountPoolCore<ClaudeCredentials, ClaudePoolAccount, ClaudeAccountSummaryDto> {
    private readonly store;
    private readonly refreshSeam;
    /**
     * Identity alias -> internalId of the record that owns it.
     *
     * Rebuilt from the pool's own rows on every {@link read}, and additionally fed
     * by {@link addAccount} from the credential document, which is what lets an
     * incoming credential be resolved to an existing record BEFORE the core has to
     * decide whether this is a new account.
     *
     * Entries are never pruned, deliberately. Dropping a live row's alias would
     * make the very next credential for that account look new, which is the ghost
     * row this index exists to prevent; a stale entry is overwritten by the next
     * {@link read}, because a live row always re-indexes its own aliases.
     */
    private readonly recordIds;
    /**
     * One in-flight refresh per account.
     *
     * The refresh token rotates, so two concurrent callers refreshing one account
     * would spend it twice: the second exchange carries a token the first already
     * rotated away, the endpoint answers with a final verdict, and the account is
     * marked expired immediately after a refresh that in fact succeeded. Keyed by
     * the record's id — never by a token — so it cannot mix two accounts up.
     */
    constructor(options?: ClaudeAccountPoolOptions);
    /** The credential document this pool mirrors into. */
    mirrorStore(): FileCredentialStore;
    /**
     * The two-method store 'oauth.ts' needs, addressed at one account.
     *
     * The seam in one place: the sign-in flow (and any later route that acts on a
     * single account) never has to know the document layout.
     */
    credentialStoreFor(accountId: string): ClaudeTokenStore;
    /**
     * Read the pool, re-indexing the identity aliases on the way.
     *
     * Every routing decision goes through this method, so this is where the index
     * {@link recordIdsFor} reads is kept in step with the rows that actually exist.
     * See the recordIds field for why entries are not pruned.
     */
    protected loadPoolData(): Promise<PoolData<ClaudePoolAccount>>;
    /**
     * Add or re-authorize one account.
     *
     * The override exists for ONE reason: the account's id must be the credential
     * document's internalId, and only this method can look that value up before
     * the core has decided whether the account is new. See the module comment's
     * 'one account, one key' section.
     */
    addAccount(credentials: ClaudeCredentials, alias?: string): Promise<ClaudePoolAccount>;
    private addManagedAccount;
    /**
     * Add, or re-import, one borrowed Claude Code snapshot.
     *
     * A snapshot is never written into this plugin's credential document — it is
     * not this line's sign-in to keep — so its row is named by WHERE IT CAME FROM
     * (see {@link adoptedPoolAccountKey}) and there is nothing to reconcile with
     * the document.
     *
     * MANAGED BEATS ADOPTED, and this is where the two actually meet. A snapshot
     * resolves to an existing row through its token seed, which is how an account
     * imported here and then signed in through THIS plugin is recognized as one
     * account: the row it lands on is already plugin-owned, and overwriting it with
     * a borrowed credential would freeze that account until the snapshot expired —
     * silently, and for no reason the user could see. So the snapshot contributes
     * only what is new evidence (its aliases) and refuses to touch anything else.
     *
     * The id is resolved BEFORE the core is asked whether the account is already
     * pooled, because the core computes the dedupe key at the TOP of its own
     * addAccount: a key that only becomes known afterwards misses its one chance to
     * answer, and every repeated import would add a row.
     */
    private addAdoptedAccount;
    /**
     * Merge two rows that are one account.
     *
     * This is the user's remedy for the identity limitation 'token-store.ts'
     * documents: a credential stating neither a uuid nor an address has only a
     * token digest to go on, so a re-login produces a second record, and nothing
     * can tell that apart from a genuinely different account. The same applies to
     * an imported snapshot, which Claude Code's document gives no identity to.
     *
     * THE MANAGED ROW WINS THE CREDENTIAL — by construction, not by argument
     * order. Only a plugin-owned credential may ever be refreshed, so a merge that
     * kept a snapshot's tokens would leave the account frozen until it expired, for
     * no reason the user could see. When BOTH rows are snapshots there is nothing
     * to promote and the marker survives; otherwise the merged record is
     * plugin-owned and refreshable again.
     *
     * The keeper's id, alias and ordering are kept, since those are what the
     * settings document pins and what the user recognizes.
     */
    mergeAccounts(keepAccountId: string, dropAccountId: string): Promise<ClaudePoolAccount>;
    private mergeAccountsInPool;
    /**
     * Fold two document records into the one the merged pool row points at.
     *
     * The alias sets are unioned rather than replaced, mirroring the document's own
     * append-only rule: the discarded record's aliases are the only handles a
     * seed-only credential has, and losing them would make the merged account
     * unrecognizable to its own next refresh.
     */
    private reconcileMergedDocument;
    /**
     * Drop an imported snapshot from the pool.
     *
     * A separate action because {@link deleteAccount} refuses one: the row is a
     * borrowed snapshot, and a card must not destroy an account this plugin did
     * not create with the same button that deletes its own. This is what an
     * import card's 'remove import' calls; Claude Code's own file is touched by
     * neither path.
     */
    removeImportedAccount(accountId: string): Promise<void>;
    /**
     * Delete one plugin-owned account.
     *
     * Refused for an imported snapshot, following the WorkBuddy pool's precedent
     * for accounts it did not sign in: the card offers
     * {@link removeImportedAccount} there instead. A managed account is removed
     * from the credential document as well, so the two stores cannot disagree
     * about which accounts exist — the pre-pool projection would otherwise hand
     * back a credential the user just deleted.
     */
    deleteAccount(accountId: string): Promise<void>;
    /**
     * The immutable id of the record that owns a credential, or nothing.
     *
     * Resolution order mirrors 'token-store.ts''s own identity rules, minus the
     * part that must never be a key: a strong alias ('uuid:..', 'email:..') is
     * looked up first, and the 'seed:' digest is consulted ONLY as a lookup, so a
     * credential stating no real identity still finds its record without the pool
     * ever keying an account on a rotating token.
     */
    private recordIdFor;
    /**
     * The key the pool files a credential under, or nothing.
     *
     * A MANAGED credential is named by the credential document's immutable
     * internalId, so the pool and the document agree on one key — and that value is
     * already known here, because a managed credential reaches this point only
     * after the document has stored it and handed its id back.
     *
     * A BORROWED SNAPSHOT has no document record, so it cannot be named by one. It
     * is named by its source file instead ({@link adoptedPoolAccountKey}), which is
     * a fact the credential always carries. Answering `undefined` here for a
     * snapshot would be fatal rather than cautious: the core treats `undefined` as
     * `no dedupe key`, so every import would land as a brand new row — including
     * the re-import this line's own instructions tell the user to perform after
     * signing in again in Claude Code.
     */
    private poolKeyFor;
    /**
     * The id this process already knows for a credential, or nothing.
     *
     * Resolution order mirrors 'token-store.ts''s own identity rules, minus the
     * part that must never be a key: a strong alias ('uuid:..', 'email:..') is
     * looked up first, and the 'seed:' digest is consulted ONLY as a lookup, so a
     * credential stating no real identity still finds its record without the pool
     * ever keying an account on a rotating token.
     */
    private recordIdsFor;
    private indexCredential;
    private indexRecord;
    private indexAccount;
    /**
     * Refresh one account's credential, and nothing else.
     *
     * Two guards live here and both are load-bearing:
     *
     * 1. an adopted snapshot is refused outright (see the module comment);
     * 2. a second caller for the SAME account joins the first one's rotation
     *    instead of spending the rotating token twice.
     */
    private refreshCredentials;
}
//# sourceMappingURL=account-pool.d.ts.map