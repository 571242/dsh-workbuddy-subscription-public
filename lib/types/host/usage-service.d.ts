import type { ConnectionTestDto, PublicErrorDto, QuotaBucketDto, QuotaUsageDto, QuotaStatusDto } from '../shared/contracts.ts';
import { OAuthService } from './oauth-service.ts';
import type { StoredOAuthCredentials } from './token-store.ts';
type FetchLike = typeof fetch;
export interface UsageServiceOptions {
    fetchFn?: FetchLike;
    now?: () => number;
}
/** How one status read may treat a snapshot that has aged past its TTL. */
export interface UsageStatusOptions {
    /**
     * Answer from an existing snapshot and refresh behind it, instead of waiting
     * for the upstream request. A caller that must not show aged numbers — or has
     * no snapshot to show — leaves this off.
     */
    backgroundRefresh?: boolean;
}
export declare class UsageService {
    private readonly oauth;
    private readonly fetchFn;
    private readonly now;
    private cache;
    private readonly snapshots;
    private lastUpstreamAt;
    private blockedUntil;
    private invalidated;
    /**
     * Serving identity observed when {@link cache} was written.
     *
     * A warm snapshot may only be served while this still matches, which is what
     * keeps the cheap early return below from reporting one account's quota under
     * another account's name.
     */
    private cacheIdentityRevision;
    private inFlight;
    private resetConsumeInFlight;
    constructor(oauth: OAuthService, options?: UsageServiceOptions);
    status(authenticated: boolean, force?: boolean, options?: UsageStatusOptions): Promise<QuotaStatusDto>;
    /** Whether a quota refresh is running, so a caller can ask again when it lands. */
    get refreshing(): boolean;
    /**
     * Refresh behind an answer that has already been given.
     *
     * The rejection is absorbed here: this refresh has no caller to receive it,
     * and {@link fromCache} keeps serving the snapshot it failed to replace.
     */
    private startBackgroundRefresh;
    invalidate(): void;
    /**
     * When one credential's Codex window reopens, from the last snapshot.
     *
     * Undefined means nothing is known or nothing is spent (the account stays
     * routable). A spent window with no stated reset blocks for the default
     * cooldown rather than forever, so a missing upstream field cannot strand an
     * account permanently.
     */
    blockedUntilFor(accountId: string | undefined, credentials: StoredOAuthCredentials, now: number): number | undefined;
    /**
     * The newest quota snapshot held for one account, if any.
     *
     * Quota follows the account, so the settings card shows each account its own
     * progress. The pool asks here with the row id it addresses the account by —
     * the identity that survives a token refresh — while its credentials answer
     * for a composition without a pool. This reads the remembered map only, never
     * the network, because opening the settings page must not cost one upstream
     * request per pooled account.
     */
    snapshotFor(accountId: string | undefined, credentials: StoredOAuthCredentials): {
        usage: QuotaUsageDto;
        fetchedAt: number;
    } | undefined;
    /**
     * Key one account's remembered snapshot is filed under.
     *
     * A pool row id when the caller names one, prefixed so it can never be
     * confused with the credential-derived key, and otherwise the credential
     * identity — which is all a composition without a pool has. Two pooled accounts
     * that state neither an account id nor an email would otherwise collapse onto
     * one key and show each other's numbers, so the row id is the answer wherever
     * a pool is in charge.
     */
    private snapshotKeyFor;
    /** Remember the newest snapshot for one account, bounded to the accounts in use. */
    private rememberSnapshot;
    clear(): void;
    /** Drop the remembered snapshot of one account, after its window is known to have reset. */
    forgetSnapshot(accountId: string | undefined, credentials: StoredOAuthCredentials): void;
    consumeResetCredit(): Promise<QuotaStatusDto>;
    private consumeResetCreditUpstream;
    testConnection(): Promise<ConnectionTestDto>;
    private refreshUpstream;
    private fetch;
    private fetchResetCredits;
    private fromCache;
    private failure;
}
export declare class UsageServiceError extends Error {
    readonly publicError: PublicErrorDto;
    constructor(publicError: PublicErrorDto);
}
export declare function mapCodexUsage(value: unknown): QuotaBucketDto[];
export declare function parseCodexUsage(value: unknown): QuotaUsageDto;
export declare function parseResetCredits(value: unknown): {
    availableCount: number;
    expiresAt: number | null;
    availableCreditIds: string[];
};
export {};
//# sourceMappingURL=usage-service.d.ts.map