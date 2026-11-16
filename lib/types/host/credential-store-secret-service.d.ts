import type { CredentialStore } from './token-store.ts';
/** Secrets travel over stdin/stdout; command arguments contain only lookup attributes. */
export declare class SecretServiceCredentialStore<T> implements CredentialStore<T> {
    private readonly service;
    private readonly account;
    private readonly parse;
    private readonly cache;
    constructor(service: string, account: string, parse: (value: unknown) => T);
    private attributes;
    /**
     * Lookup attributes of one shard entry. Secret Service matching is exact on
     * every given attribute pair, so the primary account value never matches a
     * shard and vice versa.
     */
    private shardAttributes;
    load(): Promise<T | null>;
    save(value: T): Promise<void>;
    /**
     * Store an oversized payload as shard entries plus an envelope. The shards
     * are written under a fresh generation tag first and the primary entry last:
     * that entry is the commit point, so an interrupted save leaves the previous
     * envelope and its shards fully intact and the new generation is either
     * committed whole or cleaned up.
     */
    private saveChunked;
    /**
     * Envelope of the currently stored value, or null when the entry is missing,
     * holds a plain value, or cannot be read at all. A save that goes on to fail
     * surfaces its own error, so a probe failure must not fail the save first.
     */
    private storedEnvelope;
    /**
     * Remove shard entries, tolerating the ones that are already gone. A missing
     * entry exits 1 with empty stderr — the same shape a segfaulting secret-tool
     * takes through the close event (Ubuntu libsecret-tools 0.20.4 crashes on
     * clearing an entry that does not exist) — so that answer is never an error.
     */
    private clearShards;
    clear(): Promise<void>;
}
//# sourceMappingURL=credential-store-secret-service.d.ts.map