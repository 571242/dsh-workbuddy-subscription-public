import type { CredentialStorageDto } from '../shared/contracts.ts';
/**
 * The adoption markers, as they hang off a credential this package stores.
 *
 * FLATTENED onto the credential rather than nested under it, for the same reason
 * the Claude line flattens its own: the pool's hooks (needsRefresh, refresh,
 * authRejectedReason) receive the CREDENTIAL and never the account record, so the
 * marker has to be reachable from there, and every other field a pooled row reads
 * already sits at the top level.
 *
 * A borrowed snapshot is never refreshed (the refresh token belongs to the client
 * that wrote the file, and two programs spending it invalidate each other), so the
 * marker is the whole difference between a row this plugin may rotate and a row
 * that is a snapshot until it expires. It is written on EVERY account the pool
 * creates, including the explicit false case, because the core merges a
 * re-authorization as { ...existing, ...created } and an omitted key would leave a
 * stored 'adopted: true' behind.
 */
export interface AdoptedCredentialMarkers {
    /** Literal true on a credential copied out of another application's sign-in. */
    adopted?: true;
    /** Which local sign-in it was taken from, e.g. 'codex'. */
    source?: string;
    /** The exact file it was read from, so a card can name it. */
    sourcePath?: string;
}
export interface StoredOAuthCredentials extends AdoptedCredentialMarkers {
    accessToken: string;
    refreshToken: string;
    idToken?: string;
    expiresAt: number;
    accountId?: string;
    email?: string;
    planType?: string;
}
export interface CredentialStore<T> {
    load(): Promise<T | null>;
    save(value: T): Promise<void>;
    clear(): Promise<void>;
}
export interface TokenStore extends CredentialStore<StoredOAuthCredentials> {
    readonly storage: Omit<CredentialStorageDto, 'available'>;
}
/** Test seam and non-persistent development store. Never used by apply(). */
export declare class MemoryTokenStore implements TokenStore {
    readonly storage: {
        readonly kind: "memory";
        readonly encrypted: false;
    };
    private value;
    load(): Promise<StoredOAuthCredentials | null>;
    save(value: StoredOAuthCredentials): Promise<void>;
    clear(): Promise<void>;
}
export declare function parseStoredCredentials(value: unknown): StoredOAuthCredentials;
//# sourceMappingURL=token-store.d.ts.map