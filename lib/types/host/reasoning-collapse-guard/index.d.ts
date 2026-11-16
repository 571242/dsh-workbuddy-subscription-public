/**
 * Reasoning-collapse guard.
 *
 * A long reasoning stream can degenerate into repetition: it cycles through a
 * handful of short phrases ("Let me call. Go. Calling. Go.") without emitting a
 * tool call or concluding anything, and runs until the output-token ceiling
 * truncates it. One archived session burned 128,000 output tokens that way and
 * returned an empty answer.
 *
 * The guard scores n-gram uniqueness over a trailing window of reasoning text.
 * Healthy deliberation keeps nearly every n-gram unique and scores near zero; a
 * degenerate stream scores near one. On a hit it stops yielding chunks, so the
 * in-flight request ends, and lets the turn resume on a fresh step.
 *
 * Uniqueness alone only sees verbatim repetition. A stream can restate one
 * conclusion over and over in fresh words, score 0.48 where the threshold is
 * 0.85, and run to the output ceiling untouched. So a second, independent
 * signal scores the same window for recurrence: how strongly each sentence
 * repeats something the model already said at least `semanticLag` sentences
 * earlier. Enumerative reasoning repeats itself too, but adjacently — each item
 * borrows the previous item's frame — and recurrence ignores adjacency, which
 * is what separates the two.
 *
 * Neither signal stops anything on its own. A break needs both over their
 * thresholds in the same window, and then `semanticConfirmations` consecutive
 * such windows: one signal alone, or a single anomalous window, is logged and
 * released. That gradient is the whole design. A guard that cuts a healthy
 * answer is worse than one that lets a runaway finish, because the user sees a
 * turn stop mid-sentence with no explanation, and the fix costs a whole turn.
 *
 * Seam choice: the guard wraps `llm/stream`, not `agent/assistant-stream`.
 * `agent/assistant-stream` is emit-mode — it can observe but cannot stop a
 * stream — and it does not exist before harness 0.1.5, which would make the
 * guard a silent no-op on every generation this plugin supports below that.
 * `llm/stream` is a waterfall whose `(options, next) => AsyncIterable<StreamChunk>`
 * signature is byte-identical from 0.1.2-alpha.5 through 0.2.0-rc.1, and
 * returning early from the listener is what actually ends the stream.
 *
 * The guard subscribes to that waterfall and never reassigns `ctx.llm.stream`.
 * The harness publishes `stream` as a one-argument method that enters the
 * waterfall itself, so a property rewrite carrying a second `next` parameter
 * breaks every caller dispatching it as a method, and misses the prepared
 * call that skips the published method entirely.
 *
 * The guard rewrites nothing and appends nothing to the aborted attempt. Its
 * only model-visible input is the single resume message it queues afterwards,
 * on a fresh turn.
 *
 * Agent identity is read from the request, never remembered globally. The loop
 * stamps every request it builds with its `sessionId`, and `ctx.agents.get`
 * turns that back into the one Agent that owns the stream. Remembering "the
 * newest agent this process saw" instead was wrong twice over: a host runs one
 * Agent per session plus one per subagent, so the newest is usually a different
 * conversation, and `agent/created` fires once per Agent, so an Agent that
 * already existed when the guard installed was never reported at all. Both
 * cases cut the runaway and then resumed nothing, which reads to the user as a
 * conversation that simply stops mid-answer.
 *
 * Status: **switched off in this line by default**. Everything here still
 * works and is still tested; what changed is the wiring in `src/index.ts`,
 * whose `reasoningCollapseGuard` config now defaults to `false` instead of
 * `{}`. A deployment that wants the break back opts in with an object.
 */
/**
 * The subset of `llm/stream` options this guard reads.
 *
 * `sessionId` is what binds a stream to the Agent that owns it, and
 * `purpose` tells a conversation call from an auxiliary one (compaction,
 * session title) that owns no turn to resume. Both are plain request fields:
 * the guard adds no generation-bound named import to learn them.
 */
export interface GuardStreamOptions {
    readonly model?: string | undefined;
    readonly signal?: AbortSignal | undefined;
    /** Stamped by the agent loop on every request it builds. */
    readonly sessionId?: string | undefined;
    /** Absent on an ordinary conversation request; set on an auxiliary call. */
    readonly purpose?: string | undefined;
}
/** A chunk as it crosses the stream boundary; only the reasoning delta is read. */
export interface GuardChunk {
    readonly type: string;
    readonly text?: string | undefined;
}
/** Live Agent methods the guard calls. Optional so an older shape stays loadable. */
export interface GuardAgentLike {
    /** The Agent's session identity — the same value the loop stamps on requests. */
    readonly id?: unknown;
    cancel?(cause: {
        kind: 'hook';
        reason: string;
    }, options?: {
        keepInbox?: boolean;
    }): void;
    steer?(message: unknown): void;
}
/** The `llm/stream` waterfall listener the guard registers. */
export type GuardStreamListener = (options: GuardStreamOptions, next: () => AsyncIterable<GuardChunk>) => AsyncIterable<GuardChunk>;
/** The `agent/created` / `agent/disposed` listener the guard registers. */
export type GuardAgentEventListener = (payload: {
    agent: unknown;
}) => void;
/** Either listener {@link ReasoningCollapseContext.on} accepts. */
export type GuardListener = GuardStreamListener | GuardAgentEventListener;
/** Listener options accepted by the harness event bus. */
export interface GuardListenerOptions {
    /** Receive the event regardless of context filter checks. */
    readonly global?: boolean;
}
/**
 * The Context surface the guard needs, declared structurally so it loads on
 * every supported harness generation without importing generation-bound types.
 */
export interface ReasoningCollapseContext {
    on?: (event: 'llm/stream' | 'agent/created' | 'agent/disposed', listener: GuardListener, options?: GuardListenerOptions) => unknown;
    logger?: {
        warn(message: string): void;
    } | undefined;
    /**
     * Read one service from the store, with no `inject` requirement.
     *
     * This is the read that actually reaches the Agent registry. `ctx.agents`
     * below is a property read, and Cordis throws for a property the plugin did
     * not declare in its `inject` list — the registry is provided by a SIBLING
     * fiber (`@deepseek-ai/dsh-agent`), not by this plugin's own context — so
     * the property path is the one that fails in a real host. `ctx.get` reads
     * the service store directly and therefore needs no declaration. Optional so
     * a host without the reader keeps the property fallback.
     */
    get?(name: string): unknown;
    /**
     * The harness Agent registry, read so a guard installed after an Agent was
     * created can still resolve it. A host without the service degrades to the
     * `agent/created` map rather than failing this plugin's load.
     */
    readonly agents?: {
        get(id: unknown): unknown;
    } | undefined;
}
/** Configuration for {@link installReasoningCollapseGuard}. */
export interface GuardOptions {
    /** Trailing reasoning characters scored per request (default 4096). */
    windowChars?: number;
    /** Characters required before a score is computed (default 1500). */
    minWindowChars?: number;
    /** Collapse score at or above which the stream is stopped (default 0.85). */
    threshold?: number;
    /** N-gram size for both halves of the score (default 8). */
    ngramSize?: number;
    /** Stops per turn before the guard stops resuming (default 3). */
    maxBreaksPerTurn?: number;
    /** Minimum milliseconds between two stops (default 30000). */
    cooldownMs?: number;
    /** Model ids to watch; empty watches every model. */
    includeModels?: string[];
    /**
     * Recurrence score at or above which the semantic signal is considered to
     * hold (default 0.35).
     *
     * Measured on the trailing window: the three healthy fixtures peak at 0.19,
     * 0.17 and 0.17 across every streaming prefix, while a paraphrased loop and
     * the verbatim loop score 0.75 and 0.99. 0.35 sits near the geometric mean
     * of that gap, roughly 1.8x above the worst healthy prefix.
     */
    semanticThreshold?: number;
    /**
     * Sentences a claim must be separated from to count as recurrence
     * (default 6).
     *
     * Zero would make healthy enumeration look degenerate: item N of a list
     * legitimately shares most of its wording with item N-1. Requiring the
     * earlier sentence to be at least this far back keeps the measurement on
     * "the model said this before" rather than "the model is still on this point".
     */
    semanticLag?: number;
    /**
     * Characters required before the semantic signal is scored (default 360).
     *
     * Deliberately its own floor, well below `minWindowChars`: a real trace
     * emitted 16 steps of which only one crossed 1500 characters, so the
     * literal signal saw a single step of a whole turn. The two floors are
     * separate knobs because they answer different questions — the literal one
     * is about how much text a duplicate needs to be visible in, the semantic
     * one about how much text a recurrence needs to be measurable in.
     */
    semanticMinChars?: number;
    /** Sentences required before recurrence is scored (default 8). */
    semanticMinSentences?: number;
    /**
     * Consecutive windows in which both signals must hold before a break
     * (default 3).
     *
     * Counted independently of the per-turn break budget, which bounds how often
     * the guard may act, not how sure it must be. A stream delivers a scoring
     * window every few dozen characters, so three confirmations cost a few
     * hundred wasted tokens against a runaway measured in the tens of thousands.
     */
    semanticConfirmations?: number;
    /**
     * Lowest literal score the low-literal path will act on (default 0.6).
     *
     * A paraphrased loop sits far below `threshold` — measured at 0.676 for a
     * model restating twelve conclusions in fresh words, against 0.85 for
     * verbatim repetition. So a strong semantic signal has to be allowed to
     * carry a decision the literal signal cannot make on its own.
     *
     * The floor exists because a low score is not the same as a high one: 0.6 is
     * evidence that something is repeating, 0.2 is a short trace that has not
     * repeated long enough to say anything. Measured healthy literal peaks at
     * 0.276, so 0.6 keeps a 2.2x margin over every healthy prefix.
     */
    semanticLiteralFloor?: number;
    /**
     * Semantic score the low-literal path demands (default 0.45).
     *
     * Strictly greater than `semanticThreshold`, and validated as such. The literal
     * evidence on this path is weaker by construction, so the semantic evidence
     * has to be stronger: 0.45 against a measured healthy peak of 0.194 is a
     * 2.3x margin, while a paraphrase loop measures 0.77.
     */
    semanticStrictThreshold?: number;
    /**
     * Most of a window's sentences may be distinct and still be eligible for the
     * low-literal path (default 0.47).
     *
     * This is the dimension that separates a model circling from a model
     * listing. Both reuse a frame heavily and both score high on recurrence, but
     * a list writes a sentence that has never been written before on every line
     * — measured at 1.000 distinct, against 0.42 for a paraphrase loop and 0.075
     * for a verbatim one. Recurrence says the wording comes back; this says
     * whether anything at all was new.
     */
    semanticDistinctCeiling?: number;
    /**
     * Consecutive windows the low-literal path needs (default 5).
     *
     * Strictly greater than `semanticConfirmations`, and validated as such. The path is
     * acting on weaker evidence, so it also waits longer before it acts.
     */
    semanticStrictConfirmations?: number;
    /** Injectable clock, so the cooldown is testable without a timer. */
    now?: () => number;
}
/** Fully defaulted, validated options. */
export interface ResolvedGuardOptions {
    windowChars: number;
    minWindowChars: number;
    threshold: number;
    ngramSize: number;
    maxBreaksPerTurn: number;
    cooldownMs: number;
    includeModels: string[];
    semanticThreshold: number;
    semanticLag: number;
    semanticMinChars: number;
    semanticMinSentences: number;
    semanticConfirmations: number;
    semanticLiteralFloor: number;
    semanticStrictThreshold: number;
    semanticDistinctCeiling: number;
    semanticStrictConfirmations: number;
    now: () => number;
}
export declare const DEFAULT_GUARD_OPTIONS: ResolvedGuardOptions;
/**
 * Validate caller options fail-loud and fill in defaults. A threshold outside
 * (0,1), a minimum above the window, or a non-positive budget throws rather
 * than falling back to a value nobody chose.
 */
export declare function resolveGuardOptions(options?: GuardOptions): ResolvedGuardOptions;
/**
 * `1 - uniqueNgrams / totalNgrams` over the window.
 *
 * Scored over the whole window: a degenerate stream repeats within its own
 * trailing characters, so scoring part of the window would dilute the signal.
 * @param window - trailing reasoning characters.
 * @param n - n-gram size.
 * @returns collapse score in [0,1]; 0 means every n-gram is unique.
 */
export declare function collapseScore(window: string, n: number): number;
/**
 * Split reasoning text into sentences, for mixed CJK and Latin streams.
 *
 * A Chinese full stop ends a sentence whatever follows it. An ASCII `.!?` only
 * ends one when whitespace or the end of the text follows, because the same
 * characters carry out decimals, file names and version numbers
 * (`selectors.test.ts:745`, `3.14`) that must not become sentence
 * edges. Whitespace runs collapse and case folds, so a difference in spacing
 * or capitalisation cannot read as a difference in wording.
 *
 * @param text - reasoning text, typically one trailing window.
 * @returns non-empty normalized sentences, in order.
 */
export declare function splitSentences(text: string): string[];
/**
 * How strongly a window keeps returning to sentences it already stated.
 *
 * Each sentence is compared against every sentence at least `lag` positions earlier
 * and keeps the best match; the score is the mean of those best matches. The
 * comparison is normalized (Jaccard), so two sentences match on shared wording
 * rather than on shared length, and character n-grams are used rather than words
 * because no tokenizer is available here, and none would survive a CJK/Latin
 * mix without segmenting Chinese first.
 *
 * Two properties matter more than the exact number. The score saturates — a
 * twelve-sentence loop and a four-hundred-sentence one both approach one — so
 * it does not drift with length the way a mean pairwise similarity does, and
 * it does not reward a long answer merely for containing more pairs. And the
 * lag is what makes it safe to ship: healthy enumeration reuses its framing
 * from the sentence immediately before, which this metric cannot see.
 *
 * @param window - trailing reasoning characters.
 * @param lag - sentences a claim must be separated from to count as recurrence.
 * @returns recurrence score in [0,1]; 0 means nothing recurs, or too little text to tell.
 */
export declare function semanticRecurrence(window: string, lag: number): number;
/**
 * The share of a window's sentences that have never been said before.
 *
 * Recurrence cannot tell a model that is circling from a model that is
 * listing, because a list reuses its frame as heavily as a loop does and
 * scores just as high. The difference is that a list writes a new sentence on
 * every line. Measured over a trailing window: 0.075 for the verbatim loop,
 * 0.42 for a paraphrase loop, 1.000 for every healthy fixture and for every
 * list shape tried.
 *
 * Equality is exact and on the normalized sentence, which is what keeps the
 * lists out. Two rows differing only by a row number are 0.86 similar by
 * `semanticRecurrence` and 1.000 distinct here, and that gap is the whole point: the
 * fuzzy measure asks whether the wording came back, this one asks whether
 * anything was new.
 *
 * @param window - trailing reasoning characters.
 * @returns distinct share in (0,1]; 1 when every sentence is unique.
 */
export declare function distinctSentenceRatio(window: string): number;
export declare const RESUME_HINT: string;
/** The second resume message, used once a resume has also collapsed. */
export declare const RESUME_HINT_STRICT: string;
/**
 * Install the reasoning-collapse guard on a Context.
 *
 * The guard is inert unless the host exposes the event bus, so a harness
 * without it keeps the built-in behaviour instead of failing this plugin's
 * load.
 *
 * Resuming needs the live Agent for `cancel` and `steer`, and no supported
 * generation hands the agent to `llm/stream`. The request does, though: every
 * request the loop builds carries its `sessionId`, so the guard resolves the
 * owning Agent per request through `ctx.agents.get`, falling back to the map
 * `agent/created` fills. The per-turn break budget stays keyed on the
 * request's own abort signal, which exists for a whole turn.
 *
 * @param ctx - plugin context.
 * @param options - see {@link GuardOptions}; validated fail-loud.
 * @returns a disposer removing every listener, or undefined when the host
 * exposes no event bus.
 */
export declare function installReasoningCollapseGuard(ctx: ReasoningCollapseContext, options?: GuardOptions): (() => void) | undefined;
//# sourceMappingURL=index.d.ts.map