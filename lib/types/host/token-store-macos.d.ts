import type { CredentialStore, TokenStore, StoredOAuthCredentials } from './token-store.ts';
/**
 * macOS credential storage backed by the login Keychain through the built-in
 * `security` command-line tool. The payload is encrypted at rest by the
 * Keychain, so this store reports itself as encrypted like Windows DPAPI.
 */
export declare class MacKeychainCredentialStore<T> implements CredentialStore<T> {
    private readonly service;
    private readonly account;
    private readonly parse;
    readonly storage: {
        readonly kind: "macos-keychain";
        readonly encrypted: true;
    };
    /**
     * Snapshot of the last keychain read.
     *
     * A keychain lookup spawns `security`, and one settings request performs
     * several of them. There is no file to compare against, so the snapshot is
     * keyed on a short time bucket instead — see
     * {@link keyringCredentialIdentity}.
     */
    private readonly cache;
    constructor(service: string, account: string, parse: (value: unknown) => T);
    load(): Promise<T | null>;
    save(value: T): Promise<void>;
    clear(): Promise<void>;
}
/**
 * `security find-generic-password -w` normally prints the stored password as
 * text, but macOS prints the underlying bytes as hexadecimal when the payload
 * contains characters it does not consider safely printable. Credential pools
 * can contain localized account names, so accept both representations.
 */
export declare function parseSecurityPayload(stdout: string): unknown;
export declare class MacKeychainTokenStore extends MacKeychainCredentialStore<StoredOAuthCredentials> implements TokenStore {
    constructor(service?: string, account?: string);
}
//# sourceMappingURL=token-store-macos.d.ts.map