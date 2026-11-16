import { type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { type StreamActivity } from './common/idle-watchdog.ts';
import { type CodexAccountPool } from './codex-account-pool.ts';
import { OAuthService } from './oauth-service.ts';
import { type LocalRawImageOptions } from './responses-mapper.ts';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import type { CodexOutputVerbosity, CodexReasoningSummary } from '../shared/contracts.ts';
type FetchLike = typeof fetch;
export interface ResponsesClientOptions {
    fetchFn?: FetchLike;
    localRawImages?: LocalRawImageOptions;
    onGenerationFinished?: () => void;
    outputVerbosity?: () => CodexOutputVerbosity | null;
    fastMode?: () => boolean;
    reasoningSummary?: () => CodexReasoningSummary | null;
    /** Account pool to rotate over; without one the single stored credential is used. */
    accountPool?: CodexAccountPool;
    /**
     * Idle budget for one Responses stream, counted on transport activity rather
     * than on visible chunks. Defaults to the shared five-minute budget; the
     * plugin config exposes it so a deployment can retune it without a rebuild.
     */
    codexStreamIdleTimeoutMs?: number;
}
export declare class ResponsesClient {
    private readonly oauth;
    private readonly attachments;
    private readonly fetchFn;
    private readonly onGenerationFinished;
    private readonly outputVerbosity;
    private readonly fastMode;
    private readonly reasoningSummary;
    private readonly accountPool;
    private readonly codexStreamIdleTimeoutMs;
    /**
     * Opaque backend routing state, keyed by a unique model-request nonce.
     * The host does not expose a reliable human-turn identity, so this is the
     * conservative no-cross-request-reuse fallback, not full turn continuity.
     *
     * The Codex backend hands `x-codex-turn-state` back on each response and
     * expects it on the next request of the SAME turn, which lets it resume the
     * turn instead of re-ingesting the whole history.
     *
     * It is a client/server contract with a one-turn scope: the official client
     * creates a fresh per-turn session and warns that replaying the token across
     * turns breaks routing. The value is also account-scoped, so each entry
     * records the auth owner that minted it and is discarded when the signer
     * changes. It is only ever an optimization, so a miss costs a full resend and
     * never correctness.
     */
    private readonly turnStates;
    constructor(oauth: OAuthService, attachments: Pick<AttachmentStore, 'readImage'> & Partial<Pick<AttachmentStore, 'imageLimits'>>, options?: ResponsesClientOptions);
    private readonly localRawImages;
    stream(rawOptions: GenerateOptions): AsyncIterable<StreamChunk>;
    private send;
    /**
     * Record the routing state a response carried, for this turn's next request.
     *
     * A response that carries none clears any stored value: a backend that stops
     * sending the header has stopped honouring it, and replaying a stale value
     * would be guessing. An empty header is treated the same as absent.
     */
    private rememberTurnState;
    /**
     * Bounded store: a long-lived host serves many sessions and turns, and nothing
     * here ever signals that either ended, so the map is capped and evicts the
     * oldest entry. The value is an optimization, so a miss only costs a resend.
     */
    private storeTurnState;
    /**
     * Routing state this turn may replay, or undefined.
     *
     * A token minted by a different auth owner is dropped rather than sent: the
     * value is account-scoped, and sending it to another account is at best a
     * routing hint for the wrong machine and at worst a replay of state that
     * account never issued. Dropping it only costs a full resend.
     */
    private turnStateFor;
    /**
     * Send one payload with account rotation.
     *
     * The pool picks the account — skipping cooling, quota-exhausted and failed
     * ones — and has already refreshed a token that was about to expire. A 429
     * cools that account down and retries the identical payload on the next
     * eligible account; a 401 forces exactly one refresh, and an account whose
     * refresh is rejected leaves the rotation instead of invalidating the others.
     * The payload is account-independent, so it is never rebuilt between attempts.
     */
    /** What one pool attempt produced, including the account that served it. */
    private sendWithPool;
    private request;
}
export declare function parseResponsesStream(response: Response, signal?: AbortSignal, hiddenSandboxControls?: ReadonlySet<string>, 
/** Reports transport activity so a caller-side idle watchdog keeps rearming. */
activity?: StreamActivity): AsyncIterable<StreamChunk>;
export {};
//# sourceMappingURL=responses-client.d.ts.map