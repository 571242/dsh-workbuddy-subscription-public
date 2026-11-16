/**
 * Recovery of tool calls the model PRINTED instead of emitting structurally.
 *
 * Measured upstream behaviour (and the reason workbuddy2api-hub has the same
 * recovery, `wb_proxy.py` "Printed tool calls on the Chat Completions path"):
 * a tools request sometimes answers with the call spelled out inside `content`
 * — either the full-width DSML form
 *
 *     <||DSML|| calls><||DSML|| invoke name="run_code">
 *       <||DSML|| parameter name="code">print(1)</||DSML|| parameter>
 *     </||DSML|| invoke></||DSML|| calls>
 *
 * or a hybrid the model mixes on its own: a plain opening tag closed by DSML
 * tags, with the first parameter's close tag swallowed. Forwarded verbatim the
 * client sees prose, finds no call, and the turn simply ends — reported by
 * users as "it keeps stopping by itself".
 *
 * A structured `tool_calls` delta always wins; this only runs for text, which
 * is why the recovery is a pure function over the accumulated content.
 */
/** One recovered call, in the shape the mapper emits. */
export interface PrintedToolCall {
    id: string;
    name: string;
    arguments: string;
}
/** A successful recovery: the calls plus the prose left behind. */
export interface PrintedRecovery {
    calls: PrintedToolCall[];
    clean: string;
}
/** Recover the full-width `<||DSML|| …>` spelling. */
export declare function parseDsmlToolCalls(text: string): PrintedRecovery | null;
/**
 * Recover the hybrid spelling, driven by the `<parameter>` elements.
 *
 * Parameter elements are spelled the same way in both shapes and a parameter
 * name is the one thing a call cannot do without, so they are the anchor; the
 * nearest preceding opening tag that is neither a wrapper nor a parameter names
 * the tool.
 */
export declare function parseLeakedToolCalls(text: string): PrintedRecovery | null;
/** Recover a printed call under either spelling. */
export declare function recoverPrintedToolCalls(text: string): PrintedRecovery | null;
/**
 * Index from which a streaming text buffer must be held back.
 *
 * The earliest `<` that either opens a recognisable tag or could still grow
 * into one (a delta may split `<parameter` across frames), or -1 when the
 * whole buffer is safe to emit as prose.
 */
export declare function printedCallHoldIndex(text: string): number;
/** Whether a held buffer has already reached a closing tag. */
export declare function printedCallLooksComplete(text: string): boolean;
//# sourceMappingURL=dsml.d.ts.map