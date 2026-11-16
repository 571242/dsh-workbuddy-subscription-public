import type { CredentialStore, TokenStore, StoredOAuthCredentials } from './token-store.ts';
export declare function defaultDpapiCredentialPath(): string;
export declare class WindowsDpapiCredentialStore<T> implements CredentialStore<T> {
    private readonly path;
    private readonly parse;
    readonly storage: {
        readonly kind: "windows-dpapi";
        readonly encrypted: true;
    };
    /**
     * Decrypted snapshot, validated against the file's own mtime and size.
     *
     * Every uncached read is a spawned `powershell.exe` (~200 ms), and one
     * settings request reads several credentials, so the snapshot is what keeps a
     * tab switch from costing seconds.
     */
    private readonly cache;
    constructor(path: string, parse: (value: unknown) => T);
    load(): Promise<T | null>;
    save(value: T): Promise<void>;
    clear(): Promise<void>;
}
export declare class WindowsDpapiTokenStore extends WindowsDpapiCredentialStore<StoredOAuthCredentials> implements TokenStore {
    constructor(path?: string);
}
//# sourceMappingURL=token-store-windows.d.ts.map