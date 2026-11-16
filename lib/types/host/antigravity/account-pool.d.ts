import type { CredentialStore } from '../token-store.ts';
import { FileCredentialStore, type AntigravityCredentials } from './token-store.ts';
import type { AntigravityAccountQuota, AntigravityAccountSummaryDto, AccountRotationStrategy } from '../../shared/antigravity-contracts.ts';
import type { PoolAccountQuotaDto } from '../../shared/account-pool-contracts.ts';
export interface AntigravityPoolAccount {
    id: string;
    alias: string;
    email?: string;
    projectId?: string;
    planLabel?: string;
    credentials: AntigravityCredentials;
    addedAt: number;
    lastUsedAt?: number;
    cooldownUntil?: number;
    cooldownReason?: string;
    isPrimary?: boolean;
}
export interface AntigravityPoolData {
    version: 1;
    activeAccountId?: string;
    rotationStrategy: AccountRotationStrategy;
    accounts: AntigravityPoolAccount[];
}
export declare function poolPath(): string;
/**
 * The rotation strategy this line defaults to, and the reader for it.
 *
 * Sticky rather than the shared core's sequential default, because the account a
 * request is served by may also decide which server-side prefix cache it can
 * reach: each account is a separate quota domain, and an account that changes mid
 * conversation plausibly lands on a cache the previous one had not warmed, so the
 * next turn may reprocess a prefix that was already paid for. Holding the account
 * that served the previous request is the cheap way to not find out the hard way,
 * and a request that is rate limited still falls through to another account.
 *
 * That account identity selects a cache namespace is INFERRED, not measured.
 * Nothing here observes an account-scoped cache metric, no live capture has been
 * taken, and docs/antigravity-claude-cache-audit.md records the upstream position
 * — on-wire session affinity still needs transport diagnostics — against a run
 * that had a single account, so cross-account behaviour was never exercised.
 * The default stands as a design assumption until one of those is done.
 *
 * Only the DEFAULT differs. An explicit stored choice is returned unchanged, and
 * a pool file written before this change carries an explicit 'sequential' — so
 * upgrading does not silently move an existing user onto a different strategy.
 * The shared core keeps its own sequential default for every other line.
 */
export declare function poolRotationStrategy(value: unknown): AccountRotationStrategy;
export declare function parseAntigravityPoolData(value: unknown): AntigravityPoolData;
/**
 * One cached Antigravity snapshot as the shared account card renders it.
 *
 * One window per bucket. The service states what is LEFT, and the card draws what
 * is SPENT, so the used share is the complement. A bucket whose fraction is
 * `null` (never measured) or outside 0-1 is dropped rather than drawn as 0% or
 * 100%: "not stated" and "nothing used" are different claims and only one of
 * them is true. A stated 0 is a real measurement — the allowance is exhausted —
 * and is published as 100% used.
 *
 * `windowDurationMins` is deliberately absent. The bucket's `window` field is
 * carried through this line's cache verbatim and nothing in the line interprets
 * it as a duration, so naming a window from it would be a guess; the card names
 * each window from the label below instead.
 */
export declare function antigravityPoolQuota(quota: AntigravityAccountQuota | undefined): PoolAccountQuotaDto | undefined;
/**
 * Antigravity's account pool.
 *
 * The storage, eligibility, rotation and cooldown rules live in the shared
 * {@link AccountPoolCore}; this facade keeps the provider-shaped API the routes
 * and the adapter were written against, including the credential projection
 * (`token` / `projectId`) that predates the shared core.
 */
export declare class AccountPoolStore {
    private readonly core;
    private readonly legacyStore;
    constructor(filePath?: string, backend?: CredentialStore<AntigravityPoolData>, legacyStore?: FileCredentialStore);
    /** Human description of where this pool's credentials live. */
    path(): string;
    read(): Promise<AntigravityPoolData>;
    write(data: AntigravityPoolData): Promise<void>;
    listAccounts(): Promise<AntigravityAccountSummaryDto[]>;
    addAccount(credentials: AntigravityCredentials, alias?: string): Promise<AntigravityPoolAccount>;
    setPrimary(accountId: string): Promise<void>;
    setAlias(accountId: string, alias: string): Promise<void>;
    deleteAccount(accountId: string): Promise<void>;
    setStrategy(strategy: AccountRotationStrategy): Promise<void>;
    markCooldown(accountId: string, durationMs: number, reason: string): Promise<void>;
    clearCooldown(accountId: string): Promise<void>;
    hasAnotherAvailableAccount(triedAccountIds: ReadonlySet<string>): Promise<boolean>;
    /**
     * Pick the account for the next request, with the credential projection the
     * Antigravity adapter consumes.
     */
    getEffectiveAccount(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: AntigravityPoolAccount;
        token: string;
        projectId?: string;
    }>;
    /**
     * Cooldowns keyed by account AND quota family.
     *
     * Antigravity meters Gemini and "Claude and GPT" as separate allowances
     * (`retrieveUserQuotaSummary` reports them as separate groups), so a 429 on
     * one says nothing about the other. The account-wide cooldown the shared core
     * writes took a whole account out of rotation for 15 minutes when only its
     * Claude allowance was spent, and its Gemini allowance went unused.
     *
     * Held in memory rather than in the pool document: it is a routing hint that
     * the next 429 re-establishes, and the shared pool format has no per-family
     * field to put it in.
     */
    private readonly familyCooldowns;
    private familyKey;
    /** Cool one account down for one quota family after an upstream 429. */
    markFamilyCooldown(accountId: string, family: AntigravityQuotaFamily, durationMs: number, reason: string): void;
    /** Accounts whose allowance for this family is still cooling down. */
    familyCoolingAccountIds(family: AntigravityQuotaFamily, now?: number): Set<string>;
    private shortestFamilyCooldownMs;
    /**
     * {@link getEffectiveAccount} for one quota family: accounts whose allowance
     * for that family is cooling down are skipped, every other account stays
     * eligible.
     *
     * @throws LlmError `RATE_LIMIT` naming the family's own wait when every
     *   remaining account is cooling down for this family.
     */
    getEffectiveAccountFor(family: AntigravityQuotaFamily, excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: AntigravityPoolAccount;
        token: string;
        projectId?: string;
    }>;
    /** Whether an account not yet tried may still serve this family. */
    hasAnotherAvailableAccountFor(family: AntigravityQuotaFamily, triedAccountIds: ReadonlySet<string>): Promise<boolean>;
}
/**
 * The separately metered allowance one model draws from.
 *
 * Mirrors the quota groups `retrieveUserQuotaSummary` reports: Gemini models in
 * one, "Claude and GPT models" in the other.
 */
export type AntigravityQuotaFamily = 'gemini' | 'claude-gpt';
export declare function quotaFamilyForModel(modelId: string): AntigravityQuotaFamily;
//# sourceMappingURL=account-pool.d.ts.map