import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import { FileCredentialStore, type KimiCodeCredentials } from './token-store.ts';
import type { PoolAccountQuotaDto } from '../../shared/account-pool-contracts.ts';
import type { KimiCodeAccountQuota, KimiCodeAccountSummaryDto, KimiCodeRegion } from '../../shared/kimi-code-contracts.ts';
/** One pooled Kimi Code account: the token pair plus the facts the card renders. */
export interface KimiCodePoolAccount extends PoolAccountShape<KimiCodeCredentials> {
    email?: string;
    nickname?: string;
    userId?: string;
    planName?: string;
    region?: KimiCodeRegion;
}
/** Encrypted pool file this line owns; the pre-pool credential file stays the mirror. */
export declare function kimiCodePoolPath(): string;
/** Validate and normalize one whole pool document. */
export declare function parseKimiCodePoolData(value: unknown): PoolData<KimiCodePoolAccount>;
export interface KimiCodeAccountPoolOptions {
    /** Pre-pool credential file the pool mirrors its primary account into. */
    store?: FileCredentialStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<KimiCodePoolAccount>>;
    /** Accounts this pool accepts; defaults to the core's limit. */
    maxAccounts?: number;
}
/**
 * One account's own newest quota snapshot, in the shape the account card draws.
 *
 * The snapshot comes from 'client.ts''s per-account cache keyed by the pool
 * account id, and this is where this line's own numbers are translated into the
 * shared shape. Every judgement below trades a possibly-nice-looking bar for an
 * honest one:
 *
 * - a window whose consumed share nobody measured is DROPPED (`quotaWindow`
 *   returns null), because "0% used" and "not stated" are different claims. This
 *   parser only mints a window once it has a ratio, so a window that states none
 *   never reaches here at all — the drop is the second line of defence;
 * - `resetsAt` is already Unix MILLISECONDS on this line, so it is passed
 *   through and normalized rather than multiplied;
 * - the read time is the snapshot's own `fetchedAt`, which this line always
 *   sets. A snapshot with no read time is not a snapshot, and `poolQuota`
 *   reports that as undefined.
 *
 * A null snapshot means "this account was never read", which the card renders as
 * exactly that instead of drawing a zero.
 */
export declare function kimiCodePoolQuota(snapshot: KimiCodeAccountQuota | null): PoolAccountQuotaDto | undefined;
/**
 * Kimi Code's account pool.
 *
 * The credential is an OAuth pair whose refresh token rotates, so the pool owns
 * both the refresh and the write-back: two accounts must never be refreshed
 * through the same single-credential file.
 */
export declare class KimiCodeAccountPool extends AccountPoolCore<KimiCodeCredentials, KimiCodePoolAccount, KimiCodeAccountSummaryDto> {
    private readonly store;
    constructor(options?: KimiCodeAccountPoolOptions);
    /**
     * Pick the account for the next request.
     *
     * The returned credential carries its own region, OAuth host and base URL, so
     * the caller must use those rather than the process-wide defaults.
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: KimiCodePoolAccount;
        credentials: KimiCodeCredentials;
    }>;
    /** The pre-pool credential file this pool mirrors its primary account into. */
    mirrorStore(): FileCredentialStore;
}
//# sourceMappingURL=account-pool.d.ts.map