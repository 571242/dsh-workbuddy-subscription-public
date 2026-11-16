import type { LoginEventDto, LoginStartDto, OAuthStatusDto, PublicErrorDto } from '../shared/contracts.ts';
import type { CodexAccountPool } from './codex-account-pool.ts';
import type { StoredOAuthCredentials, TokenStore } from './token-store.ts';
type FetchLike = typeof fetch;
type LoginListener = (event: LoginEventDto) => void;
interface OAuthClaims {
    email?: unknown;
    chatgpt_account_id?: unknown;
    chatgpt_plan_type?: unknown;
    organizations?: Array<{
        id?: unknown;
    }>;
    'https://api.openai.com/auth'?: {
        chatgpt_account_id?: unknown;
        chatgpt_plan_type?: unknown;
        organizations?: Array<{
            id?: unknown;
        }>;
    };
}
export declare class OAuthServiceError extends Error {
    readonly code: PublicErrorDto['code'];
    /** Token-endpoint status when the failure came from a response. */
    readonly status?: number | undefined;
    constructor(code: PublicErrorDto['code'], message: string, 
    /** Token-endpoint status when the failure came from a response. */
    status?: number | undefined);
}
/**
 * How the credential will be used, which decides who may serve it.
 *
 * `'request'` (default) is a metered model request: rotation, cooldowns and the
 * pool's cached-quota verdict all apply.
 *
 * `'tool'` is a ChatGPT call that is *not* metered against the Codex
 * rate-limit window — web search, web fetch, image generation. It reads the
 * account already serving the conversation and ignores cooldowns, because a
 * spent Codex window must not take those tools offline; they keep working with
 * the very same access token.
 */
export type CredentialPurpose = 'request' | 'tool';
export interface CredentialAccess {
    /** Defaults to `'request'`. */
    purpose?: CredentialPurpose;
}
export interface OAuthServiceOptions {
    fetchFn?: FetchLike;
    now?: () => number;
    random?: (size: number) => Buffer;
    logger?: Pick<Console, 'info' | 'warn'>;
    /** Test seam; production always uses the five-minute compatibility default. */
    loginTimeoutMs?: number;
    /**
     * Account pool this service drives.
     *
     * With a pool the service signs accounts in and refreshes them per account
     * while the pool decides which one serves a request; without one it keeps
     * serving the single stored credential exactly as before.
     */
    pool?: CodexAccountPool;
}
export declare class OAuthService {
    private readonly store;
    private readonly fetchFn;
    private readonly now;
    private readonly random;
    private readonly logger;
    private readonly loginTimeoutMs;
    private readonly loginEvents;
    private readonly listeners;
    private activeLogin;
    private refreshPromise;
    private lastLoginError;
    private disposed;
    private readonly pool;
    /**
     * Bumped whenever this process writes credentials.
     *
     * Combined with the pool's own revision by {@link currentIdentityRevision} so
     * a caller can tell whether the account behind the credentials may have moved
     * without paying for a credential read to find out.
     */
    private credentialRevision;
    private readonly refreshInFlight;
    constructor(store: TokenStore, options?: OAuthServiceOptions);
    status(): Promise<OAuthStatusDto>;
    /**
     * The pool slice of the status DTO.
     *
     * A pool that cannot be read is reported as empty rather than failing the
     * whole status call: the card must still render the connection section.
     */
    private readPoolStatus;
    startLogin(): Promise<LoginStartDto>;
    cancelLogin(loginId: string): void;
    subscribe(loginId: string, listener: LoginListener): (() => void) | null;
    refresh(): Promise<OAuthStatusDto>;
    /**
     * Sign out.
     *
     * @param accountId - pooled account to remove; omit to remove the account
     *   that would serve the next request (the pool promotes another one), which
     *   is what a single "sign out" button means to a pool user.
     */
    logout(accountId?: string): Promise<void>;
    /**
     * A cheap, in-memory verdict on whether the serving account may have changed.
     *
     * Reading a credential is expensive — on Windows it is a DPAPI unprotect
     * through a spawned `powershell.exe` (~200 ms) — so a per-account cache must
     * not have to read one just to learn that it is still the same account.
     * Comparing this value against a previously observed one costs nothing, and
     * any path that can move which account serves a request bumps it: a pool
     * write (sign-in, delete, pin, rotation) or a credential write in this
     * process (sign-in, logout, token refresh).
     *
     * It is deliberately conservative: a spurious change costs one credential
     * read, while a missed change would report one account's data under another
     * account's name.
     */
    currentIdentityRevision(): number;
    /**
     * The credential to use next.
     *
     * @param forceRefresh - refresh even a token that is not close to expiry,
     *   which is how a 401 discovered mid-request recovers.
     * @param access - who is asking. A `'tool'` caller (web search, fetch, image
     *   generation) bypasses the pool's rotation state: an account cooling down
     *   after a Codex 429 still holds a working token for those endpoints, and
     *   refusing it there turned "your Codex window is spent" into a bogus
     *   "credentials are required" on every web search.
     */
    credentials(forceRefresh?: boolean, access?: CredentialAccess): Promise<StoredOAuthCredentials>;
    /**
     * The credential to use next, together with the pool row that owns it.
     *
     * The settings card keys each account's quota snapshot by the row the reading
     * was made for, and the credential cannot do that job: a refresh rotates its
     * tokens, and an account may state no id of its own. Callers that care about
     * identity ask here; every other caller keeps using {@link credentials} and
     * sees no difference.
     *
     * @param forceRefresh - refresh even a token that is not close to expiry.
     * @param access - who is asking; see {@link credentials}.
     */
    credentialSelection(forceRefresh?: boolean, access?: CredentialAccess): Promise<{
        accountId?: string;
        credentials: StoredOAuthCredentials;
    }>;
    /** Start the managed-account pre-expiry credential check after initialization. */
    startBackgroundRefresh(): void;
    /** Re-arm the one-shot expiry timer after a credential change. */
    scheduleBackgroundRefresh(delay?: number): void;
    refreshManagedAccounts(): Promise<PromiseSettledResult<unknown>[]>;
    dispose(): void;
    private exchangeCode;
    private refreshCredentials;
    /**
     * Refresh one account's tokens on behalf of the pool.
     *
     * Deliberately different from the single-credential path: a rejected refresh
     * token must NOT wipe the whole credential store (other pooled accounts are
     * unaffected), and the write-back belongs to the pool, which owns the account
     * record. Concurrent calls for one identity share a single redemption, since
     * the refresh token rotates.
     */
    refreshAccount(credentials: StoredOAuthCredentials, fetchFn?: FetchLike): Promise<StoredOAuthCredentials>;
    private performRefresh;
    private loadAuthenticated;
    private statusFromCredentials;
    private completeLogin;
    private failLogin;
    private cancelActive;
    private publish;
    private assertAvailable;
}
export declare function buildAuthorizationUrl(verifier: string, state: string): string;
export declare function parseJwtClaims(token: string | undefined): OAuthClaims | undefined;
export declare function publicError(error: unknown, fallback?: PublicErrorDto['code']): PublicErrorDto;
export {};
//# sourceMappingURL=oauth-service.d.ts.map