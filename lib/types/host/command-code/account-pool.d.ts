import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import { FileCredentialStore, type CommandCodeCredentials } from './token-store.ts';
import type { CommandCodeAccountQuota, CommandCodeAccountSummaryDto, CommandCodeApiEnv } from '../../shared/command-code-contracts.ts';
import type { PoolAccountQuotaDto } from '../../shared/account-pool-contracts.ts';
/**
 * One cached snapshot as the shared account card renders it.
 *
 * A usage window states its own consumed share, so it maps straight across; a
 * window whose share nobody measured is dropped rather than drawn at 0, which
 * would claim an unspent window no reading supports.
 *
 * Exported for the pool's regression tests; the card only reaches it through
 * the summary hook.
 */
export declare function commandCodePoolQuota(cached: CommandCodeAccountQuota): PoolAccountQuotaDto | undefined;
/** One pooled Command Code key: the bearer key plus the account facts the card renders. */
export interface CommandCodePoolAccount extends PoolAccountShape<CommandCodeCredentials> {
    email?: string;
    userName?: string;
    keyName?: string;
    organizationName?: string;
    planLabel?: string;
    planId?: string;
    userId?: string;
}
export type { CommandCodeAccountSummaryDto };
/** Encrypted pool file this line owns; the pre-pool credential file stays the mirror. */
export declare function commandCodePoolPath(): string;
/**
 * Stable identity of one key.
 *
 * A user id plus the key name is what Command Code Studio itself shows, so two
 * keys minted from the same account stay distinguishable; without a user id the
 * key's digest is the identity. The digest is never written anywhere.
 */
export declare function commandCodeAccountKey(credentials: CommandCodeCredentials): string;
/** Validate and normalize one whole pool document. */
export declare function parseCommandCodePoolData(value: unknown): PoolData<CommandCodePoolAccount>;
export interface CommandCodeAccountPoolOptions {
    /** Pre-pool credential file the pool mirrors its primary account into. */
    store?: FileCredentialStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<CommandCodePoolAccount>>;
    /** Accounts this pool accepts; defaults to the core's limit. */
    maxAccounts?: number;
}
/**
 * Command Code's account pool.
 *
 * A Command Code credential is a long-lived bearer key with nothing to refresh,
 * so this wrapper only supplies identity, display facts and the mirror of the
 * single-credential file the plugin used before the pool existed.
 */
export declare class CommandCodeAccountPool extends AccountPoolCore<CommandCodeCredentials, CommandCodePoolAccount, CommandCodeAccountSummaryDto> {
    private readonly store;
    constructor(options?: CommandCodeAccountPoolOptions);
    /**
     * Pick the key for the next request, with the API environment it belongs to.
     *
     * A key issued for one deployment must not be sent to another, so the
     * environment travels with the credential rather than with the process.
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: CommandCodePoolAccount;
        credentials: CommandCodeCredentials;
        apiEnv: CommandCodeApiEnv;
    }>;
    /** The pre-pool credential file this pool mirrors its primary account into. */
    mirrorStore(): FileCredentialStore;
}
//# sourceMappingURL=account-pool.d.ts.map