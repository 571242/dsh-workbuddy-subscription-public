import type { StoredOAuthCredentials } from './token-store.ts';
/**
 * Turn-state header the Codex backend hands back on a responses response.
 *
 * The official CLI reads it and echoes it on the SAME TURN's next request — a
 * retry, an incremental append or a continuation — and the backend uses it to
 * resume instead of re-ingesting the whole history.
 *
 * Its scope is exactly one turn. The official client builds a fresh per-turn
 * session and documents that reusing one across turns violates the
 * client/server contract and can cause routing bugs; the token is also
 * account-scoped and is discarded when auth ownership changes. It is opaque,
 * short-lived, and threaded through rather than computed (see
 * `responses-client.ts`).
 */
export declare const CODEX_TURN_STATE_HEADER = "x-codex-turn-state";
export interface CodexHeaderOptions {
    /** Opaque state from an earlier request in the SAME human turn, if available. */
    turnState?: string;
}
export declare function codexHeaders(credentials: StoredOAuthCredentials, sessionId?: string, options?: CodexHeaderOptions): Record<string, string>;
/**
 * Opaque local identity of whoever signs a request.
 *
 * Turn state is account-scoped, so the client has to detect when the signer
 * changed without ever putting that fact on the wire. The digest is computed
 * and compared locally: it is not a header, not a credential, and never logged.
 */
export declare function authOwnerKey(credentials: StoredOAuthCredentials): string;
export declare function stableSessionId(value: string | undefined): string;
export declare function retryAfterMs(headers: Headers): number | undefined;
//# sourceMappingURL=wire-auth.d.ts.map