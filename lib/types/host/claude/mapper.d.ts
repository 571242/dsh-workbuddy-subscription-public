/**
 * Wire mapping for the Anthropic Messages API behind a SUBSCRIPTION credential.
 *
 * WHAT THIS MODULE OWNS. Everything between DSH's GenerateOptions and the bytes
 * of POST <API_BASE><MESSAGES_PATH>: the request body, and the SSE state machine
 * that turns Anthropic's line-oriented event stream back into DSH StreamChunks.
 * It holds no credential, performs no I/O, and never touches the network - the
 * adapter owns transport and it owns the line splitting. Every function here is
 * pure with respect to the wire: same options in, same body out.
 *
 * The module doc of the sibling model-catalog.ts is the authority for the
 * per-model facts used below, and every claim marked TRANSCRIBED below was read
 * out of that catalog's transcription of a locally installed reference
 * implementation rather than recalled. Claims marked CHOICE are this module's
 * own judgement and are flagged as such so a reviewer can disagree with one
 * without having to re-derive the whole file.
 *
 * ---------------------------------------------------------------------------
 * 1. THE SYSTEM ARRAY IS TWO BLOCKS AND THE FIRST ONE IS NOT OPTIONAL
 * ---------------------------------------------------------------------------
 *
 * On the subscription route the system prompt is an ARRAY of text blocks whose
 * FIRST entry must be the Claude Code identity line verbatim. This is not
 * cosmetic and not a preference: a subscription request without that identity
 * block is rejected, and the failure is a whole-turn failure rather than a
 * degraded answer. It is therefore emitted unconditionally - even when the
 * caller states no system prompt at all - and the caller's own prompt, when
 * there is one, becomes the SECOND block. See CLAUDE_CODE_IDENTITY_TEXT.
 *
 * A role: 'system' entry in options.messages is FOLDED into that same second
 * block rather than being sent as a message: the Messages wire has no system
 * role, so a system message that reached messages[] would either be rejected or
 * silently reinterpreted. The fold is order-stable (header first, then history
 * order) because the system array is the head of the prefix the server caches.
 *
 * ---------------------------------------------------------------------------
 * 2. THINKING - FOUR CASES, DISPATCHED IN THE CATALOG'S ORDER
 * ---------------------------------------------------------------------------
 *
 * claudeThinkingMode(model) decides the form, and the order of the guards is
 * the whole point:
 *
 *   mid-convo -> { type: 'adaptive', display: 'summarized',
 *                  block_binding: { prefix_mismatch_behavior: 'drop_block' } }
 *                PLUS output_config = { effort }. This case outranks
 *                everything, including a caller asking for thinking off: the
 *                block_binding exists so a prefix mismatch is dropped instead of
 *                surfacing as a persistent 400, and suppressing it is exactly
 *                how that 400 comes back. The field is itself a 400 unless the
 *                request carries the thinking-binding-controls beta, so the
 *                adapter reads claudeBodyBindsThinking(body) to add it.
 *   adaptive  -> { type: 'adaptive', display: 'summarized' }, plus
 *                output_config = { effort } when an effort was named. The budget
 *                form is rejected by these models.
 *   budget    -> { type: 'enabled', budget_tokens: <clamped>, display:
 *                'summarized' }.
 *   none      -> NO thinking field at all.
 *
 * Thinking OFF is a separate decision layered on top: when the caller asked for
 * it and claudeModelCanDisableThinking(model) is true, { type: 'disabled' } is
 * sent; when that predicate is false the disable request is NOT sent (the model
 * forbids it) and the model's own form is used instead - a model that always
 * thinks cannot be talked out of it, and the only honest request left is the
 * normal one. CHOICE: nothing above the predicate is this module's invention,
 * but "fall back to the model's own form" is, because the catalog only states
 * that the disable request must not be sent.
 *
 * ---------------------------------------------------------------------------
 * 3. THE BUDGET ARITHMETIC IS TRANSCRIBED, NOT RE-DERIVED
 * ---------------------------------------------------------------------------
 *
 * RULE 4 of model-catalog.ts carries the reference arithmetic with line cites.
 * adjustMaxTokensForThinking, thinkingBudgetForLevel, clampReasoning and
 * clampThinkingBudgetToAnswerRoom below reproduce it statement for statement.
 * Two traps that transcription exists to prevent:
 *
 *   1. an UNDEFINED caller cap must not be coerced to 0. Under the helper's own
 *      branch Math.min(0 + budget, modelMax) makes the thinking budget the
 *      entire response ceiling and leaves no room for an answer;
 *   2. the value passed in as baseMax is the ALREADY-RESOLVED cap
 *      (buildBaseOptions resolves options.maxTokens ?? model.maxTokens before
 *      calling the helper), so feeding an unresolved value in changes which
 *      branch runs. resolveMaxTokens below is what resolves it, and the builder
 *      passes the result - never options.maxTokens directly.
 *
 * The one deviation from the transcription is that the reference's
 * thinkingBudgetForLevel can yield undefined for a level its table does not
 * name; the reference never hits that (its level always comes from the model's
 * own ladder) while a caller here could. Every use below either substitutes the
 * middle level or treats the result as "no thinking field", and never does
 * arithmetic with undefined.
 *
 * ---------------------------------------------------------------------------
 * 4. TOOL NAMES ARE CASE-NORMALIZED, AND MAPPED BACK
 * ---------------------------------------------------------------------------
 *
 * A subscription token is served Claude Code's own tool vocabulary, and the
 * reference case-normalizes the tool names it sends to that vocabulary. So a
 * tool offered as 'bash' or 'WEBSEARCH' goes out as 'Bash' / 'WebSearch', and a
 * returned canonical name is mapped BACK to the caller's spelling, because DSH
 * dispatches on the name it declared. A name the vocabulary does not know is
 * sent unchanged: inventing a spelling for an unknown tool would rename a tool
 * the harness can no longer dispatch.
 *
 * The back-map is per request and case-insensitive, which is only sound while
 * it is unambiguous. Two offered tools that would collapse onto one wire name
 * (or onto one case-insensitive wire name) disable normalization for that
 * request entirely and send the real names, so the model's reply can never be
 * attributed to the wrong tool.
 *
 * ---------------------------------------------------------------------------
 * 5. THINKING BLOCKS ARE REPLAYED VERBATIM OR NOT AT ALL
 * ---------------------------------------------------------------------------
 *
 * A replayed thinking block must carry the signature the model produced beside
 * it: a signed block without its signature is a 400, and dropping signed
 * thinking blocks breaks multi-turn tool use under extended thinking because
 * the assistant turn that made a tool call loses the reasoning the server
 * expects to see again. redacted_thinking blocks are replayed too - they are
 * opaque to us, which is precisely why only the payload that came off the wire
 * can be sent back. A thinking block with NO signature cannot be replayed at
 * all and is dropped rather than sent unsigned.
 *
 * For that to be possible across turns, the text and the signature are carried
 * through the turn: each emitted reasoning block gets a matching entry in the
 * finish chunk's replayState envelope, and the request builder reads it back on
 * the next turn. CHOICE: the envelope shape is DSH's (the harness's
 * ReplayEnvelope), but that this line needs one at all is a consequence of the
 * rule above rather than something the catalog states.
 *
 * ---------------------------------------------------------------------------
 * 6. THE STREAM IS LINE-ORIENTED, NOT data:-ONLY
 * ---------------------------------------------------------------------------
 *
 * Anthropic sends 'event: <name>' and 'data: <json>' as separate lines, and the
 * primitive below is fed ONE line at a time. It deliberately ignores the
 * 'event:' line and dispatches on the payload's own 'type' field instead: the
 * two must agree, and if they ever disagree the JSON is the copy that carries
 * everything else. Unknown event types are ignored rather than rejected - a
 * beta this plugin does not know about must not fail a working turn - while an
 * 'error' event THROWS, because a severed reply flushed as a clean stop is a
 * wrong answer rather than a visible failure.
 *
 * Reasoning deltas are STREAMED as they arrive (see openThinkingBlock); only the
 * replay entry waits for content_block_stop, because the signature that decides
 * whether the block may be replayed arrives at the END of the block. They used
 * to be buffered until the stop, which made DSH start the step's first-token
 * clock after all thinking was done - so TPS divided every thinking token by the
 * answer's time alone, and TTFT absorbed the whole thinking phase.
 *
 * ---------------------------------------------------------------------------
 * 7. PROMPT CACHING IS ON BY DEFAULT, AND IT IS THE REQUEST THAT TURNS IT ON
 * ---------------------------------------------------------------------------
 *
 * Anthropic's prompt cache is REQUEST-DRIVEN: the server caches a prefix only
 * where the request puts an explicit cache_control breakpoint, and a request
 * with no breakpoint gets no cache_read_input_tokens back no matter how
 * identical its bytes are turn over turn. Emitting the breakpoints is therefore
 * this module's job, and it is the DEFAULT: ClaudeRequestOptions.cacheControl
 * is true unless a caller explicitly states false. The reference implementation
 * this line is transcribed from resolves the same way (its resolveCacheRetention
 * defaults to 'short'; only an explicit 'none' skips caching), and the
 * asymmetry is deliberate - a caller that says NOTHING must still get caching,
 * because an opt-in flag that one call site forgets to pass is exactly how this
 * request stopped carrying breakpoints in the first place.
 *
 * Three sites are marked, which is three of the four breakpoints the wire
 * accepts (see MAX_CACHE_BREAKPOINTS): the LAST system block, the last block of
 * the LAST user message, and the last tool. The first covers the identity block
 * and the caller's prompt; the second is what actually caches CONVERSATION
 * HISTORY across turns, since it sits at the end of everything the next turn
 * will resend; the third keeps the tool table inside the cached prefix instead
 * of behind the first message breakpoint.
 *
 * Where the marking happens matters as much as that it happens: the message
 * breakpoint goes on the FINAL merged list, after mergeClaudeMessages has
 * folded consecutive same-role turns together. Marking the pre-merge list can
 * land the breakpoint on a block the merge then moves back, which leaves a
 * marker in the request that caches nothing the next turn can reuse.
 */
import { type ContentBlock, type GenerateOptions, type StreamChunk } from '../common/llm-compat.ts';
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { type ClaudeCacheTtl } from './types.ts';
/**
 * The Claude Code identity block's exact text.
 *
 * MUST be system[0] on every subscription request (see the module doc). It is a
 * single literal rather than a template so a test can compare it byte for byte.
 */
export declare const CLAUDE_CODE_IDENTITY_TEXT = "You are Claude Code, Anthropic's official CLI for Claude.";
/** Answer room the budget clamp always leaves below the response ceiling. */
export declare const MIN_ANSWER_TOKENS = 1024;
/**
 * Cache breakpoints one Messages request may carry.
 *
 * TRANSCRIBED from the wire's own limit and the reference implementation's
 * reading of it. This module marks at most three (see the module doc), so the
 * budget is never the binding constraint - the constant exists so a test can
 * assert that against the REAL number rather than a magic three.
 */
export declare const MAX_CACHE_BREAKPOINTS = 4;
/**
 * Thinking budget one level asks for, before any clamp.
 *
 * TRANSCRIBED from simple-options.js lines 38-43. The values are the
 * reference's, not a preference: a different table would silently change how
 * much of the response ceiling a level spends.
 */
export declare const DEFAULT_THINKING_BUDGETS: Readonly<Record<string, number>>;
/**
 * Level used when a caller names none, or names one the table does not know.
 *
 * CHOICE. The reference always has a level because the adapter picks one off
 * the model's own ladder; this mapper has to answer for a caller that named
 * nothing or named a level from another provider's vocabulary. The middle of
 * the table is the least surprising answer and, unlike 'high', it cannot turn a
 * modest request into one whose budget eats the whole ceiling.
 */
export declare const DEFAULT_THINKING_LEVEL = "medium";
/** Caller-supplied overrides for {@link DEFAULT_THINKING_BUDGETS}. */
export type ThinkingBudgets = Readonly<Record<string, number | undefined>>;
/**
 * Collapse an effort onto the levels the budget table names.
 *
 * TRANSCRIBED from simple-options.js lines 44-46: xhigh and max are the two
 * rungs the table has no entry for, and both resolve to high rather than to a
 * budget invented here.
 */
export declare function clampReasoning(effort: string | undefined | null): string | undefined;
/**
 * Budget one level asks for, with the caller's overrides applied.
 *
 * TRANSCRIBED from simple-options.js lines 47-51. An unknown level yields
 * undefined - the reference's spread-and-index does the same - and every caller
 * below answers for that case explicitly instead of doing arithmetic with it.
 */
export declare function thinkingBudgetForLevel(level: string | undefined | null, customBudgets?: ThinkingBudgets): number | undefined;
/**
 * Shrink a budget until an answer still fits under the ceiling.
 *
 * TRANSCRIBED from simple-options.js lines 52-55, and reused verbatim as the
 * wire clamp below, which the catalog writes out inline as exactly this
 * expression.
 */
export declare function clampThinkingBudgetToAnswerRoom(budget: number, ceiling: number): number;
/**
 * Level {@link thinkingBudgetForLevel} should be asked about.
 *
 * A caller who named no level, or named one of the off-tokens, gets the middle
 * level rather than an undefined lookup: the budget table names no 'off' rung,
 * and a request that is going to think needs a budget fitted for it. A level
 * the table does not know at all is passed through so the arithmetic, and not
 * this function, is what reports it as unavailable.
 */
export declare function thinkingBudgetLevel(effort: string | undefined | null): string;
/**
 * Fit a thinking budget inside a response ceiling.
 *
 * TRANSCRIBED from simple-options.js lines 56-65. Read the two traps in the
 * module doc before changing a branch here:
 *
 * - baseMaxTokens === undefined means NO EXPLICIT CALLER CAP and selects the
 *   model cap; coercing it to 0 would make maxTokens equal the budget and
 *   leaving nothing for an answer;
 * - baseMaxTokens is the ALREADY-RESOLVED cap, so the caller resolves
 *   options.maxTokens ?? model.maxTokens first.
 *
 * The '?? 0' beside the budget is the deviation the module doc describes: the
 * reference would compute NaN for a level its table does not name, and an
 * unknown level is ordinary input here.
 */
export declare function adjustMaxTokensForThinking(baseMaxTokens: number | undefined, modelMaxTokens: number, reasoningLevel: string | undefined | null, customBudgets?: ThinkingBudgets): {
    maxTokens: number;
    thinkingBudget: number | undefined;
};
/**
 * The response ceiling one request asks for.
 *
 * options.maxTokens ?? the model's own cap. This is the resolution step the
 * second trap refers to: an undefined caller cap becomes the MODEL cap, never
 * zero, so the thinking branch fits inside a real ceiling.
 */
export declare function resolveMaxTokens(options: GenerateOptions): number;
/** Whether one caller effort means 'thinking off'. */
export declare function thinkingRequestedOff(effort: string | undefined | null): boolean;
/** The thinking and output_config fields one request carries. */
export interface ClaudeThinkingFields {
    thinking?: Record<string, unknown>;
    outputConfig?: Record<string, unknown>;
}
/**
 * Whether one request will actually think.
 *
 * This is what decides whether the response ceiling is inflated by the level's
 * budget, and getting it wrong in the generous direction is not harmless: a
 * non-thinking model whose ceiling was raised by a budget it never had would
 * ask the server for tokens it cannot produce. mid-convo thinks whatever the
 * caller asked for; the other forms think unless the disable request is going
 * to be sent and the model allows one.
 */
export declare function claudeRequestThinks(model: string, effort: string | undefined | null): boolean;
/**
 * Dispatch the four thinking cases for one model and effort.
 *
 * The guard order is the catalog's and is load-bearing: mid-convo is checked
 * first and unconditionally, so a caller asking for thinking off on a managed
 * effort model still gets the adaptive form with its block_binding. See the
 * module doc for what each form is and why.
 *
 * @param model - exact model id, resolved through the frozen catalog.
 * @param effort - the caller's raw effort, passed through as-is.
 * @param level - the level whose budget the budget form spends.
 * @param maxTokens - the ALREADY-RESOLVED response ceiling. The budget form
 *   spends part of it, so it is the ceiling and not the budget that this
 *   function is told about.
 */
export declare function claudeThinking(model: string, effort: string | undefined, level: string, maxTokens: number, customBudgets?: ThinkingBudgets): ClaudeThinkingFields;
/**
 * Claude Code's canonical tool spellings.
 *
 * TRANSCRIBED from the reference implementation's own tool vocabulary. The
 * order is the reference's; membership is what matters.
 */
export declare const CLAUDE_CODE_TOOL_NAMES: readonly string[];
/**
 * The canonical spelling of one tool name, or undefined when it has none.
 *
 * This is the single-name rule: case-insensitive membership, canonical output.
 */
export declare function canonicalClaudeToolName(name: string): string | undefined;
/** The per-request tool-name translation both directions of the wire share. */
export interface ClaudeToolNames {
    /** False when a collision disabled normalization; both maps are then identity. */
    enabled: boolean;
    /** Caller spelling -> the name to send. */
    toWire: ReadonlyMap<string, string>;
    /** Exact wire name -> caller spelling. */
    byExact: ReadonlyMap<string, string>;
    /** Lower-cased wire name -> caller spelling; consulted only after byExact. */
    byLower: ReadonlyMap<string, string>;
}
/**
 * Build the translation for one request's offered tools.
 *
 * Collisions disable normalization (see the module doc): the check is on the
 * WIRE name, compared exactly and case-insensitively, because both are ways for
 * one reply to be attributed to the wrong tool. Case-insensitivity is the
 * stricter half and is CHOICE: two tools spelled 'read' and 'Read' send two
 * distinct names and are therefore unambiguous on the request, but a reply of
 * 'READ' could not be attributed, and refusing to guess costs only the
 * canonical spelling.
 */
export declare function claudeToolNames(tools?: readonly {
    name: string;
}[]): ClaudeToolNames;
/** The wire name for one caller tool name under a request's translation. */
export declare function claudeWireToolName(name: string, names?: ClaudeToolNames): string;
/**
 * The caller's tool name for one name the model returned.
 *
 * Exact match first, then case-insensitive: a model that relabels the case of a
 * name it was given is still talking about the tool it was given, while a
 * request that offered two names differing only by case must resolve the exact
 * one. An unknown name is returned unchanged - it is not this layer's job to
 * invent a tool.
 */
export declare function claudeOriginalToolName(name: string, names?: ClaudeToolNames): string;
/**
 * Attachment seam this route needs: verified bytes for one durable image, and a
 * downscaled request version of one that is too large for this request. Every
 * harness generation in the peer range declares readImageRequest; a backend
 * that cannot derive request versions rejects the call, and that rejection is
 * handled like any other unreadable image.
 */
export type AttachmentImageReader = Pick<AttachmentStore, 'readImage' | 'readImageRequest'>;
/** One durable image resolved for an in-flight request, or proven unreadable. */
export type ResolvedRequestImage = {
    readonly kind: 'inline';
    readonly mediaType: string;
    readonly data: string;
} | {
    readonly kind: 'unavailable';
};
/** Resolved images keyed by durable attachment id; consumed by one request build. */
export type ResolvedRequestImages = ReadonlyMap<string, ResolvedRequestImage>;
/**
 * Base64 image payload one request may carry.
 *
 * CHOICE, bounded on both sides. Anthropic's documented request ceiling is
 * 32 MB, and its per-image ceiling is 5 MB of RAW bytes; 5 MB of raw bytes
 * expands to about 6.8 MB of base64, so a bound below that would offload a
 * single image the endpoint would have accepted. 8 MB leaves the conversation
 * text, tool schemas and system prompt room inside the 32 MB envelope while
 * still catching the runaway case locally rather than as a 413.
 */
export declare const MAX_REQUEST_IMAGE_BYTES: number;
/**
 * Replace the oldest inline images with a text placeholder once one request
 * would carry more than {@link MAX_REQUEST_IMAGE_BYTES} of base64 image data.
 * Durable history is untouched; only the request about to be sent changes, and
 * the placeholder names the omission so the model asks for the picture again
 * instead of answering about a blank.
 */
export declare function offloadOldestRequestImages(options: GenerateOptions): GenerateOptions;
/**
 * Longest side, in pixels, the wire accepts for one image in any request.
 * TRANSCRIBED from the API's vision limits. The harness normalizes stored
 * images to an 8192 px long edge, so a stored image can still exceed this.
 */
export declare const MAX_IMAGE_EDGE = 8000;
/**
 * Longest side, in pixels, the wire accepts for every image once one request
 * carries more than {@link MANY_IMAGE_THRESHOLD} images. TRANSCRIBED: past that
 * count the request is rejected with "At least one of the image dimensions
 * exceed max allowed size for many-image requests: 2000 pixels".
 *
 * Rejection is a 400 for the whole request. History keeps every image, so a
 * long session can only add images. Once it holds more than twenty and one is
 * wider than 2000 px, which is common for side-by-side screenshots, every later
 * turn fails. The session cannot recover by itself.
 */
export declare const MANY_IMAGE_EDGE = 2000;
/** Image count above which {@link MANY_IMAGE_EDGE} applies. TRANSCRIBED. */
export declare const MANY_IMAGE_THRESHOLD = 20;
/**
 * Long-edge ceiling every image of this request must meet.
 *
 * The API counts image blocks, so a repeated attachment counts every time it
 * appears. The count is taken before images are resolved: a block that later
 * degrades to placeholder text still counts. Overcounting can only lower the
 * ceiling, and a lower ceiling never causes a rejection.
 */
export declare function requestImageEdgeLimit(options: GenerateOptions): number;
/**
 * Request-version target for one stored image whose long edge is over the
 * ceiling, or undefined when it fits. The short edge rounds to the nearest
 * pixel, matching the harness's long-edge resize. A reference without usable
 * dimensions is sent as stored.
 */
export declare function requestImageEdgeTarget(ref: ImageAttachmentRef, edge: number): {
    width: number;
    height: number;
    maxPixels: number;
    maxBytes: number;
} | undefined;
/**
 * Read every durable { type: 'image', attachment } block one request carries.
 * An unreadable image resolves to 'unavailable' rather than disappearing, so
 * the model is told the picture is missing instead of answering about a blank.
 *
 * An image whose long edge is over this request's ceiling is sent as the
 * harness's downscaled request version (see {@link requestImageEdgeLimit}). The
 * stored image and durable history do not change, and an image that already
 * fits is sent byte-for-byte as stored. If a downscaled version cannot be
 * produced, the image resolves to 'unavailable'. A visible placeholder is better
 * than sending the original, which would make the whole request fail.
 */
export declare function resolveRequestImages(options: GenerateOptions, attachments: AttachmentImageReader | undefined, signal?: AbortSignal): Promise<ResolvedRequestImages>;
type AnthropicBlock = Record<string, unknown>;
/**
 * Concatenated system-prompt text, or undefined when the caller stated none.
 *
 * Cache-stability invariant: the system array is the head of the prefix the
 * server caches, so this must be a pure, order-stable fold of its inputs - the
 * one-shot header first, then message text in history order, never re-sorted
 * and never decorated with per-turn metadata. Any value that changes
 * turn-over-turn belongs in a trailing user message, not here, because one
 * changed byte at the head invalidates the whole cached prefix.
 */
export declare function leadingSystemText(options: GenerateOptions): string | undefined;
/**
 * The system array for one request: identity first, always.
 *
 * The identity block is not conditional on anything (see the module doc). The
 * ephemeral cache marker goes on the LAST block and is ON BY DEFAULT, which is
 * the Anthropic-recommended shape: a breakpoint at the end of the prompt caches
 * everything above it, so marking the user block also covers the identity
 * block, while marking the identity block alone would cache nothing that
 * changes.
 *
 * @param cacheControl - false is the opt-OUT; the default requests caching.
 */
export declare function buildClaudeSystemBlocks(options: GenerateOptions, cacheControl?: boolean, ttl?: ClaudeCacheTtl): AnthropicBlock[];
/**
 * How many cache_control markers one built body carries.
 *
 * Walks the finished body rather than counting calls to the marker: the number
 * the wire enforces is the number of markers IN THE BYTES, so a test that
 * counts its own marking calls could pass while the body carried a fourth
 * breakpoint from somewhere else. Used by the tests only.
 */
export declare function countClaudeCacheBreakpoints(body: unknown): number;
/** Options this builder reads beyond GenerateOptions. */
export interface ClaudeRequestOptions {
    /**
     * Emit prompt-cache breakpoints. Default TRUE: caching is what a caller that
     * states nothing gets (see the module doc). Pass false only to opt out.
     *
     * When on, breakpoints go on the last system block, the last block of the
     * last user message, and the last tool - at most
     * {@link MAX_CACHE_BREAKPOINTS} in total.
     */
    cacheControl?: boolean;
    /**
     * Prompt-cache tier for the breakpoints this request writes.
     *
     * Defaults to the five-minute tier so a caller that states nothing keeps the
     * plain marker. The subscription line passes the one-hour tier, which is what
     * the official CLI requests while a plan is drawing on included usage — and
     * the `1h` value REQUIRES the extended-cache-ttl beta header, so a caller
     * asking for it must also make sure that header is sent
     * (`claudeBetas({ cacheTtl })`).
     */
    cacheTtl?: ClaudeCacheTtl;
    /**
     * Tool-name translation to use. Pass the same value to createStreamState so
     * the response side maps back through the identical table.
     */
    toolNames?: ClaudeToolNames;
    /** Caller overrides for the thinking budget table. */
    thinkingBudgets?: ThinkingBudgets;
}
/**
 * Build one Messages request body.
 *
 * Field order in the returned object is irrelevant to the server and is kept
 * readable only.
 *
 * @param options - request options carrying the normalized conversation.
 * @param images - images read for this request by resolveRequestImages.
 * @param request - cache and translation options. Caching is the DEFAULT and
 *   is skipped only when request.cacheControl is explicitly false.
 */
export declare function buildClaudeRequestBody(options: GenerateOptions, images?: ResolvedRequestImages, request?: ClaudeRequestOptions): Record<string, unknown>;
/**
 * Whether one built body carries `thinking.block_binding`.
 *
 * Read off the BODY rather than re-derived from the catalog, because the header
 * this answers for (THINKING_BINDING_CONTROLS_BETA) exists to license that one
 * field: sent without it the field is a 400 on every request, so the header must
 * follow the bytes, not a second copy of the rule that produced them.
 */
export declare function claudeBodyBindsThinking(body: Record<string, unknown>): boolean;
/** One tool_use block accumulating across input_json_delta fragments. */
interface PendingToolCall {
    /** Index of the DSH block this call occupies. */
    index: number;
    /** Wire id, kept beside the DSH-block id so a replay is byte-exact. */
    id: string;
    /** The name the CALLER declared, which is what DSH dispatches on. */
    name: string;
    /** The name the WIRE carried, which is what a replay must send back. */
    wireName: string;
    /** Concatenated partial_json fragments, verbatim. */
    arguments: string;
}
/** One text block currently receiving deltas. */
interface OpenTextBlock {
    index: number;
    text: string;
}
/**
 * One open thinking or redacted_thinking block.
 *
 * Its text streams to the caller as it arrives; this record accumulates the
 * same text, the signature (which arrives at the END of the block) and a
 * redacted block's payload, for the replay entry written when it closes. A
 * redacted block's payload is never paraphrased into visible reasoning text.
 */
interface PendingThinking {
    index: number;
    kind: 'thinking' | 'redacted_thinking';
    text: string;
    signature: string;
    data: string;
}
/** Accumulated state of one Anthropic SSE stream. */
export interface ClaudeStreamState {
    /** Emitted blocks by DSH index; a slot exists from the moment its block opens. */
    blocks: ContentBlock[];
    /** Anthropic content index -> the DSH index of the open text block. */
    openText: Map<number, OpenTextBlock>;
    /** Anthropic content index -> the accumulating tool call. */
    toolCalls: Map<number, PendingToolCall>;
    /** Anthropic content index -> an open thinking block. */
    pending: Map<number, PendingThinking>;
    /**
     * Anthropic content index -> the wire block that produced the emitted block.
     *
     * A slot is `null` - never `undefined` - when a block has no verbatim wire
     * form to replay. That is not cosmetic: this array goes into the finish
     * chunk's replayState, DSH validates every stream chunk as lossless JSON, and
     * `undefined` is not a JSON value, so a hole here costs the caller the WHOLE
     * turn ("Assistant stream chunk must be losslessly JSON-serializable") rather
     * than one replay entry. See {@link jsonSafeValue}.
     */
    replayBlocks: (Record<string, unknown> | null)[];
    /** Tool-name translation the response side maps back through. */
    toolNames: ClaudeToolNames | undefined;
    sawMessageStart: boolean;
    sawMessageStop: boolean;
    hasContent: boolean;
    hasToolCall: boolean;
    /** Anthropic stop_reason, verbatim. */
    finishReason: string | null;
    /** `stop_details.explanation` from the final message_delta, when stated. */
    stopExplanation?: string;
    /**
     * The wire `error` object of an in-band `error` event, recorded just before
     * the mapper throws on it. The mapper cannot tell whether anything has reached
     * the caller yet; the adapter can, and reads this to decide whether the failure
     * is still safe to retry (see the adapter's `inBandStreamVerdict`).
     */
    streamError?: Record<string, unknown>;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    /** Estimate from the streamed (possibly summarized) thinking text. */
    reasoningTokens: number;
    /**
     * The server's own `usage.output_tokens_details.thinking_tokens`, when stated.
     * It counts the RAW reasoning, which the summarized text returned on Claude 4+
     * models understates, so it outranks the estimate above.
     */
    reportedReasoningTokens: number | undefined;
    sawUsage: boolean;
    finished: boolean;
}
/**
 * Fresh stream state.
 *
 * @param toolNames - the SAME ClaudeToolNames the request was built with, so a
 * returned canonical tool name maps back to the spelling the caller declared.
 * Omitted means names pass through unchanged.
 */
export declare function createStreamState(toolNames?: ClaudeToolNames): ClaudeStreamState;
/**
 * Flush every open block, then emit usage and the terminal finish.
 *
 * Idempotent: message_stop already closes the stream, so the adapter's own call
 * after the body ends is a no-op rather than a duplicate finish. This function
 * deliberately does NOT judge whether the stream was complete - that is
 * assertStreamComplete's job, kept separate so the flush and the verdict can be
 * reasoned about independently.
 */
export declare function closeStream(state: ClaudeStreamState): StreamChunk[];
/**
 * Assert the stream reached its terminal event.
 *
 * A stream that ended without message_stop is a severed reply, not a completed
 * answer: everything already emitted is a prefix of something the model never
 * finished saying, and flushing it as a clean stop is precisely the failure
 * this check exists to prevent.
 */
export declare function assertStreamComplete(state: ClaudeStreamState): void;
/**
 * Feed one SSE line of a Messages response into the state.
 *
 * Emits DSH chunks for the events that carry content and ignores everything
 * else, including the 'event:' line (the payload's own type is authoritative)
 * and any event type this build does not know. An 'error' event THROWS: the
 * reply is over, and continuing to flush it as a clean stop would report a
 * wrong answer as a successful one.
 */
export declare function processStreamLine(line: string, state: ClaudeStreamState): StreamChunk[];
export {};
//# sourceMappingURL=mapper.d.ts.map