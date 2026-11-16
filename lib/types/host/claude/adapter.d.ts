/**
 * DSH adapter for the `claude-subscription` route.
 *
 * This file is the only place the harness talks to. It owns: the model catalog
 * the picker sees, the per-model resolution DSH asks for before a call, the one
 * request loop, and the mapping of a failed response onto a DSH failure. It owns
 * NO credential lifecycle of its own — refreshing is oauth.ts's job, storage is
 * token-store.ts's job, the wire is client.ts's, the body and the SSE parse are
 * mapper.ts's — and it re-implements none of them.
 *
 * ---------------------------------------------------------------------------
 * 1. THE TWO LIMITS ON ACCOUNT ROTATION (the part that is easy to get wrong)
 * ---------------------------------------------------------------------------
 *
 * With a pool installed, one failed response may be retried on a DIFFERENT
 * account. Two rules bound that, and both are load-bearing:
 *
 * (a) WHAT may rotate. Only two conditions are attributable to one account:
 *     a credential verdict (that account's token is dead) and an
 *     ACCOUNT-SCOPED rate limit (that account's own usage window is spent).
 *     Everything else — a global rate limit, an `overloaded_error`, a generic
 *     5xx — is shared by every account behind the same gateway, so rotating
 *     against it burns the pool and can loop. client.ts's classifyFailure
 *     already draws exactly this line (its `accountScoped` field), so the
 *     decision reads that rather than re-deriving it from headers here.
 *
 * (b) HOW FAR. At most {@link MAX_ATTEMPTS} requests per stream, ever. The loop
 *     is additionally driven by the pool's `hasAnotherAvailableAccount`, but
 *     that is a pool property, not a bound: a pool that keeps answering "yes"
 *     would otherwise be retried forever.
 *
 * And one hard rule that outranks both: NO ROTATION ONCE ANYTHING HAS REACHED
 * THE CALLER. A retried request would repeat text the user has already read and
 * re-issue a tool call that may already have executed. Rotation happens only
 * before the response body is touched, which is where a fresh request is still
 * free; once the first chunk has been yielded, a failure is SURFACED instead of
 * retried. That rule is stated once in {@link shouldRotateAccount} so it cannot
 * be quietly lost by a later reordering of this file.
 *
 * ---------------------------------------------------------------------------
 * 2. ONE TOOL-NAME TABLE FOR BOTH DIRECTIONS
 * ---------------------------------------------------------------------------
 *
 * The body renames every offered tool to its canonical wire spelling
 * ('read' -> 'Read'), and the response side maps that spelling back to what the
 * caller declared. Two independent calls to yaml's translation builder would
 * produce two DIFFERENT tables — a collision that disables normalization on one
 * side only, or a set that changed between build and parse — and the visible
 * failure is a tool call dispatched to a tool the caller never offered. So the
 * table is built once, per request, and handed to BOTH the body builder and
 * `createStreamState`.
 *
 * ---------------------------------------------------------------------------
 * 3. THE PRE-EXISTING SINGLE-CREDENTIAL PATH, AND THE THIN STORE ADAPTER
 * ---------------------------------------------------------------------------
 *
 * Without a pool this route serves the account the credential document offers
 * first — or the one the user pinned in `selectedAccountId`, which the pool
 * mirrors as its primary. oauth.ts's `ensureAccessToken` was written against a
 * two-method `{ read, write }` store because it must not learn the document
 * layout, while FileCredentialStore is a multi-account document keyed by an
 * immutable `internalId`. {@link ClaudeAccountTokenStore} is that seam: it
 * presents exactly one account's credentials as the two methods, and records
 * WHICH record it handed out so a rotated refresh token is written back into
 * that record and not into whichever account happens to be first by the time
 * the refresh lands.
 *
 * ---------------------------------------------------------------------------
 * 4. FAILURE CLASSIFICATION
 * ---------------------------------------------------------------------------
 *
 * client.ts classifies; this file only decides which DSH code that verdict
 * becomes, and what the user is told:
 *
 * - `credential` -> INVALID_CREDENTIAL (sign in again);
 * - an account-scoped or global limit -> RATE_LIMIT;
 * - `overloaded` and `server` -> SERVER;
 * - `request` -> PROVIDER_ERROR;
 * - `network` -> TRANSPORT.
 *
 * An in-band `error` event inside a 200 stream carries the same envelope and is
 * classified the same way while nothing has reached the caller; after the first
 * chunk it is surfaced as PROVIDER_ERROR, for the reason in note 1
 * ({@link inBandStreamVerdict}). A reclassified in-band failure is weighed by
 * {@link shouldRotateAccount} exactly as a non-2xx one is, so an account-scoped
 * limit reported inside the stream still takes that account out of rotation.
 *
 * A reported-client-version rejection is a REQUEST problem even though it
 * arrives as a 400 that mentions the client: it must NOT sign the user out, and
 * it has a real remedy (raise the reported version), so it is handled
 * explicitly with that remedy in the message. Where the catalog records a
 * model's floor, the same verdict is produced LOCALLY before the request is sent
 * ({@link assertClaudeCliVersionMeetsFloor}), so the ordinary case never spends
 * a request to be told the same thing less precisely; the upstream branch above
 * stays for a claim that is too low for a floor this table has not learned yet.
 *
 * ---------------------------------------------------------------------------
 * 5. ASSUMPTIONS AND JUDGEMENT CALLS
 * ---------------------------------------------------------------------------
 *
 * - A1. The pool seam is typed STRUCTURALLY here rather than against
 *   './account-pool.ts'. That file is written by a sibling chunk of this line;
 *   importing it before it exists would make this adapter uncompilable, and
 *   importing it afterwards changes nothing, because the only methods used are
 *   the five in {@link ClaudeAccountPoolLike}.
 * - A2. When no fixed output default was materialized, the request path reads
 *   the cached catalog to preserve its wire cap independently of compaction
 *   reservation metadata. Thinking forms still come from the frozen catalog.
 * - A3. A 429 with no `retry-after` and no reset instant cools the account for
 *   {@link POOL_COOLDOWN_MS}. That is deliberately shorter than the 5-hour
 *   window: an account parked for hours after a burst limit recovers would cost
 *   the user the pool, while a too-short cooldown costs one rotation.
 * - A4. Adoption (adopt.ts) is not handled here. An adopted Claude Code
 *   credential is a pool concern — the pool is what must refuse to refresh it —
 *   and this adapter only ever sees the credential the pool or the document
 *   hands it.
 * - A5. The enabled-model rule is stated locally in
 *   {@link resolveEnabledModelIds} because './routes.ts' (the sibling chunk that
 *   owns the settings card for this line) does not exist yet. It mirrors the
 *   sibling providers' rule exactly; once routes.ts lands it is the natural home
 *   for this function and the two should be one.
 */
import { LlmAdapter, LlmError, ReasoningEffortId, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type ClaudeCredentials, type ClaudePreferenceStore } from './token-store.ts';
import { type ClaudeModelEntry } from './model-catalog.ts';
import { type ClaudeFailure } from './client.ts';
import { type AttachmentImageReader } from './mapper.ts';
/**
 * Cooldown a 429 imposes when the service names no reset instant.
 *
 * Deliberately far shorter than the 5-hour window it may be reporting: the
 * accurate wait arrives as `retry-after` or as the ISO instant in the error
 * message, and this is only the fallback for a response that states neither.
 */
export declare const POOL_COOLDOWN_MS: number;
/**
 * Refuse one model locally, before the request is sent, when the version this
 * route reports is below the floor that model declares.
 *
 * WHY THIS EXISTS. Upstream validates the reported client version — the
 * `user-agent` built by client.ts's `claudeUserAgent` — against a per-model
 * minimum and answers a claim below it with an HTTP 400 whose code is
 * `claude_code_version_too_old`. That refusal is correct but nearly unusable as
 * a diagnosis: the version in its text is OUR OWN claim echoed back, the model
 * is only identifiable from the request that was just consumed, and the number
 * the user has to reach is buried in prose. The predictable consequence was the
 * reported bug — a user reading "your client is too old" about a model this
 * package advertises, whose remedy the text never names, and whose wording reads
 * like a credential problem often enough that people sign in again for nothing.
 *
 * The catalog now records the floor per model (`minCliVersion`), so the same
 * verdict can be produced HERE, at zero cost, naming the model, the version in
 * force, the version required, and the remedy. The upstream refusal is left in
 * place exactly as it was — this is an addition to the path, not a replacement,
 * because a claim that clears every floor this table knows can still be too low
 * for something the table has not learned yet, and `toLlmError` still handles
 * that case with the same remedy.
 *
 * WHAT IT MUST NOT DO. It must not disable a model for anyone who never picks it:
 * the check runs on the REQUEST path, against the model actually being called, so
 * a floor for one row cannot remove another row from the picker. It must not be a
 * credential error either — nothing is wrong with the stored sign-in, and the
 * message says so outright, because signing in again is the wrong move and the
 * upstream text invites it.
 *
 * Called with the model the request is about to name, and with the catalog that
 * request resolved against, so a floor added for a live-only id is honoured too.
 */
export declare function assertClaudeCliVersionMeetsFloor(modelId: string, catalog?: readonly ClaudeModelEntry[]): void;
/**
 * The pool surface this adapter uses, stated structurally.
 *
 * See module note A1: './account-pool.ts' is a sibling chunk's file, and typing
 * against the five methods actually called keeps this adapter compilable
 * whether or not that file has landed.
 */
export interface ClaudeAccountPoolLike {
    getEffectiveAccount(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: {
            id: string;
        };
        credentials: ClaudeCredentials;
    }>;
    hasAnotherAvailableAccount(triedAccountIds: ReadonlySet<string>): Promise<boolean>;
    markCooldown(accountId: string, durationMs: number, reason: string): Promise<void>;
    markAuthFailed(accountId: string, reason: string): Promise<void>;
}
export interface ClaudeAdapterOptions {
    fetchFn?: typeof fetch;
    /** Attachment seam: durable images become inline bytes for one request. */
    attachments?: AttachmentImageReader;
    /** Live catalog loader seam; defaults to this account's managed listing. */
    loadCatalog?: (credentials: ClaudeCredentials) => Promise<readonly ClaudeModelEntry[]>;
    /**
     * Multi-account pool this adapter rotates through.
     *
     * Absent leaves the line on its single-credential path, which is what a
     * headless test and any caller that predates the pool use.
     */
    accountPool?: ClaudeAccountPoolLike;
}
export declare class ClaudeAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences?;
    private readonly options;
    /** Null keeps the pre-pool single-credential path. */
    private readonly accountPool;
    constructor(store?: FileCredentialStore, modelSettings?: FileModelSettingsStore, preferences?: ClaudePreferenceStore | undefined, options?: ClaudeAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    /**
     * This route prices no visual tokens.
     *
     * The subscription bills in subscription windows rather than per image, so
     * there is no per-image price to state and the harness's neutral estimate is
     * the honest answer. Stated explicitly, as every sibling line does, so the
     * absence is a decision rather than an unimplemented method.
     */
    imageRequestPricing(): undefined;
    private settings;
    /**
     * The account record the single-credential path serves.
     *
     * The pinned account wins while it exists in the document — that is the
     * account the user chose on the card, and honouring it here keeps the
     * single-credential path agreeing with what the card shows. Otherwise the
     * document is in insertion order and the first record is the primary one,
     * which is also what the pool mirrors into this store.
     */
    private primaryAccount;
    /**
     * Catalog for one credential: the account's live listing, or the shipped table.
     *
     * client.ts's loader never rejects and never returns empty — it answers with
     * the shipped table when the call fails, precisely so a failed listing cannot
     * become the hard "model must be in the catalog" gate. The guard here is for a
     * caller-supplied seam that does neither.
     */
    private catalog;
    /**
     * The catalog a REQUEST should be validated against.
     *
     * The same two branches {@link resolveModel} takes, in the same order, because
     * the live listing is authoritative for which ids exist and a floor recorded
     * for a live-only id would otherwise be skipped. An absent credential is not an
     * error here: with no account there is nothing to list and the shipped table is
     * the only answer available, which is exactly what the preview path already
     * assumes. A credential that cannot be read degrades to the shipped table for
     * the same reason — the floor check must not be the thing that turns a listing
     * failure into a failed request.
     */
    private catalogForRequest;
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, modelId: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    /**
     * Read one credential for this attempt.
     *
     * Pooled and pre-pool are two different questions. With a pool this is a
     * ROUTING decision — which account should serve this request — answered
     * through cooldowns, auth status and the rotation strategy; the pool also owns
     * refreshing the credential it hands back. Without one there is exactly one
     * account, so the question is whether its token is still usable, and
     * ensureAccessToken answers it single-flightedly (the refresh token rotates,
     * so two callers must not each spend it).
     */
    private resolveCredential;
    /**
     * One request attempt, after the credential for it has been chosen.
     *
     * A SEPARATE function from the rotation loop on purpose: importing
     * './account-pool.ts' would make this adapter uncompilable while that sibling
     * file is still being written (see the module note), so the rotation loop is
     * driven by {@link shouldRotateAccount}, which bypasses the pool ENTIRELY when
     * no credentials were resolved for it.
     */
    /**
     * The prompt-cache tier this line requests.
     *
     * A stored value wins; nothing stored falls back to the tier the OFFICIAL
     * client uses for a subscription's main conversation, so a user comparing
     * this plugin with Claude Code sees the same cache lifetime rather than half
     * of it.
     *
     * @param settings - the document the caller already read for this turn.
     */
    private static cacheTtlFor;
    private attemptRequest;
    private requestStream;
}
/**
 * Effort to materialize as this route's default, or nothing.
 *
 * Membership, not convergence: the catalog's ladder IS the wire vocabulary, and
 * a configured level outside it is dropped rather than moved onto a neighbour.
 * Moving it would silently change how hard the model thinks, and the four
 * thinking forms each carry the effort differently, so there is no single
 * correct neighbour to pick. 'xhigh' and 'max' are real rungs on this route and
 * pass through untouched.
 */
export declare function resolveDefaultReasoningEffort(efforts: readonly string[], configuredEffort?: string | null): ReasoningEffortId | undefined;
/**
 * Whether one failed response may be retried on another account.
 *
 * Only two conditions qualify, and the reason is the same for both: they are
 * properties of ONE account. A credential verdict means that account's token is
 * finished; an ACCOUNT-SCOPED rate limit means that account's own window is
 * spent. A global rate limit, an overload and a generic 5xx are shared by every
 * account behind the same gateway — rotating against them burns the pool and can
 * loop, because the next account fails identically.
 *
 * The one absolute refusal is `outputStarted`: after the first chunk has
 * reached the caller, a retry would repeat text and re-issue a tool call, so the
 * failure is surfaced instead.
 */
export declare function shouldRotateAccount(failure: ClaudeFailure, outputStarted: boolean): boolean;
/** How long a rate-limited account stays out of rotation. */
export declare function cooldownMsFor(failure: ClaudeFailure, now?: number): number;
/** The DSH failure code one classified failure becomes. */
export declare function codeForFailure(failure: ClaudeFailure): string;
/**
 * The DSH error an in-band `error` event becomes when it arrived BEFORE any
 * chunk reached the caller.
 *
 * Anthropic can answer 200 and then report the failure inside the stream, in
 * the same `{ error: { type, message } }` envelope a non-2xx body carries. The
 * mapper types every such event PROVIDER_ERROR, because it cannot know whether
 * output has started — and PROVIDER_ERROR is outside the retry set, so an
 * `overloaded_error` delivered this way ended the turn on the first try while
 * the identical overload delivered as a 529 is retried. Before any output a
 * fresh request is still free (module note 1), so the envelope is classified
 * exactly as a response body would be, and a transient verdict (overloaded,
 * server, rate limit) takes its retryable code.
 *
 * Everything else keeps the mapper's verdict: a request problem, a context
 * overflow, a credential refusal, and a type this line does not recognize. The
 * last matters: classifyFailure falls back to the status line for an unknown
 * type, and no status here describes the failure — the response itself was a
 * 200 — so the status passed is 0 and never consulted for a recognized type.
 *
 * The message stays the mapper's, which names the wire type the user saw.
 *
 * The classified failure rides along beside the error so the caller can weigh it
 * with {@link shouldRotateAccount} instead of re-deriving what it says. It is
 * null whenever the mapper's verdict stands, so a caller never has to guess
 * whether `accountScoped` is meaningful.
 *
 * @param thrown - the mapper's PROVIDER_ERROR (or context-overflow) verdict.
 * @param streamError - the event's wire `error` object, from the stream state.
 * @param headers - the 200 response's headers, read for the rate-limit verdict.
 */
export declare function inBandStreamVerdict(thrown: LlmError, streamError: Record<string, unknown>, headers: Headers): InBandStreamVerdict;
/** What one in-band `error` event becomes when nothing had reached the caller yet. */
export interface InBandStreamVerdict {
    /** The error the caller sees: the mapper's, or its reclassified replacement. */
    error: LlmError;
    /**
     * The envelope classified as a response body, or null when the mapper's own
     * verdict stands. Present only for a RECOGNIZED transient type, so `kind` and
     * `accountScoped` can be read off it directly.
     */
    failure: ClaudeFailure | null;
}
/**
 * Turn one classified failure into the DSH error the caller sees.
 *
 * The facts the harness needs ride along: the HTTP status, and the delay the
 * provider asked for, which is where the retry policy reads its backoff from.
 * An unreadable status (0 from a transport failure) is omitted rather than
 * passed on, because LlmError validates it as a real HTTP status.
 */
export declare function toLlmError(failure: ClaudeFailure): LlmError;
export { PROVIDER_ID, PROVIDER_NAME };
//# sourceMappingURL=adapter.d.ts.map