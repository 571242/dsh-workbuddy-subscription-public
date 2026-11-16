/**
 * Resume a turn that ended without an answer.
 *
 * One line's forced thinking can spend a whole response reasoning and then end
 * the turn with `end_turn`, leaving no text and no tool call. That line reports
 * it as a failure, which is honest but leaves the turn unfinished: the harness
 * has no representation for "the model stopped before it did anything", so the
 * caller sees a failed turn and nothing else.
 *
 * This hook closes that gap. It watches the `llm/stream` waterfall, recognises
 * that specific failure, and steers one continuation so the turn finishes.
 *
 * The budget counts `consecutive` answerless turns, so it only ever grows on
 * a turn that ran to its end and reported the failure. A stream that was
 * abandoned — the caller pressed Stop mid-answer, or the collapse guard returned
 * upstream of this hook — never delivered its finish chunk and therefore says
 * nothing at all: it neither spends the budget nor clears the streak.
 *
 * The steer has to land while the Agent is **idle**. `Agent.steer` splices into
 * the inbox and calls `wakeDriver`, and `wakeDriver` only opens a new turn from
 * `idle`: sent while a turn is still running it latches nothing and the message
 * sits unread. So the resume waits on `whenIdle()` rather than racing the turn
 * boundary — the collapse guard reaches the same place by cancelling first and
 * steering on a microtask, which is not available here because nothing is being
 * cancelled.
 *
 * @module
 */
/** The subset of `llm/stream` options this hook reads. */
export interface ResumeStreamOptions {
    /** Stamped by the agent loop on every request it builds. */
    readonly sessionId?: string | undefined;
    /** Absent on an ordinary conversation request; set on an auxiliary call. */
    readonly purpose?: string | undefined;
}
/** A chunk as it crosses the stream boundary; only the shape is read. */
export interface ResumeChunk {
    readonly type: string;
    readonly text?: string | undefined;
    readonly blockType?: string | undefined;
    readonly reason?: {
        readonly kind?: string | undefined;
        readonly failure?: {
            readonly code?: string | undefined;
            readonly message?: string | undefined;
        } | undefined;
    } | undefined;
}
/** Live Agent methods the hook calls. Optional so an older shape stays loadable. */
export interface ResumeAgentLike {
    /** The Agent's session identity — the same value the loop stamps on requests. */
    readonly id?: unknown;
    steer?(message: unknown): void;
    /** Resolves once the Agent has no work in flight. */
    whenIdle?(): Promise<unknown>;
}
/** The `llm/stream` waterfall listener this hook registers. */
export type ResumeStreamListener = (options: ResumeStreamOptions, next: () => AsyncIterable<ResumeChunk>) => AsyncIterable<ResumeChunk>;
/**
 * The `agent/disposed` listener this hook registers.
 *
 * The payload carries the Agent whose `id` keys this hook's per-session state,
 * so a session that closes takes its entry with it instead of leaving the streak
 * — and the memory behind it — behind for the life of the process.
 */
export type ResumeAgentEventListener = (payload: {
    agent: unknown;
}) => void;
/** Either listener {@link NoAnswerResumeContext.on} accepts. */
export type ResumeListener = ResumeStreamListener | ResumeAgentEventListener;
/** Listener options accepted by the harness event bus. */
export interface ResumeListenerOptions {
    /** Receive the event regardless of context filter checks. */
    readonly global?: boolean;
}
/** Configuration for {@link installNoAnswerResume}. */
export interface NoAnswerResumeOptions {
    /** Consecutive answerless turns resumed before giving up (default 2). */
    maxResumes?: number;
    /** The continuation injected on each resume. */
    text?: string;
}
/** {@link NoAnswerResumeOptions} with every default filled in. */
export interface ResolvedNoAnswerResumeOptions {
    maxResumes: number;
    text: string;
}
/** The continuation this hook injects, unless the deployment states its own. */
export declare const NO_ANSWER_RESUME: string;
export declare const DEFAULT_NO_ANSWER_RESUME_OPTIONS: ResolvedNoAnswerResumeOptions;
/**
 * The Context surface the hook needs, declared structurally so it loads on every
 * supported harness generation without importing generation-bound types.
 *
 * `get` is the read that reaches the Agent registry in a real host: the registry
 * is provided by a sibling fiber, and Cordis throws for a property this plugin did
 * not declare in its `inject` list.
 */
export interface NoAnswerResumeContext {
    on?: (event: 'llm/stream' | 'agent/disposed', listener: ResumeListener, options?: ResumeListenerOptions) => unknown;
    logger?: {
        info?(message: string): void;
        warn(message: string): void;
    } | undefined;
    get?(name: string): unknown;
    readonly agents?: {
        get(id: unknown): unknown;
    } | undefined;
}
/**
 * Validate caller options fail-loud and fill in defaults.
 *
 * A resume budget below one would disable the hook while looking enabled, and an
 * empty continuation would wake the Agent with nothing to act on — both are
 * configuration mistakes worth failing on rather than silently ignoring.
 */
export declare function resolveNoAnswerResumeOptions(options?: NoAnswerResumeOptions): ResolvedNoAnswerResumeOptions;
/**
 * Install the answerless-turn resume hook on a Context.
 *
 * Inert unless the host exposes the event bus, so a harness without it keeps the
 * built-in behaviour instead of failing this plugin's load.
 *
 * @param ctx - plugin context.
 * @param options - see {@link NoAnswerResumeOptions}; validated fail-loud.
 * @returns a disposer removing every listener, or undefined when the host
 *   exposes no event bus.
 */
export declare function installNoAnswerResume(ctx: NoAnswerResumeContext, options?: NoAnswerResumeOptions): (() => void) | undefined;
//# sourceMappingURL=index.d.ts.map