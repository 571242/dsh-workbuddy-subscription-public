import { FileCredentialStore, type WorkBuddyCredentials } from './token-store.ts';
import { type WorkBuddyTokenIdentity } from './identity.ts';
import type { WorkBuddyRegion } from '../../shared/workbuddy-contracts.ts';
export type WorkBuddyLoginStatus = 'idle' | 'pending' | 'complete' | 'error';
export interface WorkBuddyLoginFlowState {
    status: WorkBuddyLoginStatus;
    region?: WorkBuddyRegion;
    authUrl?: string;
    progress?: string;
    accountId?: string;
    startedAt?: number;
    completedAt?: number;
    error?: string;
}
export declare function getWebLoginStatus(): WorkBuddyLoginFlowState;
export declare function resetWebLogin(): void;
export interface WorkBuddyLoginAttempt {
    state: string;
    authUrl: string;
    region: WorkBuddyRegion;
    domain: string;
}
export declare function requestLoginState(region: WorkBuddyRegion, fetchFn?: typeof fetch, signal?: AbortSignal): Promise<WorkBuddyLoginAttempt>;
/** Parse the successful token-poll shape while accepting the two observed wrappers. */
export declare function parseLoginCredential(payload: unknown, attempt: WorkBuddyLoginAttempt): WorkBuddyCredentials | null;
export declare function pollLogin(attempt: WorkBuddyLoginAttempt, fetchFn?: typeof fetch, signal?: AbortSignal): Promise<WorkBuddyCredentials | null>;
/** Where a completed sign-in is written; the default is this line's own store. */
export interface WorkBuddyLoginOptions {
    /**
     * Persist the completed credential.
     *
     * The account pool owns routing, so it is what a completed sign-in must reach;
     * the default writes to the credential store alone, which is what a caller
     * running without a pool needs.
     */
    onSave?: (credentials: WorkBuddyCredentials) => Promise<unknown>;
    /**
     * Resolve the signed-in account's identity before it is saved.
     *
     * The token response does not say which account it belongs to, so the default
     * reads it from the account endpoint; a test can replace this, and a caller
     * that already knows the identity can skip the extra request.
     */
    resolveIdentity?: (credentials: WorkBuddyCredentials) => Promise<WorkBuddyTokenIdentity | null>;
}
export declare function beginWebLogin(store: FileCredentialStore, region: WorkBuddyRegion, fetchFn?: typeof fetch, options?: WorkBuddyLoginOptions): Promise<WorkBuddyLoginFlowState>;
//# sourceMappingURL=oauth.d.ts.map