import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import { FileCredentialStore, type OllamaCredentials } from './token-store.ts';
import type { AccountPoolStatusDto } from '../../shared/account-pool-contracts.ts';
import type { OllamaAccountSummaryDto } from '../../shared/ollama-contracts.ts';
/** One pooled Ollama key: the bearer key plus the display facts the card renders. */
export interface OllamaPoolAccount extends PoolAccountShape<OllamaCredentials> {
    /** Model id this account last served, for the card's detail line. */
    lastModelId?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        requestCount: number;
        /** Unix milliseconds the last completed turn was counted. */
        lastCountedAt?: number;
    };
}
export type { OllamaAccountSummaryDto };
export type OllamaPoolStatusDto = AccountPoolStatusDto;
/** Encrypted pool file this line owns. */
export declare function ollamaPoolPath(): string;
/**
 * Stable identity of one key.
 *
 * Ollama hands the user a bare key and nothing else — no account id, no email —
 * so the key's own digest is the only identity available. It is never written
 * anywhere: it exists to tell two pasted keys apart inside the pool document,
 * and it is not a credential and cannot be used as one.
 */
export declare function ollamaAccountKey(credentials: OllamaCredentials): string;
/** Validate and normalize one whole pool document. */
export declare function parseOllamaPoolData(value: unknown): PoolData<OllamaPoolAccount>;
export interface OllamaAccountPoolOptions {
    /** Pre-pool credential file the pool mirrors its primary account into. */
    store?: FileCredentialStore;
    /** Test seam; production builds the platform backend from the pool path. */
    backend?: CredentialStore<PoolData<OllamaPoolAccount>>;
    maxAccounts?: number;
}
/**
 * Ollama's account pool.
 *
 * An Ollama credential is a static key that never expires, so this wrapper
 * supplies identity, the display alias a user chose, and the mirror of the
 * single-credential file — no refresh logic is needed anywhere.
 */
export declare class OllamaAccountPool extends AccountPoolCore<OllamaCredentials, OllamaPoolAccount, OllamaAccountSummaryDto> {
    private readonly store;
    constructor(options?: OllamaAccountPoolOptions);
    /**
     * Pick the key for the next request, skipping accounts already tried.
     *
     * Ollama's credential carries no deployment dimension - there is one cloud
     * endpoint and every key is valid for it - so the account and its key are
     * returned together and nothing has to be attached to the credential.
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: OllamaPoolAccount;
        credentials: OllamaCredentials;
    }>;
    /** The pre-pool credential file this pool mirrors its primary account into. */
    mirrorStore(): FileCredentialStore;
    recordUsage(accountId: string, inputTokens: number, outputTokens: number): Promise<void>;
}
//# sourceMappingURL=account-pool.d.ts.map