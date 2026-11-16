/**
 * Claude subscription OAuth sign-in.
 *
 * WHO THIS FILE IS FOR, AND WHAT IT ASSUMES ABOUT UPSTREAM.
 *
 * This module drives the browser sign-in that turns a Claude Pro/Max account
 * into a credential this provider can call /v1/messages with. The wire facts it
 * relies on — authorization endpoint, token endpoint, client id, scope set, the
 * manual-paste redirect URI, the default callback port, the login timeout — all
 * live in the frozen sibling 'types.ts' and are imported from there rather than
 * restated here: one fact, one home.
 *
 * Everything this module could NOT verify is called out inline and collected
 * again in the ASSUMPTIONS block at the bottom of this comment. Treat each one
 * as a claim a later reviewer may need to re-check against the live
 * authorization host: a locally installed reference implementation is an
 * artifact, not a specification.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A COPY OF THE REFERENCE
 * ---------------------------------------------------------------------------
 *
 * The locally installed reference ('@earendil-works/pi-ai',
 * dist/auth/oauth/anthropic.js line 209) sets 'state: verifier' — it reuses the
 * PKCE code verifier AS the OAuth state. That puts the verifier in a URL (the
 * authorize URL, the address bar, browser history, and in the manual flow the
 * clipboard) while the verifier is the one value that is supposed to stay
 * inside this process: PKCE's whole security argument is that an attacker who
 * can READ the authorization request still cannot redeem the code without the
 * verifier. A leaked verifier plus a leaked code is a complete exchange, so
 * this module draws the two values independently and never encodes the
 * verifier anywhere a URL can carry it. 'test/claude-oauth.test.ts' asserts
 * that property directly on the produced URL.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TWO MODES ARE TWO FLOWS
 * ---------------------------------------------------------------------------
 *
 * An authorization code is bound to the redirect_uri of the request that issued
 * it: the token endpoint compares the redirect_uri sent with the exchange
 * against the one recorded with the code and rejects the request when they
 * differ. "Which redirect URI is in the UI right now" is therefore not a value
 * the exchange may read — it has to be the value recorded on the flow that
 * produced the code. So each sign-in is a LoginFlow carrying its own
 * { flowId, mode, redirectUri, verifier, state }, the mode is immutable for
 * that flow's lifetime, and switching mode abandons the flow and starts a new
 * one with fresh secrets. The exchange reads flow.redirectUri and nothing else,
 * which is also what lets a test prove the two modes never share one request.
 *
 * ---------------------------------------------------------------------------
 * ASSUMPTIONS (each one unverifiable from here)
 * ---------------------------------------------------------------------------
 *
 * - A1. "The client registration permits arbitrary ports." The loopback flow
 *   hands the authorization host a redirect URI built from whatever port the
 *   probe resolves, on the theory that a public client registered for a
 *   loopback redirect accepts any port (RFC 8252 section 7.3 says it should,
 *   which is why the port of a loopback redirect is normally ignored). THIS IS
 *   AN ASSUMPTION, NOT A VERIFIED FACT: the registration belongs to Anthropic
 *   and nothing in this repository can read it. If it is false, the browser
 *   callback fails for every port except an exactly registered one — and the
 *   failure is recoverable, because the manual flow exists, the probe already
 *   degrades to it, and the card tells the user why.
 * - A2. The token endpoint accepts the two JSON bodies written below, including
 *   'state' in the authorization_code exchange. Both shapes are transcribed
 *   from the reference implementation; neither was exercised against a live
 *   account from here.
 * - A3. A token response that omits 'refresh_token' means "keep the one you
 *   have" rather than "there is no refresh token". The reference stores the
 *   field unconditionally, which would overwrite a working refresh token with
 *   undefined; this module prefers the stored value. The two readings differ
 *   only in the case where one of them destroys the credential, and losing a
 *   rotating credential is unrecoverable without a fresh sign-in.
 * - A4. 'expires_in' is seconds and the server keeps it inside
 *   [300, 31536000]. That clamp is the reference's own guard, transcribed; a
 *   response outside it is treated as malformed rather than trusted. The
 *   observable consequence of a grant narrower than reported is exactly what
 *   this module already handles: a 401 that forces a refresh, or a final
 *   verdict that forces a new sign-in.
 * - A5. The account endpoint shape for 'account' ({uuid, email_address}) is the
 *   reference's; the fields are parsed defensively and are purely cosmetic.
 * - A6. A browser that resolves 'localhost' to ::1 first will still reach a
 *   listener bound only to 127.0.0.1, because every mainstream browser falls
 *   back across address families (Happy Eyeballs, RFC 8305) when the first
 *   attempt is refused. The redirect URI comes from types.ts's
 *   loopbackRedirectUri(), which spells the authority 'localhost', while the
 *   listener is bound to the 127.0.0.1 literal — binding the wildcard address
 *   instead would expose a one-time authorization code to every interface on
 *   the machine, which is the worse failure.
 *
 *   Corroborated rather than merely assumed: the reference implementation ships
 *   exactly this pairing — `CALLBACK_HOST = "127.0.0.1"` (anthropic.js:16) with
 *   `REDIRECT_URI = \`http://localhost:\${CALLBACK_PORT}\${CALLBACK_PATH}\`` (line 19).
 *   So 'localhost' in the advertised URI with a v4-literal bind is the combination
 *   a working client actually uses, and that is why this module keeps it instead
 *   of "fixing" the spelling to 127.0.0.1: the authority is also what the client
 *   is registered for, so changing it is the riskier edit, not the safer one.
 *   If a browser without the cross-family fallback ever matters, the fix belongs
 *   in types.ts and must be weighed against that registration.
 *
 * ---------------------------------------------------------------------------
 * SECRET HYGIENE
 * ---------------------------------------------------------------------------
 *
 * The authorization code, both tokens and the PKCE verifier never enter a
 * status object, an error message, or a log line. Every error raised here names
 * the CLASS of failure (and at most the HTTP status); none interpolates a
 * credential. Tests assert this by searching the serialized status payload and
 * the thrown messages for the secret material.
 */
import { type Server } from 'node:http';
/**
 * The stored credential is OWNED by the sibling token-store module.
 *
 * Imported as a type and never re-declared here. That direction of dependency is
 * the point: a second structural copy of this shape would drift, and the drift
 * would be silent in the worst direction — the store refuses (or, worse,
 * narrows) a credential this module wrote, so the sign-in succeeds and the very
 * next call reports "not signed in". The concrete trap this avoids:
 * 'token-store.ts' records the granted scopes as a 'scopes' ARRAY and requires
 * 'user:inference' in it, so a credential written with a space-delimited
 * 'scope' string would parse to zero scopes and be refused as "not a
 * subscription credential".
 */
import type { ClaudeAccountInfo, ClaudeCredentials } from './token-store.ts';
export type { ClaudeCredentials };
/**
 * The only store interface this module needs.
 *
 * Deliberately two methods and no class: 'read' returning null means "not
 * signed in", which is a state rather than an error. This module never learns
 * how the bytes reach the disk, so the real store's document layout, its
 * account records and its preference settings are all outside its concern —
 * the caller passes a two-method adapter over whichever of those it holds.
 */
export interface ClaudeTokenStore {
    read(): Promise<ClaudeCredentials | null>;
    write(credentials: ClaudeCredentials): Promise<void>;
}
/** The one interface the loopback listener is ever bound to. */
export declare const LOOPBACK_HOST = "127.0.0.1";
/** Raised when the credential is dead and only a new sign-in can fix it. */
export declare class ClaudeUnauthorizedError extends Error {
    constructor(message: string);
}
/** Raised when a transient failure outlived its retry budget. */
export declare class ClaudeRetryableError extends Error {
    readonly cause?: unknown | undefined;
    constructor(message: string, cause?: unknown | undefined);
}
/** The secrets one authorize request is built from. */
export interface PkceMaterial {
    /** SECRET. Never placed in a URL, a log, or an error. */
    verifier: string;
    /** The only half of the pair that belongs in the authorize URL. */
    challenge: string;
    /** Independent anti-forgery value; NOT derived from the verifier. */
    state: string;
}
/**
 * Generate one flow's PKCE material and state.
 *
 * The verifier is 32 random bytes — the RFC 7636 ceiling for entropy — encoded
 * as base64url, and the challenge is its SHA-256 in the same encoding. The
 * state is a SEPARATE 24-byte draw. Deriving it from the verifier, or reusing
 * the verifier as the reference does, would make the two values one secret and
 * put the verifier in the URL. 24 bytes is comfortably above the 16-byte floor
 * this line requires, and the two are the same length so nothing about their
 * shapes can be used to tell them apart.
 */
export declare function generatePkceMaterial(): PkceMaterial;
/** Account facts a token response may name, in the sibling store's own spelling. */
export type TokenAccount = ClaudeAccountInfo;
/** One parsed token response, in the shape the credential store consumes. */
export interface OAuthTokenResult {
    accessToken: string;
    /** Empty string when the endpoint did not report one; see A3. */
    refreshToken: string;
    expiresAt: number;
    expiresIn: number;
    /** Empty when the endpoint reported no scope at all. */
    scopes: string[];
    account: TokenAccount;
}
interface TokenRequestOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
}
/**
 * Exchange an authorization code for a token pair (RFC 6749 section 4.1.3).
 *
 * 'redirectUri' is passed in rather than resolved here: it must be the value
 * recorded on the flow that issued the code, never a "current UI" value, or the
 * endpoint rejects the exchange.
 */
export declare function exchangeAuthorizationCode(params: {
    code: string;
    state: string;
    verifier: string;
    redirectUri: string;
}, options?: TokenRequestOptions): Promise<OAuthTokenResult>;
/**
 * The 'scope' a refresh sends: never more than the grant holds.
 *
 * RFC 6749 section 6 forbids a refresh from asking for a scope the resource
 * owner did not originally grant. The authorize request asks for OAUTH_SCOPES,
 * but the authorization host strips 'org:create_api_key' from a subscription
 * grant without failing the sign-in. Re-asking for the full authorize set
 * therefore made EVERY refresh an 'invalid_scope' - a final verdict that took
 * the account out of rotation each time the access token aged out, so the line
 * demanded a new sign-in roughly once per token lifetime.
 *
 * The scopes the credential records are the ones the token endpoint reported
 * for this grant, so they are sent back as they are (trimmed, de-duplicated,
 * order kept). A credential that records none falls back to the claude.ai set
 * the official client sends, which also leaves 'org:create_api_key' out.
 */
export declare function refreshScopeFor(grantedScopes: readonly string[] | undefined): string;
/**
 * Refresh an access token, with a bounded retry over transient failures.
 *
 * Only a transient status or a transport failure is retried. A final verdict —
 * ClaudeUnauthorizedError — stops immediately and propagates, because every
 * further attempt would be a guaranteed rejection and, on a rotation endpoint,
 * one more chance to spend the refresh token.
 *
 * 'grantedScopes' is the scope list stored with the credential being refreshed;
 * see {@link refreshScopeFor} for why the request must not ask for more.
 *
 * The returned 'refreshToken' is empty when the endpoint named none; the caller
 * merges that case by keeping the stored value (A3).
 */
export declare function refreshAccessToken(refreshToken: string, options?: TokenRequestOptions & {
    grantedScopes?: readonly string[];
}): Promise<OAuthTokenResult>;
export interface EnsureTokenOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** Refresh even when the stored token still looks valid. */
    force?: boolean;
}
/**
 * Return a usable credential, refreshing and persisting it first when needed.
 *
 * SINGLE-FLIGHT, and that is a correctness property rather than an
 * optimisation. The refresh token rotates: the first refresh spends the token
 * that was sent, so a burst of callers arriving at expiry must NOT each send
 * it. Under the naive implementation the second request carries a token the
 * first already spent, the endpoint answers with a final verdict, and the user
 * is signed out by their own concurrency. One shared promise means exactly one
 * rotation per expiry, and it is cleared in a 'finally' so a FAILED refresh
 * does not wedge the account: the next call retries instead of forever joining
 * a rejected promise.
 */
export declare function ensureAccessToken(store: ClaudeTokenStore, options?: EnsureTokenOptions): Promise<ClaudeCredentials>;
/**
 * Open a URL in the user's default browser, best effort.
 *
 * The caller ALWAYS renders the URL as well, so a machine with no browser, no
 * xdg-open, or a blocked spawn stays usable. The failure is swallowed rather
 * than surfaced because there is no action a user could take on it that they
 * cannot take by copying the URL themselves.
 */
export declare function openBrowser(url: string): void;
/** Which redirect URI an authorization request was issued for. */
export type LoginMode = 'manual' | 'loopback';
/** Where a flow currently stands. */
export type LoginStatus = 'idle' | 'pending' | 'exchanging' | 'complete' | 'error';
/**
 * One sign-in attempt.
 *
 * mode, redirectUri, verifier and state are fixed at creation and never
 * rewritten: an authorization request already in flight is bound to all four,
 * so mutating any of them would silently invalidate the code it returns.
 * 'exchanging' is the compare-and-set word that makes the exchange exactly-once
 * (see beginExchange).
 */
export interface LoginFlow {
    flowId: string;
    /** Immutable for this flow's lifetime; switching mode starts a new flow. */
    readonly mode: LoginMode;
    /** The URI the authorize request carried; the ONLY one the exchange may send. */
    readonly redirectUri: string;
    /** SECRET. */
    readonly verifier: string;
    /** A one-time forgery token, not a credential — but still never logged. */
    readonly state: string;
    readonly createdAt: number;
    /** Where the exchange is in its single-flight lifecycle. */
    exchanging: 'idle' | 'in-progress' | 'done';
}
/**
 * The pollable status of the sign-in surface.
 *
 * NO SECRET EVER APPEARS HERE, and tests enforce that rather than trusting the
 * convention: this object is serialized straight into an HTTP response, so the
 * verifier, the state, the authorization code and both tokens have no field to
 * live in. There is no SSE anywhere in this plugin — the client polls.
 */
export interface LoginFlowStatus {
    status: LoginStatus;
    /** Correlates a status reading with the flow the user started. */
    flowId?: string;
    /** Not a secret: it is the value that goes INTO the browser. */
    authUrl?: string;
    mode?: LoginMode;
    /** Which redirect URI is armed, for the card to display. */
    redirectUri?: string;
    hint?: string;
    error?: string;
    /** Why a loopback attempt degraded to manual. */
    fallbackReason?: string;
    createdAt?: number;
    completedAt?: number;
}
/** Everything a caller may override, so tests never touch the network or a browser. */
export interface BeginLoginOptions {
    /** Not a credential: it decides which redirect URI the flow is issued for. */
    mode?: LoginMode;
    /** Injected so tests do not depend on machine state or on a real browser. */
    fetchFn?: typeof fetch;
    openBrowser?: (url: string) => void;
    /** Injected so a test can drive a callback against a listener it controls. */
    listen?: (port: number, host: string) => Promise<Server>;
    /** Injected so a test can make a port look unavailable. */
    probe?: (port: number) => Promise<boolean>;
    /** Ceiling for this attempt; defaults to LOGIN_TIMEOUT_MS from types.ts. */
    timeoutMs?: number;
}
/**
 * Status of the current (or last) sign-in, for the client to poll.
 *
 * A copy, not the live object: a caller that mutated what it received would
 * otherwise desynchronize the surface from the flow.
 */
export declare function getLoginStatus(): LoginFlowStatus;
/**
 * First usable loopback port, or null when the probe finds none.
 *
 * null rather than a throw is deliberate (see beginLogin): a failed probe is
 * NOT a hard error, it is the signal to fall back to the manual flow. That is
 * exactly why the window has to be wide rather than merely generous: a run of
 * excluded ports wider than CALLBACK_PORT_ATTEMPTS ends this walk early and drops
 * the user into a paste-a-code flow for a reason nothing on screen explains,
 * while the ports immediately behind that run sit free. Windows
 * (Hyper-V/WinNAT) reserves ranges of no fixed width that move on every reboot,
 * so the width of this window, not any assumed block size, is what keeps the
 * sign-in in loopback.
 */
export declare function resolveCallbackPort(probe?: (port: number) => Promise<boolean>, attempts?: number): Promise<number | null>;
/** A value a user pasted into the manual sign-in box, or why it was rejected. */
export type LoginInputResult = {
    ok: true;
    code: string;
    state: string;
} | {
    ok: false;
    error: string;
};
/**
 * Parse the string a user pastes back from the browser.
 *
 * Three shapes are accepted, because the page the manual flow lands on offers
 * the user more than one thing to copy: a full redirect URL, the shortened
 * <code>#<state> pair the page displays, and a bare 'code=..&state=..' query
 * fragment.
 *
 * A BARE CODE IS REJECTED. It cannot be bound to this flow — there is no state
 * to compare against — and forcing the flow's own state into the exchange would
 * defeat the state parameter entirely, turning the manual box into a login-CSRF
 * oracle: anyone who talks a user into pasting a code they supplied would get
 * that user's session bound to the attacker's account. The error says exactly
 * what to copy instead.
 */
export declare function resolveLoginInput(text: string): LoginInputResult;
/**
 * Exchange a manually pasted value.
 *
 * The state is checked against the armed flow BEFORE anything is claimed or
 * sent, so a mistyped paste costs a 400 and leaves the flow usable — the user
 * can simply paste again. Only a value carrying the flow's own state can
 * consume the exactly-once slot, and the CAS result is mapped onto the same
 * 409/410 semantics the callback uses.
 */
export declare function submitLoginInput(text: string, options?: {
    fetchFn?: typeof fetch;
}): Promise<{
    ok: true;
} | {
    ok: false;
    error: string;
    httpStatus: number;
}>;
/** Build the authorize URL for one flow. The VERIFIER IS NOT IN IT. */
export declare function buildAuthorizeUrl(flow: Pick<LoginFlow, 'redirectUri' | 'state'>, challenge: string): string;
/**
 * Start a sign-in and return IMMEDIATELY.
 *
 * The returned status is what the settings card polls; nothing here awaits the
 * exchange, the listener, or the browser, because the HTTP request behind the
 * button must not stay open for the whole authorization.
 *
 * A loopback probe that finds no usable port is NOT a hard error: the flow
 * degrades to manual and the caller is told why, since the manual flow needs no
 * port at all and a user whose Windows excluded range covers the default should
 * not be blocked from signing in.
 */
export declare function beginLogin(store: ClaudeTokenStore, options?: BeginLoginOptions): Promise<LoginFlowStatus>;
/**
 * Abandon the current sign-in and return to idle.
 *
 * Aborts the flow's controller (so an in-flight exchange or timer stops),
 * closes the listener AND its connections (a closed listener with a live
 * keep-alive socket still holds the port), and clears the flow so the next
 * beginLogin starts from a clean slate instead of inheriting a spent
 * exactly-once slot.
 */
export declare function cancelLogin(): void;
//# sourceMappingURL=oauth.d.ts.map