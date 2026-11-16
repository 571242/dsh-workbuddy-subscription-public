/**
 * WorkBuddy account identity, resolved from the credential itself.
 *
 * The defect this exists to prevent: {@link workBuddyAccountId} falls back to
 * `nickname` when no uid is present, and the browser-login response carries the
 * display name but no uid — so signing in to an account that the IDE already
 * holds produced `intl:<e-mail>` from the login while the very same account
 * scanned from the IDE's own `*.info` file produced `intl:<uuid>`. Two ids
 * meant two pool rows, two entries in `/accounts` and two cards for one
 * account, which is exactly what users reported as "the same account appears
 * twice". The same fallback is why a credential that carried no display name at
 * all was labelled "账号 1".
 *
 * A display name is not an identity. The access token is a Keycloak JWT whose
 * `sub` is the account's stable uid on both deployments (measured against a
 * live domestic and international token), so the identity is read from there
 * and the file's or response's own fields are used only for what the token
 * cannot supply.
 */
import type { WorkBuddyCredentials } from './token-store.ts';
/** Identity facts a token or a login response can state about one account. */
export interface WorkBuddyTokenIdentity {
    uid?: string;
    nickname?: string;
    uin?: string;
    enterpriseId?: string;
}
/**
 * Decode a JWT's payload without verifying it.
 *
 * Nothing here is a security decision: the claims only name the account so the
 * plugin can tell two credentials apart. The token is still validated by the
 * gateway on every request, so an unverified claim cannot grant anything — it
 * can at most make two accounts look alike, which the request path would then
 * reject on its own.
 *
 * Returns null for an opaque or malformed token rather than throwing: a
 * non-JWT access token is a legitimate shape this route must keep working with.
 */
export declare function decodeAccessTokenClaims(accessToken: string): Record<string, unknown> | null;
/** Read the identity facts one decoded claim set states. */
export declare function identityFromClaims(claims: Record<string, unknown>): WorkBuddyTokenIdentity;
/** Identity facts an access token states, or an empty object when it states none. */
export declare function identityFromAccessToken(accessToken: string): WorkBuddyTokenIdentity;
/**
 * Whether a credential names its own account.
 *
 * {@link workBuddyAccountId} falls back to the auth domain, which is a property
 * of the deployment rather than of the account: two accounts on one deployment
 * would share it. A credential that states no uid, UIN or display name
 * therefore has no identity to derive, and a caller holding a meaningful key
 * already — a row the pool stored under one — must keep it instead of
 * replacing it with a domain-derived key.
 */
export declare function hasStableIdentity(credentials: Pick<WorkBuddyCredentials, 'uid' | 'uin' | 'nickname'>): boolean;
/**
 * Backfill a credential's identity from its own access token.
 *
 * The token's `sub` is the account's uid, so it wins over a stored value that
 * disagrees with it: that stored value can only have come from the login path
 * that promoted a display name into `uid`, which is the record this function
 * exists to heal. The displaced value is kept as the nickname when nothing else
 * names the account, so a healed row still reads as something a person
 * recognizes instead of an opaque uuid.
 *
 * Every other field is only filled in when the credential does not state it:
 * what the IDE's file or the login response already records is not second
 * guessed from a token.
 */
export declare function withResolvedIdentity<T extends WorkBuddyCredentials>(credentials: T): T;
//# sourceMappingURL=identity.d.ts.map