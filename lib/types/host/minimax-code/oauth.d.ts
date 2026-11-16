/**
 * OAuth for the MiniMax Code subscription.
 *
 * The flow is RFC 8628 device authorization with PKCE(S256) against a public
 * client (`mcode-public`, no secret) — the shape the desktop app uses, and the
 * only one that fits a plugin with no browser callback to receive.
 *
 * Measured facts that shape this file (brief section 2.5):
 *
 * - device authorization: POST `account.minimax.cn/oauth2/device/code`
 * - token (device grant AND refresh): POST `account.minimax.cn/oauth2/token`
 * - revocation: POST `account.minimax.cn/oauth2/revoke`
 * - every call is `application/x-www-form-urlencoded` with `Accept: application/json`
 * - the device grant carries `code_challenge`/`code_challenge_method=S256` and the
 *   poll carries the matching `code_verifier`
 * - the refresh carries `grant_type=refresh_token`, `refresh_token`, `client_id`,
 *   `scope` and `audience`
 *
 * The refresh policy is the one the brief fixes at section 2.6: read the stored
 * credential first and use it while it is valid, refresh only when it is not (or
 * when the service has just rejected it), write the rotation back atomically, and
 * never let a failed refresh damage the file MiniMax Code itself depends on.
 */
import type { MinimaxCodeAccount, MinimaxCodeRegion, MinimaxCodeWebLogin } from '../../shared/minimax-code-contracts.ts';
import { accountHost } from './types.ts';
import { type MinimaxCodeCredentialStore, type MinimaxCodeCredentials } from './token-store.ts';
/** Raised when the stored credential was rejected and a new sign-in is required. */
export declare class MinimaxCodeUnauthorizedError extends Error {
    constructor(message: string);
}
/** Raised when a transient failure outlived its retry budget. */
export declare class MinimaxCodeRetryableError extends Error {
    constructor(message: string, cause?: unknown);
}
/** Raised when the user denied the device authorization request. */
export declare class MinimaxCodeAccessDeniedError extends Error {
    constructor(message: string);
}
/**
 * One PKCE pair (RFC 7636).
 *
 * The verifier is a fresh random string per authorization; the challenge is its
 * SHA-256 digest, both base64url encoded with no padding, which is what S256
 * means on the wire.
 */
export declare function createPkcePair(): {
    verifier: string;
    challenge: string;
};
/** Parsed device authorization response. */
export interface DeviceAuthorization {
    userCode: string;
    deviceCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
    interval: number;
    /** PKCE verifier the matching poll must present. */
    codeVerifier: string;
    /** Region the authorization was requested in; decides every later host. */
    region: MinimaxCodeRegion;
}
/**
 * Start a device authorization (RFC 8628 section 3.1).
 *
 * A public client sends its `client_id`, the scope and audience it wants, and the
 * PKCE challenge — no secret, which is the whole point of the device profile.
 */
export declare function requestDeviceAuthorization(options?: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    region?: MinimaxCodeRegion;
}): Promise<DeviceAuthorization>;
/** One token response, in the shape the store persists. */
export interface MinimaxToken {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresInSec: number;
    expiresAtMs: number;
    scope: string;
}
/** Outcome of one device-token poll. */
export type DevicePollOutcome = {
    kind: 'success';
    token: MinimaxToken;
} | {
    kind: 'pending';
    slowDown: boolean;
} | {
    kind: 'expired';
};
/**
 * Poll the token endpoint once for one device code (RFC 8628 section 3.4).
 *
 * A 5xx is a transport-class failure rather than a verdict on the device code, so
 * it is raised for the caller's retry loop instead of being read as "still
 * pending" — treating it as pending would spin against a broken endpoint until the
 * device code expired.
 */
export declare function pollDeviceToken(authorization: Pick<DeviceAuthorization, 'deviceCode' | 'codeVerifier' | 'region'>, options?: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
}): Promise<DevicePollOutcome>;
/**
 * Refresh an access token, with a bounded retry.
 *
 * Only a transient status or a transport failure is retried. A 400/401/403, or an
 * `invalid_grant` body, is a verdict that the refresh token is dead and stops
 * immediately: retrying it can never succeed, and every attempt is a request the
 * subscription pays for.
 */
export declare function refreshAccessToken(refreshToken: string, options: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    region: MinimaxCodeRegion;
}): Promise<MinimaxToken>;
/**
 * Revoke one token at the service.
 *
 * Best effort by design: a revocation that cannot reach the service must not stop
 * a local sign-out, because the credential is already gone from this machine.
 */
export declare function revokeToken(token: string, options: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    region: MinimaxCodeRegion;
}): Promise<boolean>;
/** Start a device-code sign-in and hand the card what it must display. */
export declare function beginWebLogin(options?: {
    fetchFn?: typeof fetch;
    region?: MinimaxCodeRegion;
    signal?: AbortSignal;
}): Promise<MinimaxCodeWebLogin>;
/** The public projection of one live sign-in, for the status route. */
export declare function getWebLogin(loginId: string): MinimaxCodeWebLogin | null;
/** Cancel one sign-in, dropping the session so a later poll cannot resume it. */
export declare function cancelWebLogin(loginId: string): boolean;
/** Forget every session; used by the test seam and by a full sign-out. */
export declare function resetWebLogins(): void;
/** Build the account projection one credential yields. */
export declare function accountFromCredentials(credentials: {
    loginEpoch: string;
    generation: number;
    expiresAtMs: number;
    region: MinimaxCodeRegion;
}): MinimaxCodeAccount;
export { accountHost };
/** Whether the given refresh token was rejected recently. */
export declare function isRefreshTokenRejected(refreshToken: string): boolean;
/** Test seam: forget every remembered rejection. */
export declare function resetRefreshRejections(): void;
/** Test seam: forget every in-flight rotation. */
export declare function resetInFlightRefreshes(): void;
export interface EnsureTokenOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** Refresh even when the stored token is not near expiry (used after a 401). */
    force?: boolean;
}
/**
 * Return a usable access token, refreshing and writing back only when needed.
 *
 * This is the whole of the contention discipline in one function:
 *
 * 1. read the stored credential and use it as-is while it is comfortably valid —
 *    the common case, and the one that never touches the file or the network;
 * 2. renew EARLY (PRE_EXPIRY_REFRESH_MS before expiry) rather than at the boundary
 *    the service refuses at, or when `force` reports a 401 the service has already
 *    issued;
 * 3. share one rotation between concurrent callers of the SAME credential, and go
 *    through the store's rotation registry so a rotation the desktop app is doing
 *    to the same file is waited for rather than raced;
 * 4. write the result back through the store's atomic replacement, and remember a
 *    rejection only when the credential on disk is still the rejected one.
 *
 * Step 4 is the one the every-hour sign-out hung on. `invalid_grant` used to be
 * recorded unconditionally, but that verdict has two possible meanings and only
 * one of them is "this sign-in is dead":
 *
 * - the token really is revoked (`invalid_grant` / `invalid_client`), which is a
 *   sign-in problem;
 * - another holder of the very same session rotated first, so the token this call
 *   presented was already spent. The service cannot tell the two apart, and the
 *   plugin must not either — so it looks at the file. A credential newer than the
 *   one it presented means somebody else rotated successfully, and that credential
 *   is adopted instead of being buried under a tombstone.
 */
export declare function ensureAccessToken(store: MinimaxCodeCredentialStore, options?: EnsureTokenOptions): Promise<MinimaxCodeCredentials>;
/**
 * Poll one live sign-in once and, on success, persist what it produced.
 *
 * The persisted credential is plugin-owned: a device-code sign-in started here
 * has no record in the desktop app's `auth.json` (its record key embeds a hash
 * this plugin cannot reproduce), so writing a fabricated entry there would leave
 * the app with an entry it never reads.
 */
export declare function pollWebLogin(store: MinimaxCodeCredentialStore, loginId: string, options?: {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /**
     * Called with the credential a completed sign-in produced, after it has been
     * persisted.
     *
     * The single-credential store cannot express a second account, so without this
     * a sign-in started from the card would never join the pool: the pool would
     * keep serving its existing accounts, and the user's new sign-in would exist
     * only as the mirror file. The pool installs this hook and adds the credential
     * as its own account.
     *
     * A failure here must not fail the sign-in: the credential is already durable,
     * and the pool is a routing convenience on top of it. The caller receives the
     * authenticated verdict either way.
     */
    onSave?: (credentials: MinimaxCodeCredentials) => Promise<void>;
}): Promise<{
    status: 'pending' | 'authenticated' | 'expired' | 'denied';
    account?: MinimaxCodeAccount;
}>;
//# sourceMappingURL=oauth.d.ts.map