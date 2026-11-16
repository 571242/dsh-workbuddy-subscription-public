import { type OllamaCatalogModel, type OllamaThinkingCapability, type OllamaWire } from './types.ts';
import type { OllamaCredentials } from './token-store.ts';
import type { StreamActivity } from '../common/idle-watchdog.ts';
/** One message on the wire, in either surface's shape. */
export interface OllamaChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    /** Image parts this turn carries; the OpenAI surface takes an array, the native one too. */
    images?: string[];
    /** Tool call id a `tool` result answers. */
    toolCallId?: string;
    /** Assistant tool calls that produced this turn. */
    toolCalls?: OllamaToolCall[];
}
export interface OllamaToolCall {
    id: string;
    name: string;
    /** Raw JSON the model produced for the arguments. */
    arguments: string;
}
export interface OllamaRequest {
    model: string;
    messages: OllamaChatMessage[];
    tools?: {
        name: string;
        description?: string;
        parameters: unknown;
    }[];
    maxOutputTokens?: number;
    temperature?: number;
    /**
     * Thinking control, in Ollama's own vocabulary: a boolean for on/off, or a
     * model-defined level name taken from that model's metadata. It is never
     * guessed here — the adapter only sends a value the model declares.
     */
    think?: boolean | string;
    signal?: AbortSignal;
}
/**
 * Token accounting one completed turn reports.
 *
 * These are the counts Ollama's own OpenAPI documents on the chat response
 * (`prompt_eval_count` and `eval_count`), so they measure what this key has
 * actually spent rather than anything inferred from the text.
 *
 * They are NOT a quota. The service publishes no account limit, no remaining
 * balance and no reset time anywhere in its API: upstream issues #15132 and
 * #15663 asked for one and both were closed. So nothing here can say how much
 * is left - only what has been consumed.
 */
export interface OllamaUsage {
    inputTokens: number;
    outputTokens: number;
}
export type OllamaStreamEvent = {
    type: 'text';
    text: string;
} | {
    type: 'thinking';
    text: string;
} | {
    type: 'tool_call';
    call: OllamaToolCall;
} | {
    type: 'done';
    finishReason?: string;
} | {
    type: 'usage';
    usage: OllamaUsage;
} | {
    type: 'error';
    message: string;
};
export interface OllamaCallResult {
    events: AsyncGenerator<OllamaStreamEvent>;
    /** Resolves the HTTP status once the response headers arrive. */
    status: Promise<number>;
}
/** Headers both surfaces require, per docs/api/authentication. */
export declare function headersFor(credentials: OllamaCredentials, accept: string): Record<string, string>;
/**
 * Build the request body for one wire shape.
 *
 * The two surfaces are not translations of each other — the native API nests the
 * assistant's tool calls under `message.tool_calls` and expects results under a
 * `tool` role without ids, while the OpenAI surface uses `tool_calls` and
 * `tool_call_id`. Mapping them through one shared builder would have to guess at
 * the fields the other surface does not carry, so each is written out where its
 * own rules stay visible.
 */
export declare function buildBody(wire: OllamaWire, request: OllamaRequest): unknown;
export declare function toBareBase64(image: string): string;
export declare function toDataUrl(image: string, defaultMediaType?: string): string;
export declare function parseArguments(raw: unknown): Record<string, unknown>;
/** The endpoint one request goes to. */
export declare function chatUrl(wire: OllamaWire): string;
/**
 * Start one streaming chat call.
 *
 * The HTTP status is surfaced through a promise rather than by handing back the
 * Response, because the caller has to decide between retrying this account and
 * failing the turn, and both need the status before any body is read.
 */
export declare function startChat(fetchFn: typeof fetch, credentials: OllamaCredentials, wire: OllamaWire, request: OllamaRequest, 
/**
 * Transport-level liveness reporter for a caller that wraps this stream in an
 * idle watchdog. Optional: without it, heartbeats and status frames that
 * produce no event stay invisible to the caller's timeout, exactly as before.
 */
activity?: StreamActivity): OllamaCallResult;
/**
 * Why a catalog read came back without a list.
 *
 * These are the four things that can go wrong between the card asking for a sync
 * and the service answering, and they are kept apart because each one has a
 * different fix on the user's side: `auth` is a key Ollama refused, `upstream` is
 * Ollama refusing for some other reason, `unreachable` is a network or proxy
 * problem, and `malformed` is a reply that is not the documented `/api/tags`
 * document at all. Collapsing them into one "could not read the model list"
 * sentence leaves the user with nothing to act on, which is the complaint behind
 * issue #36.
 */
export type OllamaCatalogFailure = 'auth' | 'upstream' | 'unreachable' | 'malformed';
/** One catalog read, with the reason it produced no list. */
export interface OllamaCatalogResult {
    models: OllamaCatalogModel[];
    /** Absent on success. An account entitled to nothing succeeds with an empty list. */
    failure?: OllamaCatalogFailure;
    /** The HTTP status behind an `auth` or `upstream` failure. */
    status?: number;
}
/**
 * Read the model catalog.
 *
 * `/api/tags` is the native surface's own list and needs no translation; the
 * OpenAI `/models` endpoint would be a subset of it. Returns an empty list rather
 * than throwing, so a failed sync degrades to the cached selection instead of
 * making the line unusable.
 */
export declare function loadCatalog(fetchFn: typeof fetch, credentials: OllamaCredentials): Promise<OllamaCatalogModel[]>;
/**
 * The same read as {@link loadCatalog}, keeping the reason it failed.
 *
 * Never throws, for the reason its wrapper has always given. What it adds is that
 * "failed" stops being one opaque state, so the settings card can name the
 * cause instead of asking the user to guess.
 */
export declare function fetchCatalog(fetchFn: typeof fetch, credentials: OllamaCredentials): Promise<OllamaCatalogResult>;
/** The OpenAI-compatible model list, for callers that prefer that surface's view. */
export declare function loadOpenAIModels(fetchFn: typeof fetch, credentials: OllamaCredentials): Promise<string[]>;
/**
 * Read what one model says about its own thinking.
 *
 * `POST /api/show` is the only place a model states the values `think` accepts,
 * and the ladder this line offers has to be exactly those values: DSH rejects an
 * effort that is not on the ladder before a request is built, and the service
 * rejects a `think` it does not know. So the metadata, not a prefix list, is
 * what the picker is built from.
 *
 * Returns undefined rather than throwing for every way this can fail - no key, a
 * 401, a 500, a proxy's HTML where JSON was promised, a document that is not
 * `/api/show`. The caller falls back to what it already knew about the model,
 * and a failed probe must never be what breaks a turn.
 */
export declare function fetchModelThinking(fetchFn: typeof fetch, credentials: OllamaCredentials, modelId: string): Promise<OllamaThinkingCapability | undefined>;
//# sourceMappingURL=client.d.ts.map